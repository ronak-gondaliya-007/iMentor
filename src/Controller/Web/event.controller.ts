import { Request, Response } from "express";
import {
    aggregate,
    countDocuments,
    deleteMany,
    deleteOne,
    find,
    findOne,
    findOneAndUpdate,
    insertOne,
    updateMany
} from "../../utils/db";
import {
    userRoleConstant,
    errorMessage,
    statusCode,
    successMessage,
    uploadEventConstant,
    event_status,
    notificationType,
    eventStatusConstant,
    badges,
    badge_type,
    notificationMessage,
    userStatusConstant
} from "../../utils/const";
import { success, error } from "../../utils/helpers/resSender";
import { logger } from "../../utils/helpers/logger";
import { requestUser } from "../../Interfaces/schemaInterfaces/user";
import { updateGuestList } from "../../utils/helpers/common";
import { uploadToS3, validateFile } from "../../middleware/multer";
import { sendEventForApprovalNotification, sendNotification, sendPushNotification } from "./notification.controller";
import mongoose from "mongoose";
// import { Badge } from "../../Bull/Queues/badge.queue";
// import { badgeJobRemove, deleteEventAllJob } from "../../Bull/Processors/badge.processor";

export let eventController = {

    /* Add or schedule new event function */
    scheduleNewEvent: async (req: Request, res: Response) => {
        try {
            const request = req as requestUser;

            const {
                event_name,
                location,
                isVirtual,
                meet_link,
                start_date,
                end_date,
                guest,
                description,
                isDraft,
                attachments,
                attachmentsKey,
                thumbnail,
                thumbnailKey,
                additionalURL
            } = req.body;

            let getPartnerId = await findOne({ collection: 'User', query: { _id: request.user._id, isDel: false } });

            if (!getPartnerId) {
                res.status(statusCode.OK).send(error("Current loggedIn user not found.", {}, statusCode.NOT_FOUND))
                return
            }

            // let eventObj = await findOne({ collection: 'Event', query: { event_name, isDel: false, end_date: { $gte: new Date() } } });

            // if (eventObj) {
            //     res.status(statusCode.BAD_REQUEST).send(error(errorMessage.ALREADY_EXISTS.replace(":attribute", "Event"), {}, statusCode.BAD_REQUEST));
            //     return
            // }
            let mentorMenteeId = guest

            const scheduleNewEvent = await insertOne({
                collection: "Event",
                document: {
                    userId: request.user._id,
                    event_name,
                    location,
                    isVirtual,
                    meet_link,
                    start_date,
                    end_date,
                    guest,
                    description,
                    isDraft,
                    attachments,
                    attachmentsKey,
                    thumbnail,
                    thumbnailKey,
                    additionalURL,
                    partnerId: getPartnerId?.partnerAdmin || null,
                    regionId: getPartnerId?.region || null,
                    mentorMenteeId
                }
            });

            // If user create first event than send system badge
            // updateFirstEventSystemBadge({ data: request.user, type: "FER" });

            // Send event for admin approval 
            sendEventForApprovalNotification({ eventId: scheduleNewEvent._id });

            for (let index = 0; index < guest.length; index++) {
                const element = guest[index];

                await insertOne({
                    collection: "EventGuest",
                    document: {
                        eventId: scheduleNewEvent._id,
                        userId: element
                    }
                });
            }

            res.status(statusCode.OK).send(success("Scheduled Event Successfully.", { scheduleNewEvent }, statusCode.OK));

        } catch (err: any) {
            logger.error(`There was an issue into scheduled new event.: ${err}`)
            res.status(statusCode.FORBIDDEN).send(error("There was an issue into scheduled new event.", err.message, statusCode.FORBIDDEN))
        }
    },

    /* Draft schedule event function */
    draftScheduleEvent: async (req: Request, res: Response) => {
        try {
            const request = req as requestUser;

            const scheduleEvent = await findOne({
                collection: "Event",
                query: { userId: request.user._id, isDraft: true }
            });

            if (!scheduleEvent) {
                res.status(statusCode.OK).send(error(errorMessage.NOT_EXISTS.replace(":attribute", 'Event'), {}, statusCode.NOT_FOUND))
                return
            }

            const getGuests = await find({
                collection: "EventGuest",
                query: { eventId: scheduleEvent._id, isDel: false },
                populate: [
                    {
                        path: "userId",
                        select: "legalFname legalLname preferredFname preferredLname profilePic role"
                    }
                ]
            });

            scheduleEvent.guest = getGuests;

            res.status(statusCode.OK).send(success("Draft Scheduled Event Successfully.", { scheduleEvent }, statusCode.OK));

        } catch (err: any) {
            logger.error(`There was an issue into edit scheduled event.: ${err}`)
            res.status(statusCode.FORBIDDEN).send(error("There was an issue into edit scheduled event.", err.message, statusCode.FORBIDDEN))
        }
    },

    /* Edit schedule event function */
    editScheduleEvent: async (req: Request, res: Response) => {
        try {
            const request = req as requestUser;

            const { event_id } = req.body;

            const scheduleEvent = await findOne({
                collection: "Event",
                query: { _id: event_id, isDel: false }
            });

            if (!scheduleEvent) {
                res.status(statusCode.OK).send(error(errorMessage.NOT_EXISTS.replace(":attribute", 'Event'), {}, statusCode.NOT_FOUND))
                return
            }

            const getGuests = await find({
                collection: "EventGuest",
                query: { eventId: event_id, isDel: false },
                populate: [
                    {
                        path: "userId",
                        select: "legalFname legalLname preferredFname preferredLname profilePic role"
                    }
                ]
            });

            scheduleEvent.guest = getGuests;

            res.status(statusCode.OK).send(success("Edit Scheduled Event Successfully.", { scheduleEvent }, statusCode.OK));

        } catch (err: any) {
            logger.error(`There was an issue into edit scheduled event.: ${err}`)
            res.status(statusCode.FORBIDDEN).send(error("There was an issue into edit scheduled event.", err.message, statusCode.FORBIDDEN))
        }
    },

    /* Update schedule event function */
    updateScheduleEvent: async (req: Request, res: Response) => {
        try {
            const request = req as requestUser;

            const {
                event_id,
                event_name,
                location,
                isVirtual,
                meet_link,
                start_date,
                end_date,
                duration,
                guest,
                description,
                isDraft,
                attachments,
                attachmentsKey,
                thumbnail,
                thumbnailKey,
                approval,
                additionalURL
            } = req.body;

            const getEvent = await findOne({
                collection: "Event",
                query: { _id: event_id, isDel: false }
            });

            if (!getEvent) {
                res.status(statusCode.OK).send(error(errorMessage.NOT_EXISTS.replace(":attribute", 'Event'), {}, statusCode.NOT_FOUND))
                return
            }

            // Update guest list common function use
            updateGuestList({ guest, event_id, status: false });

            const updateScheduleEvent = await findOneAndUpdate({
                collection: "Event",
                query: { _id: event_id },
                update: {
                    $set: {
                        event_name,
                        location,
                        isVirtual,
                        meet_link,
                        start_date,
                        end_date,
                        duration,
                        guest,
                        description,
                        isDraft,
                        attachments,
                        attachmentsKey,
                        thumbnail,
                        thumbnailKey,
                        additionalURL,
                        isActive: false,
                        approval: event_status.PENDING
                    }
                },
                options: { new: true }
            });

            // Send event for admin approval 
            sendEventForApprovalNotification({ eventId: event_id });

            // await deleteEventAllJob(event_id);

            res.status(statusCode.OK).send(success("Update Scheduled Event Successfully.", { updateScheduleEvent }, statusCode.OK));

        } catch (err: any) {
            logger.error(`There was an issue into update scheduled event.: ${err}`)
            res.status(statusCode.FORBIDDEN).send(error("There was an issue into update scheduled event.", err.message, statusCode.FORBIDDEN))
        }
    },

    /* Delete schedule event function */
    deleteScheduleEvent: async (req: Request, res: Response) => {
        try {
            const request = req as requestUser;

            const { event_id } = req.body;

            const scheduleEvent = await findOne({
                collection: "Event",
                query: { _id: event_id, isDel: false }
            });

            if (!scheduleEvent) {
                res.status(statusCode.OK).send(error(errorMessage.NOT_EXISTS.replace(":attribute", 'Event'), {}, statusCode.NOT_FOUND))
                return
            }

            const deleteScheduleEvent = await findOneAndUpdate({
                collection: "Event",
                query: { _id: event_id },
                update: {
                    $set: { isDel: true }
                },
                options: { new: true }
            });

            await updateMany({
                collection: "EventGuest",
                query: { eventId: event_id },
                update: { $set: { isDel: true } },
                options: { new: true }
            });

            await updateMany({
                collection: "Notification",
                query: { dataId: event_id },
                update: { $set: { isDel: true } },
                options: { new: true }
            });

            // await deleteEventAllJob(event_id);

            res.status(statusCode.OK).send(success("Delete Scheduled Event Successfully.", { deleteScheduleEvent }, statusCode.OK));

        } catch (err: any) {
            logger.error(`There was an issue into delete scheduled event.: ${err}`)
            res.status(statusCode.FORBIDDEN).send(error("There was an issue into delete scheduled event.", err.message, statusCode.FORBIDDEN))
        }
    },

    /* Mentor under Mentees list function */
    getGuestList: async (req: Request, res: Response) => {
        try {
            const request = req as requestUser;

            const { search } = req.body;

            let query: any = {};
            let project: any = {};

            if (request.user.role == userRoleConstant.MENTOR) {
                query = { $and: [{ mentorId: request.user._id }, { isDel: false }, { isConfirm: true }, { isArchive: false }] };
                project = { mId: "$menteeId" };
            } else {
                query = { $and: [{ menteeId: request.user._id }, { isDel: false }, { isConfirm: true }, { isArchive: false }] }
                project = { mId: "$mentorId" };
            }

            let GuestArray = await find({
                collection: "PairInfo",
                query,
                project
            });

            const guest: any = [];
            GuestArray.map((ele: any) => {
                guest.push(ele.mId)
            });

            const matchQuery: any = [];

            matchQuery.push(
                {
                    $match: {
                        _id: { $in: guest },
                        status: userStatusConstant.Matched
                    }
                },
                {
                    $project: {
                        _id: 1,
                        legalFname: 1,
                        legalLname: 1,
                        role: 1,
                        profilePic: 1,
                        preferredFname: 1,
                        preferredLname: 1
                    }
                }
            )

            if (search) {
                matchQuery.push(
                    {
                        $addFields: {
                            user_name: {
                                '$concat': ['$preferredFname', ' ', '$preferredFname']
                            },
                            reverseUsername: {
                                '$concat': ['$preferredFname', ' ', '$preferredFname']
                            },
                            preferredFname: "$preferredFname",
                            preferredLname: "$preferredLname",
                        }
                    },
                    {
                        $match: {
                            $or: [
                                { user_name: { $regex: '.*' + search + '.*', $options: 'i' } },
                                { reverseUsername: { $regex: '.*' + search + '.*', $options: 'i' } },
                                { preferredFname: { $regex: '.*' + search + '.*', $options: 'i' } },
                                { preferredLname: { $regex: '.*' + search + '.*', $options: 'i' } }
                            ]
                        }
                    }
                )
            }

            let GuestList = await aggregate({
                collection: "User",
                pipeline: matchQuery
            });

            if (GuestList.length == 0) {
                res.status(statusCode.OK).send(success(successMessage.NOT_FOUND.replace(":attribute", "Guest list"), GuestList, statusCode.NOT_FOUND));
                return
            }

            res.status(statusCode.OK).send(success(successMessage.FETCH_SUCCESS.replace(":attribute", "Guest list"), {
                GuestList,
                totalGuest: GuestArray.length
            }, statusCode.OK));

        } catch (err: any) {
            logger.error(`There was an issue into get guest list.: ${err}`)
            res.status(statusCode.FORBIDDEN).send(error("There was an issue into get guest list.", err.message, statusCode.FORBIDDEN))
        }
    },

    /* Mentor invited Mentees list function */
    getInvitedGuestList: async (req: Request, res: Response) => {
        try {
            const request = req as requestUser;

            const { search, eventId } = req.body;

            const matchQuery: any = [];

            matchQuery.push(
                {
                    $match: {
                        eventId: new mongoose.Types.ObjectId(eventId),
                        isDel: false
                    }
                },
                {
                    $lookup: {
                        from: "users",
                        localField: "userId",
                        foreignField: "_id",
                        as: "users"
                    }
                },
                { $unwind: "$users" },
                {
                    $project: {
                        _id: "$users._id",
                        legalFname: "$users.legalFname",
                        legalLname: "$users.legalLname",
                        role: "$users.role",
                        profilePic: "$users.profilePic",
                        preferredFname: "$users.preferredFname",
                        preferredLname: "$users.preferredLname"
                    }
                }
            )

            if (search) {
                matchQuery.push(
                    {
                        $addFields: {
                            user_name: {
                                '$concat': ['$users.preferredFname', ' ', '$users.preferredLname']
                            },
                            reverseUsername: {
                                '$concat': ['$users.preferredLname', ' ', '$users.preferredFname']
                            },
                            preferredFname: "$users.preferredFname",
                            preferredLname: "$users.preferredLname"
                        }
                    },
                    {
                        $match: {
                            $or: [
                                { user_name: { $regex: '.*' + search + '.*', $options: 'i' } },
                                { reverseUsername: { $regex: '.*' + search + '.*', $options: 'i' } },
                                { preferredFname: { $regex: '.*' + search + '.*', $options: 'i' } },
                                { preferredLname: { $regex: '.*' + search + '.*', $options: 'i' } }
                            ]
                        }
                    }
                )
            }

            let InvitedGuestList = await aggregate({
                collection: "EventGuest",
                pipeline: matchQuery
            });

            if (InvitedGuestList.length == 0) {
                res.status(statusCode.OK).send(success(successMessage.NOT_FOUND.replace(":attribute", "Guest list"), InvitedGuestList, statusCode.NOT_FOUND));
                return
            }

            res.status(statusCode.OK).send(success(successMessage.FETCH_SUCCESS.replace(":attribute", "Guest list"), InvitedGuestList, statusCode.OK));

        } catch (err: any) {
            logger.error(`There was an issue into get guest list.: ${err}`)
            res.status(statusCode.FORBIDDEN).send(error("There was an issue into get guest list.", err.message, statusCode.FORBIDDEN))
        }
    },

    /* Schedule event detail function */
    getScheduledEvent: async (req: Request, res: Response) => {
        try {
            const { eventId } = req.body;

            const getScheduledEventDetail = await findOne({
                collection: "Event",
                query: { _id: eventId, isDel: false },
                populate: [
                    {
                        path: "userId",
                        select: "userId legalFname legalLname preferredFname preferredLname role profilePic profilePicKey"
                    }
                ]
            });

            if (!getScheduledEventDetail) {
                res.status(statusCode.OK).send(success(successMessage.NOT_FOUND.replace(":attribute", "Scheduled event"), {}, statusCode.NOT_FOUND));
                return
            }

            const getScheduledEventGuestList = await find({
                collection: "EventGuest",
                query: { eventId: eventId, isDel: false },
                project: { status: 1 },
                populate: [
                    {
                        path: "userId",
                        select: "legalFname legalLname preferredFname preferredLname role profilePic profilePicKey"
                    }
                ]
            });

            getScheduledEventDetail.guestList = getScheduledEventGuestList;

            if (getScheduledEventDetail.isVirtual == true) {
                getScheduledEventDetail.event_type = "Online"
            } else {
                getScheduledEventDetail.event_type = "Offline"
            }

            res.status(statusCode.OK).send(success(successMessage.FETCH_SUCCESS.replace(":attribute", "Scheduled event"), { scheduledEvent: getScheduledEventDetail }, statusCode.OK));

        } catch (err: any) {
            logger.error(`There was an issue into get scheduled event.: ${err}`)
            res.status(statusCode.FORBIDDEN).send(error("There was an issue into get scheduled event.", err.message, statusCode.FORBIDDEN))
        }
    },

    /* Schedule event list function */
    scheduleEventList: async (req: Request, res: Response) => {
        try {
            const request = req as requestUser;

            var { search, event_type, isExpired, page, limit } = req.body;

            var skip;
            var limit = limit ? limit : 10;
            if (!page) {
                skip = 0
            } else {
                skip = (page - 1) * limit;
            }

            console.log(isExpired);

            let query: any = [];
            let countQuery: any = [];
            if (event_type == "myEvent") {

                const getApprovedEvent = await find({
                    collection: "EventGuest",
                    query: {
                        userId: request.user._id,
                        status: eventStatusConstant.APPROVED,
                        isDel: false,
                        isActive: true
                    }
                });

                const event: any = [];
                getApprovedEvent.map((ele: any) => {
                    event.push(ele.eventId)
                });

                if (isExpired) {
                    query.push(
                        {
                            $match: {
                                $and: [
                                    {
                                        $or: [{
                                            userId: new mongoose.Types.ObjectId(request.user._id),
                                            isDel: false,
                                            isDraft: false
                                        }, { _id: { $in: event }, isDel: false, isDraft: false }]
                                    },
                                    { end_date: { $lt: new Date() } }
                                ]
                            }
                        }
                    )
                } else {
                    query.push(
                        {
                            $match: {
                                $or: [
                                    {
                                        userId: new mongoose.Types.ObjectId(request.user._id),
                                        end_date: { $gte: new Date() },
                                        isDel: false,
                                        isDraft: false
                                    },
                                    { _id: { $in: event }, end_date: { $gte: new Date() }, isDel: false, isDraft: false }
                                ],
                            }
                        }
                    )
                }


                query.push(
                    {
                        $addFields: {
                            approval: {
                                $cond: {
                                    if: { $lte: ["$end_date", new Date()] }, // Check if endDate is less than or equal to current date
                                    then: "Ended", // Set approval to "Ended"
                                    else: "$approval" // Keep the existing value of approval if condition is false
                                }
                            },
                            isAdminAccess: {
                                $cond: {
                                    if: {
                                        $in: ["$_id", event]
                                    },
                                    then: false,
                                    else: true
                                }
                            }
                        }
                    }
                )
            }

            if (event_type == "favorite") {

                const favoriteList = await find({
                    collection: "EventGuest",
                    query: {
                        userId: new mongoose.Types.ObjectId(request.user._id),
                        isActive: true,
                        isDel: false,
                        isFavorite: true
                    }
                });

                const events: any = [];
                favoriteList.map((ele: any) => {
                    events.push(ele.eventId)
                });

                if (isExpired) {
                    query.push({ $match: { $and: [{ _id: { $in: events } }, { end_date: { $lt: new Date() } }] } });
                } else {
                    query.push({ $match: { $and: [{ _id: { $in: events } }, { end_date: { $gte: new Date() } }] } });
                }
            }

            if (event_type == "") {

                if (isExpired) {
                    query.push({
                        $match: {
                            guest: { $in: [new mongoose.Types.ObjectId(request.user._id)] },
                            approval: eventStatusConstant.APPROVED,
                            isDel: false,
                            end_date: { $lt: new Date() }
                        }
                    });
                } else {
                    query.push({
                        $match: {
                            guest: { $in: [new mongoose.Types.ObjectId(request.user._id)] },
                            approval: eventStatusConstant.APPROVED,
                            isDel: false,
                            end_date: { $gte: new Date() }
                        }
                    });
                }
            }

            if (search) {
                query.push(
                    {
                        $match: {
                            event_name: { $regex: '.*' + search + '.*', $options: 'i' }
                        }
                    }
                )
            }

            query.push(
                {
                    $sort: {
                        start_date: 1
                    }
                }
            );

            countQuery.push(...query);

            query.push(
                { $skip: skip },
                { $limit: limit }
            );

            if (event_type != "myEvent") {
                query.push(
                    {
                        $lookup: {
                            from: "eventguests",
                            let: { evId: "$_id", uId: new mongoose.Types.ObjectId(request.user._id) },
                            pipeline: [
                                {
                                    $match: {
                                        $expr: {
                                            $and: [
                                                { $eq: ["$$evId", "$eventId"] },
                                                { $eq: ["$$uId", "$userId"] }
                                            ]
                                        }
                                    }
                                }
                            ],
                            as: "eventGuest"
                        }
                    },
                    { $unwind: "$eventGuest" },
                    {
                        $project: {
                            event_name: "$event_name",
                            location: "$location",
                            meet_link: "$meet_link",
                            start_date: "$start_date",
                            end_date: "$end_date",
                            attachments: "$attachments",
                            attachmentsKey: "$attachmentsKey",
                            thumbnail: "$thumbnail",
                            thumbnailKey: "$thumbnailKey",
                            isActive: "$eventGuest.isActive",
                            event_type: { $cond: { if: "$isVirtual", then: "Online", else: "Offline" } },
                            isFavorite: "$eventGuest.isFavorite",
                            userId: "$eventGuest.userId",
                            status: "$eventGuest.status"
                        }
                    }
                );
            }

            const getScheduledEventCount = aggregate({
                collection: "Event",
                pipeline: countQuery
            });

            const getScheduledEvent = aggregate({
                collection: "Event",
                pipeline: query
            });

            const responses: any = await Promise.allSettled([getScheduledEventCount, getScheduledEvent]);

            const response = {
                page: page || 1,
                limit: limit,
                pages: Math.ceil(responses[0].value?.length / limit),
                total: responses[0].value?.length,
                scheduledEvent: responses[1].value
            };

            if (!responses[1].value) {
                res.status(statusCode.OK).send(success(successMessage.NOT_FOUND.replace(":attribute", "Scheduled event"), response, statusCode.NOT_FOUND));
                return
            }

            res.status(statusCode.OK).send(success(successMessage.FETCH_SUCCESS.replace(":attribute", "Scheduled event"), response, statusCode.OK));

        } catch (err: any) {
            logger.error(`There was an issue into scheduled event list.: ${err}`)
            res.status(statusCode.FORBIDDEN).send(error("There was an issue into scheduled event list.", err.message, statusCode.FORBIDDEN))
        }
    },

    /* Favorite event function */
    addInFavoriteEvent: async (req: Request, res: Response) => {
        try {
            const request = req as requestUser;

            const { eventId } = req.body;

            const eventExists = await findOne({
                collection: "Event",
                query: { _id: eventId }
            });

            if (!eventExists) {
                res.status(statusCode.OK).send(success(successMessage.NOT_FOUND.replace(":attribute", "Event"), {}, statusCode.NOT_FOUND));
                return
            }

            const verifyFavorite = await findOne({
                collection: "EventGuest",
                query: { userId: request.user._id, eventId: eventId, isDel: false }
            });

            if (!verifyFavorite) {
                res.status(statusCode.OK).send(success(successMessage.NOT_FOUND.replace(":attribute", "Guest"), {}, statusCode.NOT_FOUND));
                return
            }

            if (verifyFavorite.isFavorite == true) {

                const unfavorite = await findOneAndUpdate({
                    collection: "EventGuest",
                    query: { userId: request.user._id, eventId: eventId },
                    update: { $set: { isFavorite: false } },
                    options: { new: true }
                });

                res.status(statusCode.OK).send(success(successMessage.FEVORITE_SUCCESS.replace(":attribute", "Scheduled event"), { favorite: false }, statusCode.OK));

            } else if (verifyFavorite.isFavorite == false) {

                const favorite = await findOneAndUpdate({
                    collection: "EventGuest",
                    query: { userId: request.user._id, eventId: eventId },
                    update: { $set: { isFavorite: true } },
                    options: { new: true }
                });

                res.status(statusCode.OK).send(success(successMessage.FEVORITE_SUCCESS.replace(":attribute", "Scheduled event"), { favorite: true }, statusCode.OK));

            }

        } catch (err: any) {
            logger.error(`There was an issue into add in favorite event.: ${err}`)
            res.status(statusCode.FORBIDDEN).send(error("There was an issue into add in favorite event.", err.message, statusCode.FORBIDDEN))
        }
    },

    /* Event attachment file upload function */
    uploadEventAttachment: async (req: Request, res: Response) => {
        try {
            const { type } = req.body;

            const file = req.file;
            const maxSize = uploadEventConstant.FILE_SIZE;
            let extArr: string[] = [];
            ;
            if (type == "attachment") {
                extArr = uploadEventConstant.EVENT_ATTACHMENT_EXT_ARRAY;
            } else if (type == "thumbnail") {
                extArr = uploadEventConstant.EVENT_THUMBNAIL_EXT_ARRAY;
            }

            // validate file
            const isValidFile = await validateFile(res, file, 'eventAttachment', extArr, maxSize);

            if (isValidFile !== undefined && isValidFile) {
                res.status(statusCode.OK).send(error(isValidFile, {}, statusCode.BAD_REQUEST))
                return
            }

            const uploadFile: any = await uploadToS3(file, 'eventAttachment');

            const uploadedAttachment: any = {};

            if (uploadFile) {
                if (type == "attachment") {
                    uploadedAttachment.attachments = uploadFile.Location;
                    uploadedAttachment.attachmentsKey = uploadFile.key;
                } else if (type == "thumbnail") {
                    uploadedAttachment.thumbnail = uploadFile.Location;
                    uploadedAttachment.thumbnailKey = uploadFile.key;
                }
            } else {
                if (type == "attachment") {
                    uploadedAttachment.attachments = [];
                    uploadedAttachment.attachmentsKey = [];
                } else if (type == "thumbnail") {
                    uploadedAttachment.thumbnail = '';
                    uploadedAttachment.thumbnailKey = '';
                }
            }

            res.status(statusCode.OK).send(success(successMessage.UPLOAD_SUCCESS.replace(':attribute', `${type}`), uploadedAttachment, statusCode.OK))

        } catch (err) {
            logger.error(`There was an issue into upload event attachment.: ${err} `)
            res.status(statusCode.FORBIDDEN).send(error("There was an issue into upload event attachment", err, statusCode.FORBIDDEN))
        }
    },

    /* Event guest approval function */
    eventGuestApproval: async (req: Request, res: Response) => {
        try {
            const request = req as requestUser;

            const { eventId, isApproved } = req.body;

            const user = findOne({ collection: 'User', query: { _id: request.user._id, isDel: false } });
            const eventExists = findOne({
                collection: 'Event',
                query: { _id: eventId, isDel: false, isDraft: false, approval: event_status.APPROVED }
            });

            const resp: any = await Promise.allSettled([user, eventExists]);

            if (!resp[1].value) {
                res.status(statusCode.OK).send(error(errorMessage.NOT_EXISTS.replace(':attribute', 'event'), {}, statusCode.NOT_FOUND))
                return
            }

            let eventStatus;
            let push_content;
            if (isApproved == false) {
                eventStatus = event_status.DECLINED
                push_content = `Your ${resp[0].value.role?.toLowerCase()} ${resp[0].value.preferredFname} ${resp[0].value.preferredLname} has declined the event ${resp[1].value.event_name}.`
            } else if (isApproved == true) {
                eventStatus = event_status.APPROVED
                push_content = `Your ${resp[0].value.role?.toLowerCase()} ${resp[0].value.preferredFname} ${resp[0].value.preferredLname} has accepted the event ${resp[1].value.event_name}.`
            }

            /* If the event guest accepts or declines the event invitation, update the status of that particular guest event approval. */
            const eventStatusUpdate = await findOneAndUpdate({
                collection: 'EventGuest',
                query: {
                    eventId: eventId,
                    userId: request.user._id,
                    isDel: false,
                    isActive: true
                },
                update: {
                    $set: {
                        status: eventStatus
                    }
                },
                options: { new: true }
            });

            /* If event guest accept or decline event invitation than remove that particular guest event notification. */
            const updateNotification = findOneAndUpdate({
                collection: "Notification",
                query: {
                    dataId: eventId,
                    to: request.user._id?.toString(),
                    isDel: false,
                    type: notificationType.EVENT_INVITED
                },
                update: { $set: { isDel: true } },
                options: { new: true }
            });

            const updateApprovalNotification = findOneAndUpdate({
                collection: "Notification",
                query: {
                    dataId: eventId,
                    from: request.user._id?.toString(),
                    isDel: false,
                    type: { $in: [notificationType.INVITATION_APPROVED, notificationType.INVITATION_DECLINE] }
                },
                update: { $set: { isDel: true } },
                options: { new: true }
            });

            const myBadges = find({
                collection: "AchievedBadges",
                query: {
                    senderId: null,
                    receiverId: request.user._id,
                    type: badge_type.SYSTEM,
                    badgeName: { $in: [badges.FTM, badges.HFMU] }
                }
            });

            const response: any = await Promise.allSettled([updateNotification, myBadges, updateApprovalNotification]);

            let dataObj: any = {
                dataId: resp[1].value._id,
                eventUserId: resp[1].value.userId,
                sendTo: [resp[1].value.userId],
                userId: resp[0].value._id,
                user_role: resp[0].value.role,
                type: isApproved ? notificationType.INVITATION_APPROVED : notificationType.INVITATION_DECLINE,
                content: ""
            };
            await sendNotification(dataObj);
            const badgeCounts = await countDocuments({
                collection: 'Notification',
                query: { to: resp[1].value.userId, read: false }
            });
            dataObj.badgeCounts = badgeCounts;
            dataObj.content = push_content;
            dataObj.profileImage = resp[0].value.profilePic ?? "";
            sendPushNotification(dataObj);

            // let isFirstMeet = false;
            // let isFifthMeet = false;
            // response[1].value?.map((ele: any) => {
            //     if (ele?.badgeName === badges.FTM) {
            //         isFirstMeet = true;
            //     }
            //     if (ele?.badgeName === badges.HFMU) {
            //         isFifthMeet = true;
            //     }
            // });

            // if (!isApproved) {
            //     await badgeJobRemove(eventStatusUpdate?._id?.toString())
            // }

            // if (isApproved && !isFirstMeet || isApproved && !isFifthMeet) {
            //     var options = {
            //         delay: new Date(new Date(resp[1].value?.end_date).getTime() - new Date().getTime()).getTime(),
            //         attempts: 1,
            //         jobId: eventStatusUpdate?._id
            //     };
            //     Badge.add({
            //         eventId: resp[1].value?._id,
            //         eventName: resp[1].value?.event_name,
            //         userId: request.user._id,
            //         startDate: resp[1].value?.start_date,
            //         endDate: resp[1].value?.end_date
            //     }, options);
            // }

            return res.status(statusCode.OK).send(success(successMessage.UPDATE_SUCCESS.replace(':attribute', "Event invitation"), eventStatusUpdate, statusCode.OK))

        } catch (err: any) {
            logger.error(`There was an issue into event guest approval.: ${err} `)
            return res.status(statusCode.FORBIDDEN).send(error("There was an issue into event guest approval", { err }, statusCode.FORBIDDEN))
        }
    }
};