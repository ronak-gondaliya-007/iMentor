import { Request, Response, request } from "express";
import { success, error } from "../utils/helpers/resSender";
import { logger } from "../utils/helpers/logger";
import { User_Activity, defaultProfilePicConstant, errorMessage, eventAcceptenceTypeConstant, eventStatusConstant, messageConstant, msg_Type, questionConst, statusCode, statusType, successMessage, uploadConstant, userRoleConstant, userStatusConstant } from "../utils/const";
import { findOne, findOneAndUpdate, insertOne, find, aggregate, updateMany, deleteMany, deleteOne, distinct } from "../utils/db";
import { requestUser } from "../Interfaces/schemaInterfaces/user";
import { uploadToS3, validateFile } from "../utils/uploadFile";
import { ascendingSorting, descendingSorting } from "../utils/helpers/functions";
import moment from 'moment'
import { eventApprovalNotification } from "../Controller/Web/notification.controller";
import { update } from "lodash";
import { sendMsg } from "./Web/message.controller";
// import { deleteEventAllJob, updateEventsJob, removedUserEventsJob } from "../Bull/Processors/badge.processor";
import mongoose from "mongoose";
import exportFileFunction from "../utils/exportCSV";

export const eventController = {
    createEvent: async (req: Request, res: Response) => {
        try {
            let request = req as requestUser
            if (request.user.role != userRoleConstant.I_SUPER_ADMIN) {
                let { event_name, location, start_date, end_date, description, isVirtual, meet_link, event_type, attachments, attachmentsKey, thumbnail, thumbnailKey, additionalUrl, mentorMenteesIds, groupIds, pairIds } = req.body

                // let findEvent = await findOne({ collection: "Event", query: { event_name, isDel: false, end_date: { $gte: new Date() } } })

                // if (findEvent) {
                //     res.status(statusCode.BAD_REQUEST).send(error(errorMessage.ALREADY_EXISTS.replace(":attribute", "Event"), {}, statusCode.BAD_REQUEST));
                //     return
                // }

                let guest: Array<any> = []
                guest = req.body.guest

                let userId = request.user._id

                let obj: any = {
                    event_name,
                    location,
                    start_date,
                    end_date,
                    description,
                    guest,
                    userId,
                    isVirtual,
                    event_type,
                    thumbnail,
                    thumbnailKey,
                    attachments,
                    attachmentsKey,
                    approval: eventStatusConstant.APPROVED,
                    additionalUrl
                }

                if (pairIds) {
                    obj['pairId'] = pairIds
                }
                if (mentorMenteesIds) {
                    obj['mentorMenteeId'] = mentorMenteesIds
                }
                if (groupIds) {
                    obj['groupId'] = groupIds
                }

                if (request.user.role == userRoleConstant.P_SUPER_ADMIN || request.user.role == userRoleConstant.P_LOCAL_ADMIN) {
                    let findPartner = await findOne({ collection: 'User', query: { _id: request.user._id, isDel: false } });

                    if (!findPartner) {
                        res.status(statusCode.BAD_REQUEST).send(error("Current loggedIn user not found.", {}, statusCode.BAD_REQUEST))
                        return
                    }

                    obj['partnerId'] = findPartner.partnerAdmin
                } else if (request.user.role == userRoleConstant.I_LOCAL_ADMIN) {
                    let findLocalAdmin = await findOne({ collection: 'User', query: { _id: request.user._id, isDel: false } })

                    if (!findLocalAdmin) {
                        res.status(statusCode.BAD_REQUEST).send(error("Current loggedIn user not found.", {}, statusCode.BAD_REQUEST))
                        return
                    }
                    obj['regionId'] = findLocalAdmin.region

                }

                if (isVirtual) {
                    obj['meet_link'] = meet_link
                }

                let eventObj = await insertOne({
                    collection: "Event", document: obj
                })

                for (let i = 0; i < guest.length; i++) {
                    const g = guest[i];
                    await insertOne({
                        collection: 'EventGuest', document: {
                            eventId: eventObj._id,
                            userId: g,
                            isActive: true
                        }
                    })
                }

                if (request.user.role == userRoleConstant.P_SUPER_ADMIN || request.user.role == userRoleConstant.P_LOCAL_ADMIN || request.user.role == userRoleConstant.I_LOCAL_ADMIN) {

                    // A common function call to send a notification to the event guest that this event already approved
                    if (new Date(start_date).getTime() > new Date().getTime()) {
                        eventApprovalNotification({ eventId: eventObj._id, isApproved: eventObj.approval, isOnlyGuest: true, loginUser: request.user });
                    }

                }

                res.send(success(successMessage.CREATE_SUCCESS.replace(":attribute", "Event"), { ...eventObj, auditIds: [request.user._id], eventId: eventObj._id, isAuditLog: true, audit: User_Activity.CREATE_NEW_EVENT }));
                return
            } else {
                res.status(statusCode.UNAUTHORIZED).send(error(errorMessage.ACTION.replace(":attribute", request.user.role), {}, statusCode.UNAUTHORIZED));
                return
            }

        } catch (err: any) {
            res.status(statusCode.FORBIDDEN).send(error("There is some issue during creating an Event.", err.message, statusCode.FORBIDDEN))
        }
    },

    uploadAttachmentsInEvent: async (req: Request, res: Response) => {
        try {
            let { eventId, type } = req.body;

            let file = req.file
            const maxSize = uploadConstant.PROFILE_PIC_FILE_SIZE;
            let extArr: Array<string> = []
            if (type == 2) { //2. Event Thumbnail
                extArr = uploadConstant.EVENT_THUMBNAIL_EXT_ARRAY;
            }
            let validateUplaodedFile = await validateFile(req, file, 'eventAttachments', extArr, maxSize)

            if (validateUplaodedFile) {
                res.status(statusCode.BAD_REQUEST).send(error(validateUplaodedFile, {}, statusCode.BAD_REQUEST))
                return
            }

            const uploadFile: any = await uploadToS3(file, 'eventAttachments')

            let uploadedFile: any = {

            }

            uploadedFile['localtion'] = uploadFile.Location;
            uploadedFile['key'] = uploadFile.key
            type = (type == 1) ? "Event Attachments" : 'Event thumbnail'

            res.send(success(successMessage.UPLOAD_SUCCESS.replace(":attribute", type), uploadedFile, statusCode.OK))

        } catch (err: any) {
            res.status(statusCode.FORBIDDEN).send(error("There is some issue during uploading attachments in Event", err.message, statusCode.FORBIDDEN))

        }
    },

    myEvents: async (req: Request, res: Response) => {
        try {
            let request = req as requestUser;

            let userObj = await findOne({ collection: 'User', query: { isDel: false, _id: request.user._id } });

            if (!userObj) {
                res.status(statusCode.UNAUTHORIZED).send(error("Current loggedin user not found", {}, statusCode.UNAUTHORIZED));
                return
            }

            if (request.user.role != userRoleConstant.I_SUPER_ADMIN) {
                let searchQuery: any = {}, sort: any = {}

                sort = req.body.sort

                searchQuery['isDel'] = false;
                searchQuery['userId'] = request.user._id

                if (req.body.isRejectedEvents == true) {
                    searchQuery['approval'] = eventStatusConstant.DECLINED
                }

                if (req.body.search) {
                    searchQuery['event_name'] = new RegExp(req.body.search, 'i')
                }

                if (req.body.startDate && req.body.endDate) {
                    searchQuery['$and'] = [{ start_date: { $gte: moment(req.body.startDate)/* .set({ hour: 0, minute: 0, second: 0 })  */ } }, { start_date: { $lt: moment(req.body.endDate)/* .set({ hour: 23, minute: 59, second: 59 }) */ } }]
                }

                let eventArr = await find({ collection: 'Event', query: searchQuery, populate: [{ path: 'partnerId regionId', select: 'partnerName region' }, { path: 'userId', select: 'legalFname legalLname profilePic' }], sort: { 'createdAt': -1 } });

                let eventResponse: Array<any> = []

                for (let i = 0; i < eventArr.length; i++) {
                    const x = eventArr[i];
                    let findGuest = await find({ collection: 'EventGuest', query: { eventId: x._id }, populate: { path: 'userId', select: 'preferredFname preferredLname profilePic email primaryPhoneNo role' }, project: { '_id': 1, userId: 1, status: 1, attendance: 1 } });
                    (findGuest.length > 0 ? findGuest : []).sort((a: any, b: any) => a?.userId?.preferredFname.localeCompare(b?.userId?.preferredFname, 'es', { sensitivity: 'base' }))
                    eventResponse.push({
                        _id: x._id,
                        name: x.event_name ? x.event_name : '',
                        event_type: x.event_type ? x.event_type : '',
                        endDate: x.end_date ? x.end_date : '',
                        type: (x.isVirtual == true) ? "Online" : 'On-site',
                        thumbnailUrl: x.thumbnail ? x.thumbnail : '',
                        location: x.location ? x.location : '',
                        "partner/region": (x.partnerId && x.partnerId.partnerName) ? x.partnerId.partnerName : (x.regionId && x.regionId.region) ? x.regionId.region : '',
                        createdBy: ((x.userId && x.userId.legalFname) ? x.userId.legalFname : '') + " " + ((x.userId && x.userId.legalLname) ? x.userId.legalLname : ''),
                        profilePic: (x.userId && x.userId.profilePic) ? x.userId.profilePic : "",
                        createdAt: x.createdAt,
                        description: x.description,
                        guests: findGuest.length > 0 ? findGuest : [],
                        meet_link: x.meet_link ? x.meet_link : '',
                        startDate: x.start_date,
                        attachments: (x.attachments && x.attachments.length > 0) ? x.attachments[0] : "",
                        additionalUrl: x.additionalUrl ? x.additionalUrl : ""
                    })
                }

                if (sort && Object.values(sort)[0] == "desc") {
                    let key = Object.keys(sort)[0]
                    eventResponse.sort((a: any, b: any) => descendingSorting(a, b, key))
                }

                if (sort && Object.values(sort)[0] == "asc") {
                    let key = Object.keys(sort)[0]
                    eventResponse.sort((a: any, b: any) => ascendingSorting(a, b, key))
                }

                let page = 1;
                let limit = 10
                if (req.body.limit) {
                    limit = req.body.limit
                }

                let pages = Math.ceil(eventResponse.length / limit);
                let total = eventResponse.length;
                if (req.body.page) {
                    page = req.body.page
                }
                eventResponse = eventResponse.slice((page - 1) * limit, page * limit)

                let result = {
                    docs: eventResponse,
                    page: page,
                    pages,
                    total,
                    limit: limit
                }

                res.send(success(successMessage.FETCH_SUCCESS.replace(":attribute", "MyEvent list"), result))
            } else {
                res.status(statusCode.UNAUTHORIZED).send(error(errorMessage.ACTION.replace(":attribute", request.user.role), {}, statusCode.UNAUTHORIZED))
                return
            }

        } catch (err: any) {
            console.log(err);

            res.status(statusCode.FORBIDDEN).send(error("There is some issue during fetching myEvents.", err.message, statusCode.FORBIDDEN))
        }
    },

    allEventList: async (req: Request, res: Response) => {
        try {
            let request = req as requestUser
            let allEventList: Array<any> = [], searchQuery: any = {}, sortQuery: any = { createdAt: -1 }

            let userObj = await findOne({ collection: 'User', query: { isDel: false, _id: request.user._id } });

            if (!userObj) {
                res.status(statusCode.UNAUTHORIZED).send(error("Current loggedin user not found", {}, statusCode.UNAUTHORIZED));
                return
            }

            if (request.user.role == userRoleConstant.P_SUPER_ADMIN || request.user.role == userRoleConstant.P_LOCAL_ADMIN) {
                searchQuery['partnerId'] = userObj.partnerAdmin
            } else if (request.user.role == userRoleConstant.I_LOCAL_ADMIN) {
                searchQuery['regionId'] = userObj.region
            }

            searchQuery['approval'] = eventStatusConstant.APPROVED
            if (req.body.isRejectedEvents == true) {
                searchQuery['approval'] = eventStatusConstant.DECLINED
                sortQuery = { updatedAt: -1 }
            }

            if (req.body.search) {
                searchQuery['event_name'] = new RegExp(req.body.search, 'i')
            }

            if (req.body.startDate && req.body.endDate) {
                searchQuery['$and'] = [{ start_date: { $gte: moment(req.body.startDate)/* .set({ hour: 0, minute: 0, second: 0 }) */ } }, { start_date: { $lt: moment(req.body.endDate)/* .set({ hour: 23, minute: 59, second: 59 }) */ } }]
            }

            searchQuery['isDel'] = false
            // searchQuery['userId'] = { $nin: [request.user._id] }

            if (request.user.role == userRoleConstant.I_SUPER_ADMIN) {
                allEventList = await find({ collection: 'Event', query: searchQuery, populate: [{ path: 'partnerId regionId', select: 'partnerName region' }, { path: 'userId', select: 'legalFname legalLname preferredFname preferredLname profilePic' }], sort: sortQuery });
            } else {
                allEventList = await find({ collection: 'Event', query: searchQuery, populate: [{ path: 'partnerId regionId', select: 'partnerName region' }, { path: 'userId', select: 'legalFname legalLname preferredFname preferredLname profilePic' }], sort: sortQuery })
            }

            let eventList: Array<any> = [], sort: any = {}
            sort = req.body.sort

            allEventList.forEach(x => {
                eventList.push({
                    _id: x._id,
                    name: x.event_name,
                    event_type: x.event_type ? x.event_type : '',
                    thumbnailUrl: x.thumbnail ? x.thumbnail : '',
                    date: x.start_date,
                    type: (x.isVirtual == true) ? "Online" : 'On-site',
                    location: x.location ? x.location : '',
                    description: x.description,
                    "partner/region": (x.partnerId && x.partnerId.partnerName) ? x.partnerId.partnerName : (x.regionId && x.regionId.region) ? x.regionId.region : '',
                    createdBy: ((x.userId && x.userId.preferredFname) ? x.userId.preferredFname : '') + " " + ((x.userId && x.userId.preferredLname) ? x.userId.preferredLname : ''),
                    profilePic: (x.userId && x.userId.profilePic) ? x.userId.profilePic : '',
                    createdAt: x.createdAt,
                    startDate: x.start_date,
                    endDate: x.end_date,
                    meet_link: x.meet_link ? x.meet_link : '',
                    attachments: (x.attachments && x.attachments.length > 0) ? x.attachments[0] : "",
                    additionalUrl: x.additionalUrl ? x.additionalUrl : "",
                    reason: x.rejectReason ? x.rejectReason : ''
                })
            })

            if (sort && Object.values(sort)[0] == "desc") {
                let key = Object.keys(sort)[0]
                eventList.sort((a: any, b: any) => descendingSorting(a, b, key))
            }

            if (sort && Object.values(sort)[0] == "asc") {
                let key = Object.keys(sort)[0]
                eventList.sort((a: any, b: any) => ascendingSorting(a, b, key))
            }

            let page = 1;
            let limit = 10
            if (req.body.limit) {
                limit = req.body.limit
            }

            let pages = Math.ceil(eventList.length / limit);
            let total = eventList.length;
            if (req.body.page) {
                page = req.body.page
            }
            eventList = eventList.slice((page - 1) * limit, page * limit)

            let result = {
                docs: eventList,
                page: page,
                pages,
                total,
                limit: limit
            }

            res.send(success(successMessage.FETCH_SUCCESS.replace(":attribute", "All Event"), result, statusCode.OK))

        } catch (err: any) {
            res.status(statusCode.FORBIDDEN).send(error("There is some issue during fetching all Event list", err.message, statusCode.FORBIDDEN))
        }
    },

    guestListing: async (req: Request, res: Response) => {
        try {
            let request = req as requestUser

            // if (request.user.role != userRoleConstant.I_SUPER_ADMIN) {
            let searchQuery: any = {}

            let userObj = await findOne({ collection: 'User', query: { isDel: false, _id: request.user._id } });
            if (!userObj) {
                res.status(statusCode.UNAUTHORIZED).send(error("Current loggedin user not found", {}, statusCode.UNAUTHORIZED))
                return
            }

            searchQuery['isDel'] = false;

            if (request.user.role == userRoleConstant.P_SUPER_ADMIN) {
                searchQuery['partnerAdmin'] = userObj.partnerAdmin;
                searchQuery['role'] = { $in: [userRoleConstant.MENTOR, userRoleConstant.P_LOCAL_ADMIN, userRoleConstant.MENTEE] }
            } else if (request.user.role == userRoleConstant.P_LOCAL_ADMIN) {
                searchQuery['partnerAdmin'] = userObj.partnerAdmin;
                searchQuery['role'] = { $in: [userRoleConstant.MENTOR, userRoleConstant.MENTEE] }
            } else if (request.user.role == userRoleConstant.I_LOCAL_ADMIN) {
                searchQuery['region'] = userObj.region;
                searchQuery['role'] = { $in: [userRoleConstant.MENTOR, userRoleConstant.MENTEE] }
            }
            searchQuery['status'] = { $in: [statusType.COMPLETED, statusType.MATCHING, statusType.MATCHED] }
            let userList = await find({ collection: 'User', query: searchQuery });

            let userArr: Array<any> = []

            userList.forEach((x: any) => {
                userArr.push({
                    _id: x._id,
                    role: x.role,
                    preferredFname: x?.preferredFname || '',
                    preferredLname: x?.preferredLname || '',
                    profilePic: (x.profilePic) ? x.profilePic : ""
                })
            })

            let mentorList = userArr.filter((x: any) => { return x.role == userRoleConstant.MENTOR })
            let menteeList = userArr.filter((x: any) => { return x.role == userRoleConstant.MENTEE })

            res.send(success(successMessage.FETCH_SUCCESS.replace(":attribute", 'GuestList'), { userArr, mentorList, menteeList }, statusCode.OK))
            // } else {
            //     res.status(statusCode.UNAUTHORIZED).send(error(errorMessage.ACTION.replace(":attribute", request.user.role), {}, statusCode.UNAUTHORIZED));
            //     return
            // }
        } catch (err: any) {
            res.status(statusCode.FORBIDDEN).send(error("There is some issue while fetching guest list.", err.message, statusCode.FORBIDDEN));
        }
    },

    pendingApprovalEventList: async (req: Request, res: Response) => {
        try {
            let request = req as requestUser

            let userObj = await findOne({ collection: 'User', query: { isDel: false, _id: request.user._id } });
            if (!userObj) {
                res.status(statusCode.UNAUTHORIZED).send(error("Current loggedin user not found", {}, statusCode.UNAUTHORIZED));
                return
            }

            // if (request.user.role != userRoleConstant.I_SUPER_ADMIN) {
            let searchQuery: any = {}, userSearchQuery: any = {}, sortQuery: any = { createdAt: -1 }
            searchQuery['isDel'] = false
            userSearchQuery['isDel'] = false
            if (request.user.role == userRoleConstant.P_SUPER_ADMIN || request.user.role == userRoleConstant.P_LOCAL_ADMIN) {
                // searchQuery['partnerId'] = userObj.partnerAdmin
                userSearchQuery['partnerAdmin'] = userObj.partnerAdmin;
            } else if (request.user.role == userRoleConstant.I_LOCAL_ADMIN) {
                // searchQuery['regionId'] = userObj.region
                userSearchQuery['region'] = userObj.region;
            } else {
                // res.status(statusCode.UNAUTHORIZED).send(error(errorMessage.ACTION.replace(":attirbute", request.user.role), {}, statusCode.UNAUTHORIZED))
                // return
            }

            userSearchQuery['role'] = { $in: [userRoleConstant.MENTOR, userRoleConstant.MENTEE] }

            let userList = await distinct({ collection: 'User', field: '_id', query: userSearchQuery })

            searchQuery['approval'] = eventStatusConstant.PENDING;
            if (req.body.isRejectedEvents == true) {
                searchQuery['approval'] = eventStatusConstant.DECLINED
                sortQuery = { updatedAt: -1 }
            }

            if (req.body.search) {
                searchQuery['event_name'] = new RegExp(req.body.search, 'i')
            }

            searchQuery['userId'] = { $in: userList }

            // searchQuery['role'] = userRoleConstant.MENTOR
            if (req.body.startDate && req.body.endDate) {
                searchQuery['$and'] = [{ start_date: { $gte: moment(req.body.startDate)/* .set({ hour: 0, minute: 0, second: 0 }) */ } }, { start_date: { $lt: moment(req.body.endDate)/* .set({ hour: 23, minute: 59, second: 59 }) */ } }]
            }

            let allEventList = await find({ collection: 'Event', query: searchQuery, populate: [{ path: 'partnerId regionId', select: 'partnerName region' }, { path: 'userId', select: 'legalFname legalLname preferredFname preferredLname profilePic rejectReason' }], sort: sortQuery })

            let eventList: Array<any> = [], sort: any = {}
            sort = req.body.sort
 
            for (let i = 0; i < allEventList.length; i++) {
                const x = allEventList[i];
                let findGuest = await find({ collection: 'EventGuest', query: { eventId: x._id, isDel: false }, populate: { path: 'userId', select: 'preferredFname preferredLname profilePic email primaryPhoneNo role' }, project: { '_id': 1, userId: 1, status: 1, attendance: 1 } });
                (findGuest.length > 0 ? findGuest : []).sort((a: any, b: any) => a?.userId?.preferredFname.localeCompare(b?.userId?.preferredFname, 'es', { sensitivity: 'base' }))
                eventList.push({
                    _id: x._id,
                    name: x.event_name ? x.event_name : '',
                    event_type: x.event_type ? x.event_type : '',
                    dateAndTime: x.start_date ? x.start_date : '',
                    type: (x.isVirtual == true) ? "Online" : 'On-site',
                    thumbnailUrl: x.thumbnail ? x.thumbnail : '',
                    location: x.location ? x.location : '',
                    "partner/region": (x.partnerId && x.partnerId.partnerName) ? x.partnerId.partnerName : (x.regionId && x.regionId.region) ? x.regionId.region : '',
                    createdBy: ((x.userId && x.userId.preferredFname) ? x.userId.preferredFname : '') + " " + ((x.userId && x.userId.preferredLname) ? x.userId.preferredLname : ''),
                    profilePic: (x.userId && x.userId.profilePic) ? x.userId.profilePic : "",
                    createdAt: x.createdAt,
                    description: x.description,
                    guests: findGuest.length > 0 ? findGuest : [],
                    'meet_link': x.meet_link ? x.meet_link : '',
                    startDate: x.start_date,
                    endDate: x.end_date,
                    attachments: (x?.attachments?.length > 0) ? x.attachments[0] : "",
                    additionalUrl: x.additionalUrl ? x.additionalUrl : "",
                    reason: x.rejectReason ? x.rejectReason : ''
                })
            }

            if (sort && Object.values(sort)[0] == "desc") {
                let key = Object.keys(sort)[0]
                eventList.sort((a: any, b: any) => descendingSorting(a, b, key))
            }

            if (sort && Object.values(sort)[0] == "asc") {
                let key = Object.keys(sort)[0]
                eventList.sort((a: any, b: any) => ascendingSorting(a, b, key))
            }

            let page = 1;
            let limit = 10
            if (req.body.limit) {
                limit = req.body.limit
            }

            let pages = Math.ceil(eventList.length / limit);
            let total = eventList.length;
            if (req.body.page) {
                page = req.body.page
            }
            eventList = eventList.slice((page - 1) * limit, page * limit)

            let result = {
                docs: eventList,
                page: page,
                pages,
                total,
                limit: limit
            }

            res.send(success(successMessage.FETCH_SUCCESS.replace(":attribute", 'ApprovalEventList'), result, statusCode.OK))

            // } else {
            //     res.status(statusCode.UNAUTHORIZED).send(error(errorMessage.ACTION.replace(":attribute", request.user.role), {}, statusCode.UNAUTHORIZED));
            //     return
            // }

        } catch (err: any) {
            res.status(statusCode.FORBIDDEN).send(error("There is some issue while fetching approvalEventList.", err.message, statusCode.FORBIDDEN))
        }
    },

    approveOrDeclineEvent: async (req: Request, res: Response) => {
        try {
            let request = req as requestUser;
            // if (request.user.role != userRoleConstant.I_SUPER_ADMIN) {
            let eventObj = await findOne({ collection: 'Event', query: { _id: req.body.eventId, isDel: false, /*approval: eventStatusConstant.PENDING*/ } });

            if (!eventObj) {
                res.status(statusCode.BAD_REQUEST).send(error(errorMessage.NOT_EXISTS.replace(":attribute", 'Event'), {}, statusCode.BAD_REQUEST));
                return
            }

            let approveOrReject = req.body.flag

            let query: any = {}, message: string = "";
            let audit;

            if (approveOrReject == 1) { //1. Approved
                query['approval'] = eventStatusConstant.APPROVED
                query['isActive'] = true
                message = successMessage.APPROVE_SUCESS.replace(":attribute", "Event");
                audit = User_Activity.APPROVED_NEW_EVENT;
            } else {
                query['approval'] = eventStatusConstant.DECLINED;
                query['rejectReason'] = req.body.rejectReason;
                query['isActive'] = false
                message = successMessage.REJECT_SUCCESS.replace(":attribute", "Event")
                audit = User_Activity.REJECTED_NEW_EVENT;

                // if (req.body.rejectReason) {
                //     await sendMsg({
                //         data: {
                //             user_id: request.user._id,
                //             receiverId: eventObj.userId,
                //             message: req.body.rejectReason,
                //             msg_type: msg_Type.MESSAGE,
                //             isReminder: false
                //         }
                //     });
                // }
            }

            await findOneAndUpdate({ collection: 'Event', query: { _id: eventObj._id }, update: { $set: query }, options: { new: true } })


            if (approveOrReject == 1) {
                // Show all guests of the event if approved by the event admin
                await updateMany({
                    collection: 'EventGuest',
                    query: { eventId: eventObj._id, isDel: false },
                    update: { $set: { isActive: true } },
                    options: { new: true }
                });
            } else {
                /* If the event is rejected by the admin then don't show the event to all guests and if there is any notification then delete all notifications 
                related to the event from the guest but don't delete the notifications of the event owner. */
                await updateMany({
                    collection: 'EventGuest',
                    query: { eventId: eventObj._id, isDel: false },
                    update: { $set: { isActive: false } },
                    options: { new: true }
                });

                await updateMany({
                    collection: 'Notification',
                    query: { dataId: eventObj._id, to: { $nin: [eventObj.userId] }, isDel: false },
                    update: { $set: { isDel: true } },
                    options: { new: true }
                });
            }

            // A common function call to send a notification to the event guest that this event has been approved
            eventApprovalNotification({
                eventId: req.body.eventId,
                isApproved: req.body.flag == 1 ? eventStatusConstant.APPROVED : eventStatusConstant.DECLINED,
                loginUser: request.user
            });

            res.send(success(message, { auditIds: [eventObj.userId], eventId: eventObj._id, isAuditLog: true, audit }, statusCode.OK))

            // } else {
            //     res.status(statusCode.UNAUTHORIZED).send(error(errorMessage.ACTION.replace(":attribute", request.user.role), {}, statusCode.UNAUTHORIZED))
            // }
        } catch (err: any) {
            res.status(statusCode.FORBIDDEN).send(error("There is some issue while approve or decline the Event", err.mesage, statusCode.FORBIDDEN))
        }
    },

    editEvent: async (req: Request, res: Response) => {
        try {
            let request = req as requestUser
            let { eventId, event_name, location, start_date, end_date, description, isVirtual, meet_link, event_type, attachments, attachmentsKey, thumbnail, thumbnailKey, additionalUrl, mentorMenteesIds, groupIds, pairIds } = req.body

            let eventObj = await findOne({ collection: "Event", query: { _id: eventId, isDel: false } })
            if (!eventObj) {
                res.status(statusCode.BAD_REQUEST).send(error(errorMessage.NOT_EXISTS.replace(":attribute", 'Event'), {}, statusCode.BAD_REQUEST));
                return
            }

            // let updateEvent: Boolean = true

            // if (eventObj.partnerId && (request.user.role == userRoleConstant.P_SUPER_ADMIN || request.user.role == userRoleConstant.P_LOCAL_ADMIN)) {
            //     updateEvent = true
            // } else if (eventObj.regionId && request.user.role == userRoleConstant.I_LOCAL_ADMIN) {
            //     updateEvent = true
            // } else {
            //     res.status(statusCode.UNAUTHORIZED).send(error(errorMessage.ACTION.replace(":attribute", request.user.role), {}, statusCode.UNAUTHORIZED))
            //     return
            // }

            let guest: Array<any> = []
            guest = req.body.guest

            let obj: any = {
                eventId,
                event_name,
                location,
                start_date,
                end_date,
                description,
                guest,
                isVirtual,
                event_type,
                thumbnail,
                thumbnailKey,
                attachments,
                attachmentsKey,
                meet_link,
                additionalUrl
            }

            if (pairIds) {
                obj['pairId'] = pairIds
            }
            if (mentorMenteesIds) {
                obj['mentorMenteeId'] = mentorMenteesIds
            }
            if (groupIds) {
                obj['groupId'] = groupIds
            }
            // let checkSameNameEventExists = await findOne({ collection: 'Event', query: { event_name, isDel: false, _id: { $nin: [eventId] }, end_date: { $gte: new Date() } } })

            // if (checkSameNameEventExists) {
            //     res.status(statusCode.BAD_REQUEST).send(error(errorMessage.ALREADY_EXISTS.replace(":attribute", 'Event'), {}, statusCode.BAD_REQUEST));
            //     return
            // }
            // if (isVirtual == true) {
            //     obj['meet_link'] = meet_link
            // }

            // if (updateEvent == true) {

            let updateEventObj = await findOneAndUpdate({ collection: "Event", query: { _id: eventObj._id }, update: { $set: obj }, options: { new: true } })

            for (let i = 0; i < guest.length; i++) {
                const g = guest[i];
                let findGuest = await findOne({ collection: 'EventGuest', query: { eventId: eventId, userId: g, isDel: false } })
                if (!findGuest) {
                    await insertOne({
                        collection: 'EventGuest', document: {
                            userId: g,
                            eventId: eventId,
                            isActive: true
                        }
                    })
                }
            }

            // let updateJobsUser: any = guest.filter((value: any) => eventObj?.guest.includes(value));
            // updateEventsJob(updateJobsUser, eventObj?._id?.toString());

            // let removedUser: any = guest.filter((value: any) => !eventObj?.guest.includes(value));
            // removedUserEventsJob(removedUser, eventObj?._id?.toString())

            await deleteMany({ collection: 'EventGuest', query: { eventId: eventId, userId: { $nin: guest } } });

            // A common function call to send a notification to the event guest that this event already approved
            if (new Date(eventObj.end_date).getTime() < new Date().getTime() && new Date(start_date).getTime() > new Date().getTime()) {
                eventApprovalNotification({ eventId: eventObj._id, isApproved: eventObj.approval, isOnlyGuest: true, loginUser: request.user });
            }

            res.send(success("Event has been updated successfully.", { ...updateEventObj, auditIds: [eventObj.userId], eventId: eventObj._id, isAuditLog: true, audit: User_Activity.EVENT_UPDATED }, statusCode.OK))
            // }


        } catch (err: any) {
            res.status(statusCode.FORBIDDEN).send(error("There is some issue while editing the Event", err.mesage, statusCode.FORBIDDEN))
        }
    },

    deleteEvent: async (req: Request, res: Response) => {
        try {
            let eventObj = await findOne({ collection: 'Event', query: { _id: req.body.eventId, isDel: false } });
            let request = req as requestUser
            if (!eventObj) {
                res.status(statusCode.BAD_REQUEST).send(error(errorMessage.NOT_EXISTS.replace(":attribute", "Event"), {}, statusCode.BAD_REQUEST));
                return
            }

            // let eventDelete: Boolean = false

            // if (eventObj.partnerId && (request.user.role == userRoleConstant.P_SUPER_ADMIN || request.user.role == userRoleConstant.P_LOCAL_ADMIN)) {
            //     eventDelete = true
            // } else if (eventObj.regionId && request.user.role == userRoleConstant.I_LOCAL_ADMIN) {
            //     eventDelete = true
            // } else {
            //     res.status(statusCode.UNAUTHORIZED).send(error(errorMessage.ACTION.replace(":attribute", request.user.role), {}, statusCode.UNAUTHORIZED))
            //     return
            // }

            // if (eventDelete == true) {
            /* If the event is deleted by the event owner then don't show the event to all guests and event owner and if there is any notification then delete all notifications 
               related to the event from the guest or event owner. */
            await findOneAndUpdate({ collection: "Event", query: { _id: eventObj._id }, update: { isDel: true }, options: { new: true } });
            await updateMany({ collection: 'EventGuest', query: { eventId: eventObj._id }, update: { isDel: true }, options: { new: true } })
            await updateMany({ collection: 'Notification', query: { dataId: eventObj._id }, update: { isDel: true }, options: { new: true } })
            // await deleteEventAllJob(eventObj?._id?.toString());
            // }
            res.send(success(successMessage.DELETE_SUCCESS.replace(":attribute", 'Event'), { auditIds: [eventObj.userId], eventId: eventObj._id, isAuditLog: true, audit: User_Activity.EVENT_DELETED }, statusCode.OK))
        } catch (err: any) {
            res.status(statusCode.FORBIDDEN).send(error("There is some issue while deleting the event.", err.message, statusCode.FORBIDDEN))
        }
    },

    getEvent: async (req: Request, res: Response) => {
        try {

            let eventObj = await findOne({
                collection: "Event", query: { _id: req.query.eventId, isDel: false }, populate:
                    [
                        { path: 'guest', select: 'preferredFname preferredLname profilePic role' },
                        { path: 'groupId', select: 'groupName' },
                        { path: 'pairId', select: 'mentorId menteeId isConfirm', populate: [{ path: 'mentorId menteeId', select: 'role preferredFname preferredLname profilePic' }] },
                        { path: 'mentorMenteeId', select: 'role preferredFname preferredLname profilePic' }
                    ]
            });
            if (!eventObj) {
                res.status(statusCode.BAD_REQUEST).send(error(errorMessage.NOT_EXISTS.replace(":attribute", 'Event'), {}, statusCode.BAD_REQUEST))
                return
            }

            res.send(success(successMessage.FETCH_SUCCESS.replace(":attrbute", 'Event'), eventObj, statusCode.OK))

        } catch (err: any) {
            res.status(statusCode.FORBIDDEN).send(error("There is some issue in get event", err.mesage, statusCode.FORBIDDEN))
        }
    },
    eventGuestCSV: async (req: Request, res: Response) => {
        try {
            let eventId = req.body.eventId
            let eventObj = await findOne({ collection: 'Event', query: { _id: eventId, isDel: false } });
            if (!eventObj) {
                res.status(statusCode.BAD_REQUEST).send(error(errorMessage.NOT_EXISTS.replace(":attribute", 'Event'), {}, statusCode.BAD_REQUEST))
                return
            }

            let pipeLine: Array<any> = [
                {
                    $match: {
                        eventId: new mongoose.Types.ObjectId(eventId),
                        isDel: false
                    }
                },
                {
                    $lookup: {
                        from: 'users',
                        let: { userId: '$userId' },
                        pipeline: [
                            {
                                $match: {
                                    $expr: {
                                        $eq: ['$_id', '$$userId']
                                    }
                                }
                            },
                            {
                                $project: {
                                    'preferredFname': 1,
                                    "preferredLname": 1,
                                    'role': 1
                                }
                            }
                        ],
                        as: 'userId'
                    }
                },
                { $unwind: '$userId' },
                {
                    $lookup: {
                        from: 'answerbymentors',
                        localField: "userId._id",
                        foreignField: "user",
                        as: 'answerByMentors'
                    }
                },
                // {
                //     $lookup: {
                //         from: 'additionalinfos',
                //         localField: 'userId._id',
                //         foreignField: "userId",
                //         as: 'menteeSchool'
                //     }
                // },
                // {
                //     $unwind: {
                //         path: '$menteeSchool',
                //         preserveNullAndEmptyArrays: true
                //     }
                // },
                {
                    $unwind: {
                        path: '$answerByMentors',
                        preserveNullAndEmptyArrays: true
                    }
                },
                // {
                //     $unwind: {
                //         path: '$answerByMentors.queAns',
                //         preserveNullAndEmptyArrays: true
                //     }
                // },
                // {
                //     $lookup: {
                //         from: 'matches',
                //         localField: 'answerByMentors.queAns.question',
                //         foreignField: '_id',
                //         as: 'answerByMentors.queAns.question'
                //     }
                // },
                // {
                //     $unwind: {
                //         path: '$answerByMentors.queAns.question',
                //         preserveNullAndEmptyArrays: true
                //     }
                // },
                {
                    $group: {
                        _id: "$userId._id",
                        fname: { $first: '$userId.preferredFname' },
                        lname: { $first: '$userId.preferredLname' },
                        role: { $first: '$userId.role' },
                        status: { $first: "$status" },
                        updatedAt: { $first: '$updatedAt' },
                        // answer: {
                        //     $push: {
                        //         $cond: [{ $eq: ['$answerByMentors.queAns.question.question', questionConst.School_Question] }, '$answerByMentors.queAns.answer', []]
                        //     }
                        // },
                        // menteeSchool: { $first: '$menteeSchool.education_level.assignedSchoolOrInstitutions' },
                        attendance: { $first: '$attendance' }
                    }
                },
                // {
                //     $addFields: {
                //         answer:
                //         {
                //             $arrayElemAt: [
                //                 {
                //                     $filter: {
                //                         input: "$answer",
                //                         cond: {
                //                             $ne: ['$$this', []]
                //                         }
                //                     }
                //                 },
                //                 0
                //             ]
                //         }

                //     }
                // },
                // {
                //     $addFields: {
                //         answer: {
                //             $map: {
                //                 input: "$answer",
                //                 as: 'answer',
                //                 in: '$$answer.ans'
                //             }
                //         }
                //     }
                // },
                {
                    $project: {
                        _id: 1,
                        name: { $concat: ['$fname', " ", '$lname'] },
                        role: '$role',
                        // school: {
                        //     $cond: [{ $eq: ['$role', userRoleConstant.MENTOR] }, '$answer', '$menteeSchool']
                        // },
                        status: { $cond: [{ $eq: ['$status', eventStatusConstant.APPROVED] }, "Accepted", "$status"] },
                        "updatedDate": { $cond: [{ $eq: ['$status', eventStatusConstant.PENDING] }, "", "$updatedAt"] },
                        attendance: 1
                    }
                }

            ]

            let eventGuest = await aggregate({ collection: 'EventGuest', pipeline: pipeLine });

            let csvResponse: Array<any> = [];

            eventGuest.forEach(x => {
                csvResponse.push({
                    Name: x.name,
                    Role: x.role,
                    // School: x?.school?.toString() || "",
                    'Attendance Status': x?.attendance || "",
                    "Invitation Status": (x?.status == eventStatusConstant.PENDING) ? "No Response" : x.status,
                    "Updated Date": x.updatedDate,
                })
            });

            (csvResponse.length > 0 ? csvResponse : []).sort((a: any, b: any) => a?.Name.localeCompare(b.Name, 'es', { sensitivity: 'base' }))
            let createdCSV = await exportFileFunction(
                true,
                "eventGuestCSV",
                csvResponse,
                res,
                req
            );
            res.send(success("Event Guest CSV downloaded successfully.", createdCSV))
        } catch (err: any) {
            console.log(err);
            logger.error(`There was an issue into event guest csv download: ${err} `)
            res.status(statusCode.FORBIDDEN).send(error("There is some issue in event guest csv download", err.message, statusCode.FORBIDDEN))
        }
    },

    approveOrDeclineEventGuestList: async (req: Request, res: Response) => {
        try {
            const request = req as requestUser

            const { status, eventId, userId } = req.body

            const eventObj = await findOne({ collection: 'Event', query: { _id: eventId } });

            if (!eventObj) {
                res.status(statusCode.BAD_REQUEST).send(error(errorMessage.NOT_EXISTS.replace(":attribute", "Event"), {}, statusCode.BAD_REQUEST));
                return
            }

            const eventGuestObj = await findOne({ collection: 'EventGuest', query: { eventId, userId } });

            if (!eventGuestObj) {
                res.status(statusCode.BAD_REQUEST).send(error(errorMessage.NOT_EXISTS.replace(":attribute", 'EventGuest'), {}, statusCode.BAD_REQUEST))
                return
            }

            let updateGuestStatus = await findOneAndUpdate({ collection: "EventGuest", query: { _id: eventGuestObj._id }, update: { status: status }, options: { new: true } });

            let message = ""
            if (status == eventStatusConstant.APPROVED) {
                message = successMessage.ACCEPTED_SUCCESS.replace(":attribute", "Invitation")
            } else if (status == eventStatusConstant.DECLINED) {
                message = successMessage.DECLINE_SUCCESS.replace(":attribute", "Invitation")
            } else {
                message = successMessage.UPDATE_SUCCESS.replace(":attribute", "Invitation")
            }

            res.send(success(message, { updateGuestStatus, auditIds: [userId], eventId: eventId, isAuditLog: true, audit: User_Activity.EVENT_GUEST_INVITATION_UPDATE.replace(':attributes', status) }, statusCode.OK))
        } catch (err: any) {
            console.log(err);
            logger.error(`There is some issue while accepting or declining event guest request: ${err}`)
            res.status(statusCode.FORBIDDEN).send(error("There is some issue while accepting or declining event guest request", err.message, statusCode.FORBIDDEN))
        }
    },

    updateAttendanceStatus: async (req: Request, res: Response) => {
        try {

            const { userId, eventId, attendance } = req.body

            const eventObj = await findOne({ collection: 'Event', query: { _id: eventId } });

            if (!eventObj) {
                res.status(statusCode.BAD_REQUEST).send(error(errorMessage.NOT_EXISTS.replace(":attribute", "Event"), {}, statusCode.BAD_REQUEST));
                return
            }

            const eventGuestObj = await findOne({ collection: 'EventGuest', query: { eventId, userId } });

            if (!eventGuestObj) {
                res.status(statusCode.BAD_REQUEST).send(error(errorMessage.NOT_EXISTS.replace(":attribute", 'EventGuest'), {}, statusCode.BAD_REQUEST))
                return
            }

            let updateGuestStatus = await findOneAndUpdate({ collection: "EventGuest", query: { _id: eventGuestObj._id }, update: { attendance: attendance }, options: { new: true } });

            res.send(success(successMessage.UPDATE_SUCCESS.replace(":attribute", "User attendance status"), { ...updateGuestStatus, auditIds: [userId], eventId, isAuditLog: true, audit: User_Activity.EVENT_GUEST_ATTENDANCE_UPDATE.replace(':attributes', attendance) }, statusCode.OK))


        } catch (err: any) {
            logger.error(`There is some issue while updating attendance status.: ${err}`)
            res.status(statusCode.FORBIDDEN).send(error("There is some issue while updating attendace status.", err.message, statusCode.FORBIDDEN))
        }
    },

    getGuestListForEvent: async (req: Request, res: Response) => {
        try {
            let { eventId, search } = req.body

            let eventObj = await findOne({ collection: 'Event', query: { _id: eventId } });

            if (!eventObj) {
                res.status(statusCode.BAD_REQUEST).send(error(errorMessage.NOT_EXISTS.replace(":attribute", 'Event'), {}, statusCode.BAD_REQUEST));
                return
            }



            let pipeLine: Array<any> = [
                {
                    $match: { eventId: eventObj._id }
                },
                {
                    $lookup: {
                        from: 'users',
                        let: { userId: '$userId' },
                        pipeline: [
                            {
                                $match: {
                                    $expr: {
                                        $eq: ['$_id', '$$userId']
                                    }
                                }
                            },
                            {
                                $project: {
                                    legalFname: 1,
                                    legalLname: 1,
                                    preferredFname: 1,
                                    preferredLname: 1,
                                    role: 1,
                                    profilePic: 1,
                                    primaryPhoneNo: 1,
                                    email: 1
                                }
                            }
                        ],
                        as: 'userId'
                    }
                },
                {
                    $unwind: '$userId'
                },
                {
                    $addFields: {
                        name: { $concat: ['$userId.preferredFname', " ", '$userId.preferredLname'] }
                    }
                }
            ]

            if (search) {
                // search = search.replace(/[^\w ]/, '')
                // search = search.split(" ");

                pipeLine.push({
                    $match: {
                        'name': new RegExp(search, 'i'),
                    }
                })

            }

            pipeLine.push(
                {
                    $addFields: {
                        insesitive: {
                            $toLower: '$userId.preferredFname'
                        },
                    },
                },
                {
                    $sort: {
                        "insesitive": 1
                    }
                }
            )

            // let eventGuest = await find({ collection: 'EventGuest', query: { eventId: eventObj._id }, populate: { path: 'userId', select: 'role legalFname legalLname preferredFname preferredLname' } });

            let eventGuest = await aggregate({ collection: 'EventGuest', pipeline: pipeLine });

            (eventGuest.length > 0 ? eventGuest : []).sort((a: any, b: any) => a?.name.localeCompare(b.name, 'es', { sensitivity: 'base' }))

            res.send(success(successMessage.FETCH_SUCCESS.replace(":attribute", 'GuestList'), eventGuest, statusCode.OK))
        } catch (err: any) {
            res.status(statusCode.FORBIDDEN).send(error("There is some issue while fetching guestList for events", err.message, statusCode.FORBIDDEN))
        }
    },

    eventCSV: async (req: Request, res: Response) => {
        try {
            const { eventType, isRejectedEvents, sort, search } = req.body
            const request = req as requestUser

            let eventQuery: any = { isDel: false }, userSearchQuery: any = { isDel: false }, sortQuery: any = { createdAt: -1 };

            if (request.user.partnerAdmin) {
                eventQuery['partnerId'] = request.user.partnerAdmin
                userSearchQuery['partnerAdmin'] = request.user.partnerAdmin
            } else if (request.user.region) {
                eventQuery['regionId'] = request.user.region
                userSearchQuery['region'] = request.user.region
            }

            if (search) {
                eventQuery['event_name'] = new RegExp(search, 'i')
            }

            let eventList: Array<any> = [], csvResponse: Array<any> = [];
            if (eventType == "All Events") {
                eventQuery['approval'] = eventStatusConstant.APPROVED

                if (isRejectedEvents == true) {
                    eventQuery['approval'] = eventStatusConstant.DECLINED;
                    sortQuery = { updatedAt: -1 }
                }

                eventList = await find({ collection: 'Event', query: eventQuery, populate: [{ path: 'partnerId regionId', select: 'partnerName region' }, { path: 'userId', select: 'preferredFname preferredLname' }], sort: sortQuery })

                eventList.forEach((x: any) => {
                    csvResponse.push({
                        EventName: x.event_name,
                        Date: moment(x.start_date).format('MM/DD/YYYY'),
                        EventTime: `${moment(x.start_date).format('hh:mm A')} - ${moment(x.end_date).format('hh:mm A')}`,
                        Type: (x.isVirtual == true) ? "Online" : "On-Site",
                        Location: (x.isVirtual == true) ? x.meet_link : x.location,
                        "Partner/Region": (x.partnerId) ? x.partnerId.partnerName : x.regionId ? x.regionId.region : "",
                        CreatedBy: (x.userId) ? `${x.userId.preferredFname} ${x.userId.preferredLname}` : "",
                        EventType: x?.event_type || "",
                        CreatedOn: moment(x.createdAt).format('MM/DD/YYYY')
                    })
                })

                if (isRejectedEvents == true) {
                    csvResponse = eventList.map(({ rejectReason }, i) => ({ ...csvResponse[i], RejectReason: rejectReason }))
                }
            } else if (eventType == "PendingApproval Events") {
                userSearchQuery['role'] = { $in: [userRoleConstant.MENTEE, userRoleConstant.MENTOR] };

                eventQuery['approval'] = eventStatusConstant.PENDING

                if (isRejectedEvents == true) {
                    eventQuery['approval'] = eventStatusConstant.DECLINED
                    sortQuery = { updatedAt: -1 }
                }

                let userArr = await distinct({ collection: 'User', field: "_id", query: userSearchQuery });

                eventQuery['userId'] = { $in: userArr }

                eventList = await find({ collection: "Event", query: eventQuery, populate: [{ path: 'partnerId regionId', select: 'partnerName region' }, { path: 'userId', select: 'preferredFname preferredLname' }], sort: sortQuery })

                eventList.forEach((x: any) => {
                    csvResponse.push({
                        EventName: x.event_name,
                        Date: moment(x.start_date).format('MM/DD/YYYY'),
                        EventTime: `${moment(x.start_date).format('hh:mm A')} - ${moment(x.end_date).format('hh:mm A')}`,
                        Type: (x.isVirtual == true) ? "Online" : "On-Site",
                        Location: (x.isVirtual == true) ? x.meet_link : x.location,
                        "Partner/Region": (x.partnerId) ? x.partnerId.partnerName : x.regionId ? x.regionId.region : "",
                        CreatedBy: (x.userId) ? `${x.userId.preferredFname} ${x.userId.preferredLname}` : "",
                        CreatedOn: moment(x.createdAt).format('MM/DD/YYYY')
                    })
                })

                if (isRejectedEvents == true) {
                    csvResponse = eventList.map(({ rejectReason }, i) => ({ ...csvResponse[i], RejectReason: rejectReason }))
                }
            } else {
                eventQuery['userId'] = request.user._id;

                if (isRejectedEvents == true) {
                    eventQuery['approval'] = eventStatusConstant.DECLINED
                    sortQuery = { updatedAt: -1 }
                }

                eventList = await find({ collection: 'Event', query: eventQuery, populate: [{ path: 'partnerId regionId', select: 'partnerName region' }, { path: 'userId', select: 'preferredFname preferredLname' }], sort: sortQuery })

                eventList.forEach((x: any) => {
                    csvResponse.push({
                        EventName: x.event_name,
                        Date: moment(x.start_date).format('MM/DD/YYYY'),
                        EventTime: `${moment(x.start_date).format('hh:mm A')} - ${moment(x.end_date).format('hh:mm A')}`,
                        Type: (x.isVirtual == true) ? "Online" : "On-Site",
                        Location: (x.isVirtual == true) ? x.meet_link : x.location,
                        "Partner/Region": (x.partnerId) ? x.partnerId.partnerName : x.regionId ? x.regionId.region : "",
                        CreatedBy: (x.userId) ? `${x.userId.preferredFname} ${x.userId.preferredLname}` : "",
                        EventType: x?.event_type || "",
                        CreatedOn: moment(x.createdAt).format('MM/DD/YYYY')
                    })
                })

                if (isRejectedEvents == true) {
                    csvResponse = eventList.map(({ rejectReason }, i) => ({ ...csvResponse[i], RejectReason: rejectReason }))
                }
            }

            let sortKey: Array<any> = ['name', 'startDate', 'type', 'location', 'event_type', 'createdAt'];

            let csvKey: Array<any> = ['EventName', 'Date', 'Type', 'Location', 'EventType', 'CreatedAt']

            if (sort && Object.values(sort)[0] == "desc") {
                let key = Object.keys(sort)[0]
                let findIndex = sortKey.findIndex(value => { return value == key })
                csvResponse.sort((a: any, b: any) => descendingSorting(a, b, csvKey[findIndex]))
            }

            if (sort && Object.values(sort)[0] == "asc") {
                let key = Object.keys(sort)[0]
                let findIndex = sortKey.findIndex(value => { return value == key })
                csvResponse.sort((a: any, b: any) => ascendingSorting(a, b, csvKey[findIndex]))
            }

            let createdCSV = await exportFileFunction(
                true,
                'eventsCSV',
                csvResponse,
                res,
                req
            )

            res.send(success("Event csv downloaded successfully", createdCSV))
        } catch (err: any) {
            logger.error(`There is some issue while downloading event csv.: ${err.message}`)
            res.status(statusCode.FORBIDDEN).send(error("There is some issue while downloading event csv.", err.message, statusCode.FORBIDDEN))
        }
    },

    eventGuestListV2: async (req: Request, res: Response) => {
        try {
            let request = req as requestUser

            let userQuery: any = {
                isDel: false,
                role: { $in: [userRoleConstant.MENTEE, userRoleConstant.MENTOR] },
                status: { $nin: [userStatusConstant.draft, userStatusConstant.REJECT, userStatusConstant.invited, userStatusConstant.PENDING] }
            }, query: any = { isDel: false }, pairQuery: any = { isConfirm: true, isDel: false }
            if (request.user.partnerAdmin) {
                userQuery['partnerAdmin'] = request.user.partnerAdmin
                query['partner'] = request.user.partnerAdmin
                pairQuery['partnerIdOrRegionId'] = request.user.partnerAdmin
            } else if (request.user.region) {
                userQuery['region'] = request.user.region
                query['region'] = request.user.region
                pairQuery['partnerIdOrRegionId'] = request.user.region
            }
            if (req.body.eventId) {
                let eventObj = await findOne({ collection: 'Event', query: { _id: req.body.eventId, isDel: false } });

                if (!eventObj) {
                    res.status(statusCode.BAD_REQUEST).send(error(errorMessage.NOT_EXISTS.replace(":attribute", 'Event'), {}, statusCode.BAD_REQUEST))
                    return
                }

                if (eventObj.partnerId) {
                    userQuery['partnerAdmin'] = eventObj.partnerId
                    query['partner'] = eventObj.partnerId
                    pairQuery['partnerIdOrRegionId'] = eventObj.partnerId
                } else if (eventObj.regionId) {
                    userQuery['region'] = eventObj.regionId
                    query['region'] = eventObj.regionId
                    pairQuery['partnerIdOrRegionId'] = eventObj.regionId
                }
            }


            let userArr = await find({ collection: 'User', query: userQuery, project: { preferredFname: 1, preferredLname: 1, role: 1, profilePic: 1 } });

            let pairArr = await find({
                collection: 'PairInfo', query: pairQuery,
                populate: {
                    path: 'mentorId menteeId',
                    select: 'preferredFname preferredLname role profilePic'
                },
                project: {
                    mentorId: 1, menteeId: 1, isConfirm: 1
                }
            })

            let groupArr = await find({ collection: "Group", query: query });

            let list: any = {}

            list.userArr = userArr;
            list.pairArr = pairArr.map((x: any) => { return { ...x, role: "Pair" } })
            list.groupArr = groupArr.map((x: any) => { return { ...x, role: "Group" } })

            let allList = userArr.concat(pairArr);
            allList = allList.concat(groupArr);

            list.allList = allList

            res.send(success(successMessage.FETCH_SUCCESS.replace(":attribute", "Guest List"), list, statusCode.OK));


        } catch (err: any) {
            logger.error(`There is issue in fetching Guest list: ${err.message}`)
            res.status(statusCode.FORBIDDEN).send(error("There is issue in fetching Guest list", err.message, statusCode.FORBIDDEN))
        }
    }
}