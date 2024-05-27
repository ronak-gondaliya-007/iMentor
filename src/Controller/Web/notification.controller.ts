import * as admin from 'firebase-admin';
import { aggregate, countDocuments, findOne, insertOne, updateMany, find, distinct } from "../../utils/db";
import {
    errorMessage,
    eventStatusConstant,
    notificationMessage,
    notificationType,
    statusCode,
    userRoleConstant
} from "../../utils/const";
import { logger } from "../../utils/helpers/logger";
import mongoose from "mongoose";

// const serviceAccount = process.cwd() + process.env.SERVER_CRED_PATH;
// admin.initializeApp({
//     credential: admin.credential.cert(serviceAccount),
// });

// // Create an FCM instance
// var fcm = admin.messaging();

const FCM = require('fcm-node');
var fcm = new FCM(process.env.SERVER_KEY);

/* Send push notification */
export const PushNotification = (message: any) => {

    // Send the message
    fcm.send(message, function (err: any, response: any) {
        if (err) {
            console.log("Something has gone wrong!", err);
        } else {
            console.log("Successfully sent with response: ", response);
        }
    });

}

/* Send notification function */
export const sendNotification = async (req: any) => {
    try {
        console.log("=====>>>>> Send Notification <<<<<=====", req);
        var i = 0;

        for await (const item of req.sendTo) {

            var to_role;

            // Get send notification user role
            const user = await findOne({
                collection: "User",
                query: { _id: item.toString() }
            });

            to_role = user.role;

            let verified = true;
            if (req.type == notificationType.COURSE_COMPLETED) {
                const courseCompletedNotification = await find({
                    collection: "Notification",
                    query: {
                        from: req.userId?.toString(),
                        to: item,
                        dataId: req.dataId,
                        type: notificationType.COURSE_COMPLETED
                    }
                });

                if (courseCompletedNotification.length) {
                    verified = false;
                }
            }

            if (to_role && verified) {

                const notification = await insertOne({
                    collection: "Notification",
                    document: {
                        from: req.userId,
                        from_type: req.user_role,
                        to: item,
                        to_type: to_role,
                        type: req.type,
                        dataId: req.dataId,
                        content: req.content
                    }
                });

                const query: any = [];

                query.push(
                    {
                        $match: {
                            _id: notification._id
                        }
                    },
                    { $sort: { createdAt: 1 } },
                    {
                        $lookup: {
                            from: "users",
                            localField: "from",
                            foreignField: "_id",
                            as: "users"
                        }
                    },
                    {
                        $unwind: "$users"
                    },
                    {
                        $project: {
                            _id: 1,
                            content: 1,
                            from: 1,
                            from_type: 1,
                            to: 1,
                            to_type: 1,
                            type: 1,
                            dataId: 1,
                            createdAt: 1,
                            read: 1,
                            users: {
                                "_id": "$users._id",
                                "legalFname": "$users.legalFname",
                                "legalLname": "$users.legalLname",
                                "profilePic": "$users.profilePic",
                                "profilePicKey": "$users.profilePicKey",
                                "preferredFname": "$users.preferredFname",
                                "preferredLname": "$users.preferredLname"
                            }
                        }
                    },
                    {
                        $group: {
                            _id: "$_id",
                            from_id: { $first: "$from" },
                            to_id: { $first: "$to" },
                            from_type: { $first: "$from_type" },
                            to_type: { $first: "$to_type" },
                            type: { $first: "$type" },
                            dataId: { $first: "$dataId" },
                            content: { $first: "$content" },
                            createdAt: { $first: "$createdAt" },
                            read: { $first: "$read" },
                            users: { $first: "$users" }
                        }
                    }
                );

                const notificationAggregate = await aggregate({
                    collection: "Notification",
                    pipeline: query
                });

                const dataObj: any = {};
                dataObj.event = 'notification';
                dataObj.data = notificationAggregate[0];

                var to_id = item.toString();

                (global as any).io.to(to_id).emit("response", dataObj);

                const countObjTo: any = {
                    'data': {
                        'user_id': item.toString(),
                        'user_type': to_role
                    }
                }

                await getCounts(countObjTo);

            }

        }
    } catch (err: any) {
        logger.error(`There was an issue into send notification.: ${err} `);
    }


}

/* Get notification function */
export const getNotifications = async (req: any) => {
    try {
        console.log('Get Notification Data============================>', req.data);

        const payload = req.data;

        var page = 0;
        if (payload.page) {
            page = payload.page - 1;
        }

        let query: any = [];
        let countQuery: any = {};

        if (!countQuery["$and"]) {
            countQuery["$and"] = []
        }

        if (payload.last_id) {

            query.push({
                $match: {
                    _id: { $lt: new mongoose.Types.ObjectId(payload.last_id) }
                }
            });

        }

        query.push({
            $match: {
                to: new mongoose.Types.ObjectId(payload.user_id),
                isDel: false
            }
        });

        countQuery["$and"] = countQuery["$and"].concat([{
            to: new mongoose.Types.ObjectId(payload.user_id),
            isDel: false
        }]);

        const notificationCount = countDocuments({
            collection: "Notification",
            query: countQuery
        });

        query.push(
            { $sort: { createdAt: -1 } },
            { $skip: page * payload.limit },
            { $limit: payload.limit },
            {
                $addFields: {
                    'client': {
                        $cond: [
                            {
                                $eq: [
                                    "$from", new mongoose.Types.ObjectId(payload.user_id)
                                ]
                            },
                            "$to", "$from"
                        ]
                    }
                }
            },
            {
                $lookup: {
                    from: "users",
                    localField: "client",
                    foreignField: "_id",
                    as: "users"
                }
            },
            {
                $unwind: "$users"
            },
            {
                $lookup: {
                    from: "thinkificcourses",
                    let: { tcId: "$dataId" },
                    pipeline: [
                        {
                            $match: {
                                $expr: {
                                    $eq: ["$$tcId", "$_id"]
                                }
                            }
                        },
                        { $project: { courseName: 1, } }
                    ],
                    as: 'course'
                }
            },
            {
                $unwind: {
                    path: "$course",
                    preserveNullAndEmptyArrays: true
                }
            },
            {
                $lookup: {
                    from: "events",
                    let: { evId: "$dataId" },
                    pipeline: [
                        {
                            $match: {
                                $expr: {
                                    $eq: ["$$evId", "$_id"]
                                }
                            }
                        },
                        {
                            $lookup: {
                                from: "eventguests",
                                let: { evId: "$_id", uId: new mongoose.Types.ObjectId(payload.user_id) },
                                pipeline: [
                                    {
                                        $match: {
                                            $expr: {
                                                $and: [
                                                    { $eq: ["$$evId", "$eventId"] },
                                                    { $eq: ["$$uId", "$userId"] }
                                                ]
                                            },
                                            isDel: { $eq: false }
                                        }
                                    }
                                ],
                                as: "guest"
                            }
                        },
                        {
                            $unwind: {
                                path: "$guest",
                                preserveNullAndEmptyArrays: true
                            }
                        },
                        { $addFields: { approve_status: "$guest.status" } },
                        { $unset: "guest" },
                    ],
                    as: "eventData"
                }
            },
            {
                $unwind: {
                    path: "$eventData",
                    preserveNullAndEmptyArrays: true
                }
            },
            {
                $addFields: {
                    content: {
                        $switch: {
                            branches: [
                                {
                                    case: {
                                        $in: ["$type", [notificationType.EVENT_INVITED, notificationType.MESSAGE, notificationType.REACTION]]
                                    },
                                    then: {
                                        $concat: [
                                            { $ifNull: ["$users.preferredFname", "$users.legalFname"] },
                                            " ",
                                            { $ifNull: ["$users.preferredLname", "$users.legalLname"] },
                                            " ",
                                            '$content'
                                        ]
                                    }
                                },
                                {
                                    case: { $in: ["$type", [notificationType.COURSE_COMPLETED]] },
                                    then: {
                                        $concat: [
                                            { $ifNull: ["$users.preferredFname", "$users.legalFname"] },
                                            " ",
                                            { $ifNull: ["$users.preferredLname", "$users.legalLname"] },
                                            " ",
                                            '$content',
                                            " (",
                                            '$course.courseName',
                                            ")."
                                        ]
                                    }
                                },
                                {
                                    case: { $in: ["$type", [notificationType.ASSIGNED_PROJECT, notificationType.ASSIGNED_TRAINING]] },
                                    then: {
                                        $concat: [
                                            '$content',
                                            " (",
                                            '$course.courseName',
                                            ")."
                                        ]
                                    }
                                },
                                {
                                    case: { $eq: ["$type", notificationType.INVITATION_APPROVED] },
                                    then: {
                                        $concat: [
                                            "Your ",
                                            { $toLower: "$users.role" },
                                            " ",
                                            { $ifNull: ["$users.preferredFname", "$users.legalFname"] },
                                            " ",
                                            { $ifNull: ["$users.preferredLname", "$users.legalLname"] },
                                            " has accepted the event ",
                                            { $ifNull: ["$eventData.event_name", ""] },
                                            "."
                                        ]
                                    }
                                },
                                {
                                    case: { $eq: ["$type", notificationType.INVITATION_DECLINE] },
                                    then: {
                                        $concat: [
                                            "Your ",
                                            { $toLower: "$users.role" },
                                            " ",
                                            { $ifNull: ["$users.preferredFname", "$users.legalFname"] },
                                            " ",
                                            { $ifNull: ["$users.preferredLname", "$users.legalLname"] },
                                            " has declined the event ",
                                            { $ifNull: ["$eventData.event_name", ""] },
                                            "."
                                        ]
                                    }
                                }
                            ],
                            default: "$content"
                        }
                    }
                }
            },
            {
                $project: {
                    _id: 1,
                    content: 1,
                    from: 1,
                    from_type: 1,
                    to: 1,
                    to_type: 1,
                    type: 1,
                    dataId: 1,
                    createdAt: 1,
                    read: 1,
                    users: {
                        "_id": "$users._id",
                        "legalFname": "$users.legalFname",
                        "legalLname": "$users.legalLname",
                        "role": "$users.role",
                        "profilePic": "$users.profilePic",
                        "profilePicKey": "$users.profilePicKey",
                        "preferredFname": "$users.preferredFname",
                        "preferredLname": "$users.preferredLname"
                    },
                    event: {
                        "event_name": "$eventData.event_name",
                        "start_date": "$eventData.start_date",
                        "end_date": "$eventData.end_date",
                        "thumbnail": "$eventData.thumbnail",
                        "thumbnailKey": "$eventData.thumbnailKey",
                        "approve_status": "$eventData.approve_status"
                    }
                }
            }
        )

        const notifications = aggregate({
            collection: "Notification",
            pipeline: query
        });


        const responseNotification: any = await Promise.allSettled([notifications, notificationCount]);

        const pages = Math.ceil(responseNotification[1].value / payload.limit);

        const notificationList: any = {
            page: payload.page,
            limit: payload.limit,
            totalData: responseNotification[1].value,
            totalPage: pages,
            data: responseNotification[0].value
        };

        const dataObj: any = {};
        dataObj.event = "getNotifications";
        dataObj.data = notificationList;

        // var unreadIds: any = [];
        // for await (const item of dataObj.data.data) {
        //     unreadIds.push(item._id)
        // }
        // const read = await updateMany({
        //     collection: "Notification",
        //     query: {_id: {$in: unreadIds}, read: false},
        //     update: {$set: {read: true}},
        //     options: {new: true}
        // });

        // if (unreadIds.length > 0) {
        //     // Send total unread count
        //     getCounts({data: {user_id: payload.user_id, user_type: payload.user_type}});
        // }

        (global as any).io.to(payload.user_id).emit("response", dataObj);

    } catch (err: any) {
        logger.error(`There was an issue into get notification.: ${err} `);
        (global as any).io.to(req.data.user_id).emit("response", {
            event: "error",
            message: err,
            success: false,
            data: { event: "getNotifications" }
        })
    }
}

/* Mark all read notification using socket function */
export const readNotification = async (req: any) => {
    try {
        console.log('Read Notification Data============================>', req.data);

        const payload = req.data;

        let readConversation;
        if (payload.type == "all") {
            readConversation = await updateMany({
                collection: "Notification",
                query: { to: payload.user_id, to_type: payload.user_type, read: false },
                update: { $set: { read: true } },
                options: { new: true }
            });
        } else {
            const getUser = await findOne({
                collection: "Notification",
                query: { _id: payload.notiId }
            });

            let query;
            if (getUser.type == notificationType.MESSAGE || getUser.type == notificationType.REACTION) {
                query = { to: payload.user_id, from: getUser.from, read: false, type: { $in: [notificationType.MESSAGE, notificationType.REACTION] } }
            } else {
                query = { _id: payload.notiId, to: payload.user_id, to_type: payload.user_type, read: false }
            }

            readConversation = await updateMany({
                collection: "Notification",
                query,
                update: { $set: { read: true } },
                options: { new: true }
            });
        }



        // Send total unread count
        getCounts({ data: { user_id: payload.user_id, user_type: payload.user_type } });

        const dataObj: any = {};
        if (readConversation) {
            dataObj.event = "readNotification";
            dataObj.success = true;
            dataObj.data = { 'message': 'Success', 'to': payload.user_id };
        } else {
            dataObj.event = "readNotification";
            dataObj.success = true;
            dataObj.data = { 'message': 'Something want wrong!', 'to': payload.user_id };
        }

        (global as any).io.to(payload.user_id).emit("response", dataObj);

    } catch (err: any) {
        logger.error(`There was an issue into read notification.: ${err}`);
        (global as any).io.to(req.data.user_id).emit("response", {
            event: "error",
            message: err,
            success: false,
            data: { event: "readMsg" }
        })
    }
}

/* Event admin approval function */
export const sendEventForApprovalNotification = async (req: any) => {
    try {
        console.log("==========>>>>> Send Event For Approval Notification <<<<<==========", req);

        const eventVerification = await findOne({
            collection: 'Event',
            query: { _id: req.eventId, isDel: false },
            populate: [{ path: "userId" }]
        });

        if (!eventVerification) {
            const errorResponse = {
                success: false,
                message: errorMessage.NOT_EXISTS.replace(":attribute", 'Event'),
                data: {},
                statusCode: statusCode.BAD_REQUEST
            };
            return errorResponse;
        }

        const sendTo: any = [];
        if (eventVerification?.userId?.partnerAdmin) {
            const partnerAdmins = await find({
                collection: "User",
                query: {
                    partnerAdmin: eventVerification?.userId?.partnerAdmin,
                    role: { $in: [userRoleConstant.P_LOCAL_ADMIN, userRoleConstant.P_SUPER_ADMIN] }
                },
                project: { _id: 1 }
            });

            partnerAdmins.map((ele: any) => {
                sendTo.push(ele._id.toString())
            });

        } else if (eventVerification?.userId?.region) {

            const regions = await find({
                collection: "User",
                query: { region: eventVerification?.userId?.region, role: { $in: [userRoleConstant.I_LOCAL_ADMIN] } },
                project: { _id: 1 }
            });

            regions.map((ele: any) => {
                sendTo.push(ele._id.toString())
            });
        }

        // Notification that this event has been approved To send notification that event guests have been invited
        const sendObj: any = {
            dataId: eventVerification._id,
            approval: eventVerification.approval,
            eventUserId: eventVerification.userId._id,
            sendTo: sendTo,
            userId: eventVerification.userId._id,
            user_role: eventVerification.userId.role,
            type: notificationType.EVENT_APPROVAL,
            content: notificationMessage.eventApproval
        };
        sendNotification(sendObj);

        // Returning here after processing the approved event
        return;

    } catch (err: any) {
        logger.error(`There was an issue into send event for approval notification.: ${err} `)
    }
}

/* Event admin approval function */
export const eventApprovalNotification = async (req: any) => {
    try {
        console.log("==========>>>>> Event Approval Notification <<<<<==========", req);

        const eventVerification = await findOne({
            collection: 'Event',
            query: { _id: req.eventId, isDel: false },
            populate: [{ path: "userId" }]
        });

        if (!eventVerification) {
            const errorResponse = {
                success: false,
                message: errorMessage.NOT_EXISTS.replace(":attribute", 'Event'),
                data: {},
                statusCode: statusCode.BAD_REQUEST
            };
            return errorResponse;
        }

        if (req.isApproved == eventStatusConstant.DECLINED) {

            await updateMany({
                collection: 'Notification',
                query: { dataId: req.eventId, to: { $in: [eventVerification.userId._id] } },
                update: { $set: { isDel: true } },
                options: { new: true }
            });

            // Sending a notification to the event owner that the event has been declined
            const sendObj: any = {
                dataId: eventVerification._id,
                approval: eventVerification.approval,
                eventUserId: eventVerification.userId._id,
                sendTo: [eventVerification.userId._id],
                userId: req.loginUser._id,
                user_role: req.loginUser.role,
                type: notificationType.EVENT_DECLINE,
                content: notificationMessage.eventNotApproved
            };
            sendNotification(sendObj);

            const badgeCounts = await countDocuments({
                collection: 'Notification',
                query: { to: eventVerification.userId._id, read: false }
            });

            const dataObj: any = {
                ...sendObj,
                badgeCounts,
                approvalType: 'Admin',
                title: eventVerification.event_name,
                type: 'Event'
            };
            sendPushNotification(dataObj);

            // Returning here after processing the declined event
            return;
        }

        if (!req.isOnlyGuest) {

            await updateMany({
                collection: 'Notification',
                query: { dataId: req.eventId, to: { $in: [eventVerification.userId._id] } },
                update: { $set: { isDel: true } },
                options: { new: true }
            });

            // Sending a notification to the event owner that the event has been approved
            const sendApprovalObj: any = {
                dataId: eventVerification._id,
                approval: eventVerification.approval,
                eventUserId: eventVerification.userId._id,
                sendTo: [eventVerification.userId._id],
                userId: req.loginUser._id,
                user_role: req.loginUser.role,
                type: notificationType.EVENT_APPROVED,
                content: notificationMessage.eventApproved
            };
            sendNotification(sendApprovalObj);

            const badgeCounts = await countDocuments({
                collection: 'Notification',
                query: { to: eventVerification.userId._id, read: false }
            });

            const dataObj: any = {
                ...sendApprovalObj,
                badgeCounts,
                approvalType: 'Admin',
                title: eventVerification.event_name,
                type: 'Event'
            };
            sendPushNotification(dataObj);
        }

        if (eventVerification.guest.length > 0 || req.isOnlyGuest == true) {

            // const eventGuestInvited = await updateMany({
            //     collection: 'EventGuest',
            //     query: { eventId: req.eventId, isActive: false, isDel: false },
            //     update: { $set: { isActive: true } },
            //     options: { new: true }
            // });

            await updateMany({
                collection: 'Notification',
                query: { dataId: req.eventId, to: { $in: eventVerification.guest } },
                update: { $set: { isDel: true } },
                options: { new: true }
            });

            // Notification that this event has been approved To send notification that event guests have been invited
            let name = eventVerification.userId.preferredFname + " " + eventVerification.userId.preferredLname;
            const sendObj: any = {
                dataId: eventVerification._id,
                approval: eventVerification.approval,
                eventUserId: eventVerification.userId._id,
                sendTo: eventVerification.guest,
                userId: eventVerification.userId._id,
                user_role: eventVerification.userId.role,
                type: notificationType.EVENT_INVITED,
                content: notificationMessage.eventInvitation,
            };
            sendNotification(sendObj);

            const dataObj: any = {
                ...sendObj,
                name,
                profileImage: eventVerification.userId?.profilePic ?? "",
                content: name + " " + notificationMessage.eventInvitation,
                thumbnail: eventVerification.thumbnail,
                title: eventVerification.event_name,
                startDate: eventVerification.start_date,
                approval: 'Pending',
                type: 'Event'
            };
            sendPushNotification(dataObj);

        }

        // Returning here after processing the approved event
        return;

    } catch (err: any) {
        logger.error(`There was an issue into event approval notification.: ${err} `)
    }
}

/* Get unread notification count */
export const getCounts = async (req: any) => {
    try {
        console.log("==========>>>>> Get Counts <<<<<==========", req.data);

        const payload = req.data;

        const query: any = [];

        query.push(
            {
                $match: {
                    'to': new mongoose.Types.ObjectId(payload.user_id),
                    'read': false,
                    'isDel': false
                }
            },
            { $group: { _id: null, count: { $sum: 1 } } }
        );

        const unreadCounts = await aggregate({
            collection: "Notification",
            pipeline: query
        });

        const dataObj: any = {};
        dataObj.event = 'getCounts';
        dataObj.success = true;
        dataObj.data = {
            "notificationCount": !unreadCounts.length ? 0 : unreadCounts[0].count,
            "type": payload.user_type,
            "user_id": payload.user_id,
        };

        (global as any).io.to(payload.user_id).emit("response", dataObj);

    } catch (err: any) {
        logger.error(`There was an issue into get counts.: ${err} `)
    }
}

export const sendPushNotification = async (req: any) => {
    try {
        console.log("Request====================>", req);

        for (let index = 0; index < req.sendTo.length; index++) {
            const element = req.sendTo[index];

            const badgeCounts = await countDocuments({
                collection: 'Notification',
                query: { to: element, read: false }
            });

            var isNotify = await distinct({
                collection: 'NotificationManage',
                field: 'deviceId',
                query: { user_id: element }
            });
            console.log("isNotify================>", isNotify);

            isNotify = isNotify.filter((device: any) => device !== '');
            isNotify = isNotify.filter((device: any) => device !== null);

            if (isNotify.length) {

                let data: any = {};
                let imageUrl: string = "";
                switch (req.type) {
                    case notificationType.EVENT:
                        data = {
                            dataId: req.dataId,
                            eventOwnerId: req.eventUserId,
                            approval: req.approval,
                            approvalType: req.approvalType,
                            type: req.Types,
                            screen: 'EventDetail'
                        };
                        if (req.profileImage) {
                            imageUrl = req.profileImage;
                        }
                        break;
                    case notificationType.MATCHED:
                        data = {
                            dataId: req.dataId,
                            type: notificationType.MATCHED,
                            content: notificationMessage.matched,
                            mentorId: req.mentorId,
                            menteeId: req.menteeId,
                        };
                        break;
                    case notificationType.ANNOUNCEMENT:
                        data = {
                            senderId: req.userId,
                            senderRole: req.user_role,
                            dataId: req.dataId,
                            type: notificationType.ANNOUNCEMENT,
                            content: notificationMessage.announcement
                        };
                        break;
                    case notificationType.ASSIGNED_PROJECT:
                    case notificationType.ASSIGNED_TRAINING:
                        data = {
                            dataId: req.dataId,
                            type: req.type,
                            content: req.content
                        };
                        break;
                    case notificationType.COURSE_COMPLETED:
                        data = {
                            userId: req.userId,
                            user_role: req.user_role,
                            type: notificationType.COURSE_COMPLETED,
                            content: req.content,
                            courseId: req.courseId,
                            courseType: req.courseType,
                        };
                        if (req.profileImage) {
                            imageUrl = req.profileImage;
                        }
                        break;
                    case notificationType.INVITATION_APPROVED:
                    case notificationType.INVITATION_DECLINE:
                        data = {
                            userId: req.userId,
                            user_role: req.user_role,
                            type: req.type,
                            content: req.content,
                            dataId: req.dataId,
                            eventUserId: req.eventUserId,
                            screen: "EventDetail"
                        };
                        if (req.profileImage) {
                            imageUrl = req.profileImage;
                        }
                        break;
                }

                var message = { //this may vary according to the message type (single recipient, multicast, topic, et cetera)
                    registration_ids: isNotify,
                    priority: "high",
                    notification: {
                        title: req.title ?? "",
                        body: req.content,
                        imageUrl: imageUrl,
                        image: imageUrl,
                        badge: badgeCounts ?? 0,
                        sound: "default",
                    },
                    apns: {
                        payload: {
                            aps: {
                                'mutable-content': 1
                            }
                        },
                        fcm_options: {
                            image: imageUrl
                        }
                    },
                    data: {
                        data: data
                    }
                };

                PushNotification(message)
            }
        }

    } catch (err: any) {
        logger.error(`There was an issue into event approval notification.: ${err} `)
    }
}