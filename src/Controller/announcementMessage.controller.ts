import { Request, Response } from "express";
import {
    distinct,
    find,
    findOne,
    findOneAndUpdate,
    insertMany,
    insertOne,
    updateMany,
    paginate,
    aggregate,
    ObjectId,
    deleteMany,
    deleteOne,
    countDocuments,
    updateOne
} from "../utils/db";
import {
    announcementTypeConstant,
    categoryOfQuestion,
    errorMessage,
    messageConstant,
    notificationMessage,
    notificationType,
    statusCode,
    successMessage,
    uploadConstant,
    userRoleConstant,
    userStatusConstant
} from "../utils/const";
import { success, error } from "../utils/helpers/resSender";
import { logger } from "../utils/helpers/logger";
import { requestUser } from "../Interfaces/schemaInterfaces/user";
import { ascendingSorting, descendingSorting } from "../utils/helpers/functions";
import { sendNotification, sendPushNotification } from "./Web/notification.controller";

export let announcementController = {

    addAnnouncementMessage: async (req: any, res: Response) => {
        try {
            const { sendTo, message, sendToType, isDraft } = req.body;

            const request = req as requestUser;
            const sendFrom = request.user._id;
            let query: any = {
                sendTo: sendTo,
                sendFrom: sendFrom,
                sendToType: sendToType,
                message: message,
                isDraft: isDraft,
            }

            // if (request.user.region) {
            //     query['regionId'] = request.user.region
            //     query['partnerIdOrRegionId'] = request.user.region
            // } else if (request.user.partnerAdmin) {
            //     query['partnerId'] = request.user.partnerAdmin;
            //     query['partnerIdOrRegionId'] = request.user.partnerAdmin
            // } else {
            //     res.status(statusCode.UNAUTHORIZED).send(error(errorMessage.ACTION.replace(":attribute", request.user.role), {}, statusCode.UNAUTHORIZED));
            //     return
            // }

            const addBroadCastMessage = await insertOne({
                collection: 'Announcement', document: query
            })

            res.send(success(successMessage.SEND_SUCCESS.replace(':attribute', "Broadcast message"), addBroadCastMessage, statusCode.OK))
        } catch (err) {
            logger.error(`There was an issue into create broadcast message.: ${err}`)
            res.status(statusCode.FORBIDDEN).send(error(err))
        }
    },

    getAnnouncementMessage: async (req: any, res: Response) => {
        try {
            const { search, sendToType, isDraft, page, limit, sort } = req.body;
            let request = req as requestUser;
            let query: any = { $and: [{ isDraft: isDraft }, { isDelete: false }] }

            if (request.user.region) {
                query['regionId'] = request.user.region
            } else if (request.user.partnerAdmin) {
                query['partnerId'] = request.user.partnerAdmin
            }

            if (search) {
                query.$and.push({
                    message: { $regex: new RegExp(search, 'i') }
                })

            }

            if (sendToType?.length > 0) {
                query.$and.push({
                    sendToType: { $in: sendToType }
                })
            }

            const getBroadCastMessage = await paginate({
                collection: 'Announcement',
                query: query,
                options: {
                    populate: [{
                        path: 'sendTo sendFrom',
                        select: 'legalFname legalLname preferredFname preferredLname profilePic role'
                    }, { path: 'groups' }, {
                        path: 'pairs',
                        select: 'menteeId mentorId',
                        populate: {
                            path: 'menteeId mentorId',
                            select: 'legalFname legalLname preferredFname preferredLname profilePic role'
                        }
                    }],
                    page, limit, sort: { createdAt: -1 }
                }
            });
            let introductoryMessage;
            if (request.user.region) {
                introductoryMessage = await findOne({
                    collection: 'Region',
                    query: { _id: request.user.region, isDel: false, isIntroductoryMessage: true },
                    project: { introductoryMessage: 1 }
                })
            }

            if (request.user.partnerAdmin) {
                introductoryMessage = await findOne({
                    collection: 'Partner',
                    query: { _id: request.user.partnerAdmin, isDel: false, isIntroductoryMessage: true },
                    project: { introductoryMessage: 1 }
                })
            }

            getBroadCastMessage.introductoryMessage = introductoryMessage?.introductoryMessage;

            if (sort && Object.values(sort)[0] == "desc") {
                let key = Object.keys(sort)[0]
                getBroadCastMessage.docs.sort((a: any, b: any) => descendingSorting(a, b, key))
            }

            if (sort && Object.values(sort)[0] == "asc") {
                let key = Object.keys(sort)[0]
                getBroadCastMessage.docs.sort((a: any, b: any) => ascendingSorting(a, b, key))
            }

            res.send(success(successMessage.FETCH_SUCCESS.replace(':attribute', "Broadcast message"), getBroadCastMessage, statusCode.OK))
        } catch (err) {
            logger.error(`There was an issue into get broadcast message.: ${err} `)
            res.status(statusCode.FORBIDDEN).send(error(err))
        }
    },

    getSingleAnnoucemnt: async (req: any, res: Response) => {
        try {
            const { announcementId } = req.body;

            const isAnnouncementExists = await findOne({
                collection: 'Announcement',
                query: { _id: announcementId, isDelete: false },
                populate: [{
                    path: 'sendTo sendFrom',
                    select: 'legalFname legalLname preferredFname preferredLname profilePic role'
                }]
            });

            if (!isAnnouncementExists) {
                res.status(statusCode.BAD_REQUEST).send(error(errorMessage.NOT_EXISTS.replace(':attribute', 'announcement'), {}, statusCode.BAD_REQUEST))
                return
            }

            res.send(success(successMessage.FETCH_SUCCESS.replace(':attribute', "Broadcast message"), isAnnouncementExists, statusCode.OK))
        } catch (err) {
            logger.error(`There was an issue into get broadcast message.: ${err} `)
            res.status(statusCode.FORBIDDEN).send(error(err))
        }
    },

    updateAnnouncementMessage: async (req: any, res: Response) => {
        try {
            const { announcementId, sendTo, groups, pairs, message, sendToType, isDraft, isIntroductory } = req.body;
            const request = req as requestUser;
            const sendFrom = request.user._id;
            const isAnnouncementExists = await findOne({ collection: 'Announcement', query: { _id: announcementId } });

            if (!isAnnouncementExists) {
                res.status(statusCode.BAD_REQUEST).send(error(errorMessage.NOT_EXISTS.replace(':attribute', 'announcement'), {}, statusCode.BAD_REQUEST))
                return
            }

            let query: any = { $and: [] };
            if (request.user.region) {
                query['regionId'] = request.user.region
                query['partnerIdOrRegionId'] = request.user.region
            } else if (request.user.partnerAdmin) {
                query['partnerId'] = request.user.partnerAdmin;
                query['partnerIdOrRegionId'] = request.user.partnerAdmin
            } else {
                res.status(statusCode.UNAUTHORIZED).send(error(errorMessage.ACTION.replace(":attribute", request.user.role), {}, statusCode.UNAUTHORIZED));
                return
            }

            const addBroadCastMessage = await findOneAndUpdate({
                collection: 'Announcement', query: { _id: announcementId }, update: {
                    $set: {
                        sendTo: sendTo,
                        sendFrom: sendFrom,
                        sendToType: sendToType,
                        message: message,
                        pairs: pairs,
                        groups: groups,
                        isDraft: isDraft
                    }
                }
            });

            const removeSendUser = isAnnouncementExists.sendTo?.filter((item: any) => !sendTo.includes(item?.toString()));

            if (removeSendUser.length) {
                await updateMany({
                    collection: 'Messages',
                    query: { announcementId: announcementId, receiverId: { $in: removeSendUser } },
                    update: { $set: { isDel: true } },
                    options: { new: true }
                });
                await updateMany({
                    collection: 'Notification',
                    query: { dataId: announcementId, to: { $in: removeSendUser } },
                    update: { $set: { isDel: true } },
                    options: { new: true }
                });
            }

            let userArr: Array<any> = []
            if (sendToType == announcementTypeConstant.MENTEE || sendToType == announcementTypeConstant.MENTOR) {
                userArr = sendTo

            } else if (sendToType == announcementTypeConstant.GROUP) {
                let groupList = await distinct({ collection: "Group", field: 'groupMember', query: { _id: groups } })
                userArr = groupList
            } else if (sendToType == announcementTypeConstant.PAIR) {
                const mentors = await distinct({ collection: 'PairInfo', field: 'mentorId', query: { _id: pairs } });
                const mentees = await distinct({ collection: 'PairInfo', field: 'menteeId', query: { _id: pairs } });

                userArr = mentors.concat(mentees);
                console.log(userArr);
                // return false;
            } else if (sendToType == announcementTypeConstant.MIX) {
                let userId = [];

                // Mentor and Mentees
                for (let index = 0; index < sendTo.length; index++) {
                    userId.push(sendTo[index].toString())
                }

                // Pairs
                // const Users = await distinct({ collection: 'PairInfo', field: 'menteeId mentorId', query: { _id: pairs } });
                const menteeId = await distinct({ collection: 'PairInfo', field: 'menteeId', query: { _id: pairs } });
                const mentorId = await distinct({ collection: 'PairInfo', field: 'mentorId', query: { _id: pairs } });

                for (let index = 0; index < menteeId.length; index++) {
                    userId.push(menteeId[index].toString())
                }
                for (let index = 0; index < mentorId.length; index++) {
                    userId.push(mentorId[index].toString())
                }

                // Groups
                const Groups = await distinct({ collection: 'Group', field: 'groupMember', query: { _id: groups } });
                for (let index = 0; index < Groups.length; index++) {
                    userId.push(Groups[index].toString())
                }

                userArr = [...new Set(userId)]
            }
            // return false
            // console.log(data);
            for (let i = 0; i < userArr.length; i++) {
                const send = userArr[i];
                let alreadyAnnouncementExists = await findOne({ collection: 'Messages', query: { announcementId: announcementId, receiverId: send } })
                if (!alreadyAnnouncementExists) {
                    await insertOne({
                        collection: 'Messages', document: {
                            senderId: sendFrom,
                            receiverId: send,
                            announcementId: announcementId,
                            message: message,
                            msg_type: messageConstant.announcementMessage,
                            isReminder: false
                        }
                    })
                } else {
                    await updateOne({
                        collection: 'Messages',
                        query: { announcementId: announcementId, receiverId: { $in: send } },
                        update: { $set: { message: message } },
                        options: { new: true }
                    });
                }
            }

            let notification = {
                userId: sendFrom,
                user_role: request.user.role,
                sendTo: userArr,
                to_type: sendToType,
                type: notificationType.ANNOUNCEMENT,
                content: notificationMessage.updateAnnouncement
            }

            sendNotification(notification);
            sendPushNotification(notification);

            res.send(success(successMessage.UPDATE_SUCCESS.replace(':attribute', "Announcement message"), addBroadCastMessage, statusCode.OK))
        } catch (err) {
            logger.error(`There was an issue into update announcement message.: ${err} `)
            res.status(statusCode.FORBIDDEN).send(error(err))
        }
    },

    deleteAnnouncementMessage: async (req: any, res: Response) => {
        try {
            const { announcementId } = req.body;
            const request = req as requestUser;

            const isAnnouncementExists = await findOne({ collection: 'Announcement', query: { _id: announcementId } });

            if (!isAnnouncementExists) {
                res.status(statusCode.BAD_REQUEST).send(error(errorMessage.NOT_EXISTS.replace(':attribute', 'announcement'), {}, statusCode.BAD_REQUEST))
                return
            }

            let query: any = { $and: [] };
            if (request.user.region) {
                query['regionId'] = request.user.region
                query['partnerIdOrRegionId'] = request.user.region
            } else if (request.user.partnerAdmin) {
                query['partnerId'] = request.user.partnerAdmin;
                query['partnerIdOrRegionId'] = request.user.partnerAdmin
            } else {
                res.status(statusCode.UNAUTHORIZED).send(error(errorMessage.ACTION.replace(":attribute", request.user.role), {}, statusCode.UNAUTHORIZED));
                return
            }

            const deleteAnnouncement = await findOneAndUpdate({
                collection: 'Announcement',
                query: { _id: announcementId },
                update: { $set: { isDelete: true } }
            })

            await updateMany({
                collection: 'Messages',
                query: { announcementId: announcementId, isDel: false },
                update: { $set: { isDel: true } },
                options: { new: true }
            });

            await updateMany({
                collection: 'Notification',
                query: { dataId: announcementId, isDel: false },
                update: { $set: { isDel: true } },
                options: { new: true }
            });

            res.send(success("Announcement has been deleted successfully.", deleteAnnouncement, statusCode.OK))
        } catch (err) {
            logger.error(`There was an issue into update announcement message.: ${err} `)
            res.status(statusCode.FORBIDDEN).send(error(err))
        }
    },

    getRecipientList: async (req: any, res: Response) => {
        try {
            const { search } = req.body;
            const request = req as requestUser;

            let query: any = { $and: [] };

            if (search) {
                query.$and.push({ message: { $regex: new RegExp('^' + search + '', 'i') } })
            }

            let userQuery: any = {
                role: [userRoleConstant.MENTOR, userRoleConstant.MENTEE],
                isDel: false,
                status: { $nin: [userStatusConstant.draft, userStatusConstant.REJECT, userStatusConstant.invited, userStatusConstant.PENDING] }
            };

            if (request.user.partnerAdmin) {
                userQuery["partnerAdmin"] = request.user.partnerAdmin
                query.$and.push({ partner: request.user.partnerAdmin })
            }
            if (request.user.region) {
                userQuery["region"] = request.user.region
                query.$and.push({ region: request.user.region })
            }

            if (search) {
                userQuery = {
                    ...userQuery,
                    userQuery: {
                        message: { $regex: new RegExp('^' + search + '', 'i') }
                    }
                }
            }

            const getRecipientList = await find({ collection: 'User', query: userQuery });

            const getGroupList = await find({ collection: 'Group', query: { ...query, isDel: false } });

            const pairList = await find({
                collection: 'PairInfo',
                query: {
                    partnerIdOrRegionId: request.user.partnerAdmin ?? request.user.region,
                    isConfirm: true, isDel: false
                },
                populate: {
                    path: 'menteeId mentorId',
                    select: 'legalFname legalLName preferredFname preferredLname profilePic role'
                }
            })

            let list: any = {};
            list.recipientList = getRecipientList;
            list.groupList = getGroupList;
            list.pair = pairList;

            let allList = getRecipientList.concat(getGroupList);
            allList = allList.concat(pairList)
            list.allList = allList;

            res.send(success(successMessage.FETCH_SUCCESS.replace(':attribute', "Broadcast message"), list, statusCode.OK))
        } catch (err) {
            logger.error(`There was an issue into get broadcast message.: ${err} `)
            res.status(statusCode.FORBIDDEN).send(error(err))
        }
    },

    sendMessage: async (req: Request, res: Response) => {
        try {
            let { message, sendToType, sendTo, pairs, groups, isDraft, announcementId } = req.body;
            const request = req as requestUser;
            const sendFrom = request.user._id;

            let query: any = {
                sendTo: sendTo,
                sendFrom: sendFrom,
                sendToType: sendToType,
                message: message,
                pairs: pairs,
                groups: groups,
                isDraft: isDraft,
            }

            if (request.user.region) {
                query['regionId'] = request.user.region
                query['partnerIdOrRegionId'] = request.user.region
            } else if (request.user.partnerAdmin) {
                query['partnerId'] = request.user.partnerAdmin;
                query['partnerIdOrRegionId'] = request.user.partnerAdmin
            } else {
                res.status(statusCode.UNAUTHORIZED).send(error(errorMessage.ACTION.replace(":attribute", request.user.role), {}, statusCode.UNAUTHORIZED));
                return
            }

            if (announcementId) {
                const deleteAnnouncement = await deleteOne({
                    collection: 'Announcement',
                    query: { _id: announcementId, isDraft: true }
                })
            } else {
                var addAnnouncement = await insertOne({
                    collection: 'Announcement',
                    document: query
                })
                announcementId = addAnnouncement._id;
            }

            let messages = "The message has been saved as a draft";

            if (!isDraft) {
                if (sendToType === announcementTypeConstant.MENTOR || sendToType === announcementTypeConstant.MENTEE) {

                    let documents = []

                    for (let index = 0; index < sendTo.length; index++) {
                        documents.push({
                            senderId: sendFrom,
                            receiverId: sendTo[index],
                            announcementId: announcementId,
                            message: message,
                            msg_type: messageConstant.announcementMessage,
                            isReminder: false
                        })
                    }

                    await insertMany({ collection: 'Messages', documents: documents });

                    let notification = {
                        userId: sendFrom,
                        user_role: request.user.role,
                        sendTo: sendTo,
                        to_type: sendToType,
                        dataId: announcementId,
                        type: notificationType.ANNOUNCEMENT,
                        content: notificationMessage.announcement
                    }

                    sendNotification(notification);
                    sendPushNotification(notification);

                } else if (sendToType === announcementTypeConstant.GROUP) {

                    const Users = await distinct({ collection: 'Group', field: 'groupMember', query: { _id: groups } });

                    let documents = []
                    for (let index = 0; index < Users.length; index++) {
                        documents.push({
                            senderId: sendFrom,
                            receiverId: Users[index],
                            announcementId: announcementId,
                            message: message,
                            msg_type: messageConstant.announcementMessage,
                            isReminder: false
                        })
                    }

                    await insertMany({ collection: 'Messages', documents: documents });

                    let notification = {
                        userId: sendFrom,
                        user_role: request.user.role,
                        sendTo: Users,
                        to_type: sendToType,
                        dataId: announcementId,
                        type: notificationType.ANNOUNCEMENT,
                        content: notificationMessage.announcement
                    }

                    sendNotification(notification);
                    sendPushNotification(notification);

                } else if (sendToType === announcementTypeConstant.PAIR) {
                    const mentors = await distinct({ collection: 'PairInfo', field: 'mentorId', query: { _id: pairs } });
                    const mentees = await distinct({ collection: 'PairInfo', field: 'menteeId', query: { _id: pairs } });

                    const users = mentors.concat(mentees);

                    let documents = []
                    for (let index = 0; index < users.length; index++) {
                        documents.push({
                            senderId: sendFrom,
                            receiverId: users[index],
                            announcementId: announcementId,
                            message: message,
                            msg_type: messageConstant.announcementMessage,
                            isReminder: false
                        })
                    }
                    await insertMany({ collection: 'Messages', documents: documents });

                    let notification = {
                        userId: sendFrom,
                        user_role: request.user.role,
                        sendTo: users,
                        to_type: sendToType,
                        dataId: announcementId,
                        type: notificationType.ANNOUNCEMENT,
                        content: notificationMessage.announcement
                    }

                    sendNotification(notification);
                    sendPushNotification(notification);

                } else if (sendToType === announcementTypeConstant.MIX) {

                    let documents = [];
                    let userId = [];

                    // Mentor and Mentees
                    for (let index = 0; index < sendTo.length; index++) {
                        userId.push(sendTo[index].toString())
                    }

                    // Pairs
                    // const Users = await distinct({ collection: 'PairInfo', field: 'menteeId mentorId', query: { _id: pairs } });
                    const menteeId = await distinct({ collection: 'PairInfo', field: 'menteeId', query: { _id: pairs } });
                    const mentorId = await distinct({ collection: 'PairInfo', field: 'mentorId', query: { _id: pairs } });

                    for (let index = 0; index < menteeId.length; index++) {
                        userId.push(menteeId[index].toString())
                    }
                    for (let index = 0; index < mentorId.length; index++) {
                        userId.push(mentorId[index].toString())
                    }

                    // Groups
                    const Groups = await distinct({ collection: 'Group', field: 'groupMember', query: { _id: groups } });
                    for (let index = 0; index < Groups.length; index++) {
                        userId.push(Groups[index].toString())
                    }

                    const allUser = [...new Set(userId)]

                    for (let index = 0; index < allUser.length; index++) {
                        documents.push({
                            senderId: sendFrom,
                            receiverId: allUser[index],
                            message: message,
                            announcementId: announcementId,
                            msg_type: messageConstant.announcementMessage,
                            isReminder: false
                        })
                    }
                    await insertMany({ collection: 'Messages', documents: documents });

                    let notification = {
                        userId: sendFrom,
                        user_role: request.user.role,
                        sendTo: allUser,
                        to_type: sendToType,
                        dataId: announcementId,
                        type: notificationType.ANNOUNCEMENT,
                        content: notificationMessage.announcement
                    }

                    sendNotification(notification);
                    sendPushNotification(notification);
                }

                messages = "The message has been successfully sent"
            }

            res.send(success(messages, addAnnouncement, statusCode.OK))
        } catch (err) {
            logger.error(`There was an issue into send message.: ${err} `)
            res.status(statusCode.FORBIDDEN).send(error("There was an issue into send message.", err))
        }
    },

    changeDraftStatus: async (req: Request, res: Response) => {
        try {
            const { announcementId, isDraft } = req.body;

            const request = req as requestUser;

            const isAnnouncementExists = await findOne({ collection: 'Announcement', query: { _id: announcementId } })

            if (!isAnnouncementExists) {
                res.status(statusCode.BAD_REQUEST).send(error(errorMessage.NOT_EXISTS.replace(':attribute', 'announcement'), {}, statusCode.BAD_REQUEST))
                return
            }

            let query: any = { $and: [] };
            if (request.user.region) {
                query['regionId'] = request.user.region
                query['partnerIdOrRegionId'] = request.user.region
                query['_id'] = announcementId
            } else if (request.user.partnerAdmin) {
                query['partnerId'] = request.user.partnerAdmin;
                query['partnerIdOrRegionId'] = request.user.partnerAdmin
                query['_id'] = announcementId
            } else {
                res.status(statusCode.UNAUTHORIZED).send(error(errorMessage.ACTION.replace(":attribute", request.user.role), {}, statusCode.UNAUTHORIZED));
                return
            }

            let message = successMessage.UPDATE_SUCCESS.replace(':attribute', "announcement");
            if (isDraft) {
                message = "The message has been saved as a draft"
            }

            const updateStatus = await findOneAndUpdate({
                collection: 'Announcement',
                query: query,
                update: { $set: { isDraft: isDraft } }
            })
            res.send(success(message, updateStatus, statusCode.OK))
        } catch (err) {
            logger.error(`There was an issue into update announcement.: ${err} `)
            res.status(statusCode.FORBIDDEN).send(error("There was an issue into update announcement.", err))
        }
    },

    addIntroductoryMessage: async (req: Request, res: Response) => {
        try {
            let request = req as requestUser;

            let { isIntroductoryMessage, introductoryMessage } = req.body

            let message = "";
            if (isIntroductoryMessage) {
                message = "Intro message has been changed"
            } else {
                message = "Intro message has been disabled"
            }
            if (request.user.region || request.user.role == userRoleConstant.I_SUPER_ADMIN) {
                await findOneAndUpdate({
                    collection: 'Region',
                    query: { _id: request.user.region, isDel: false },
                    update: {
                        isIntroductoryMessage: isIntroductoryMessage,
                        introductoryMessage: introductoryMessage
                    },
                    options: {
                        new: true,
                        upsert: true
                    }
                })
            } else if (request.user.partnerAdmin || request.user.role == userRoleConstant.I_SUPER_ADMIN) {
                await findOneAndUpdate({
                    collection: 'Partner',
                    query: { _id: request.user.partnerAdmin, isDel: false },
                    update: {
                        isIntroductoryMessage: isIntroductoryMessage,
                        introductoryMessage: introductoryMessage
                    },
                    options: {
                        new: true,
                        upsert: true
                    }
                })
            } else {
                res.status(statusCode.UNAUTHORIZED).send(error(errorMessage.ACTION.replace(":attribute", request.user.role), {}, statusCode.UNAUTHORIZED));
                return
            }
            res.send(success(message, {}, statusCode.OK));
        } catch (err: any) {
            logger.error(`There was an issue while adding introductory message.: ${err} `)
            res.status(statusCode.FORBIDDEN).send(error("There was an issue while adding introductory message.", err, statusCode.FORBIDDEN))
        }
    }
}

