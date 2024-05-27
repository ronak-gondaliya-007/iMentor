import { Request, Response } from "express";
import { find, findOne, findOneAndUpdate, insertOne, paginate, updateOne, updateMany, aggregate } from "../utils/db";
import { success, error } from "../utils/helpers/resSender";
import { logger } from "../utils/helpers/logger";
import { v4 as uuidv4 } from 'uuid';
import mongoose from "mongoose";
import { updateFirstMessageSystemBadge } from "../utils/helpers/functions";
import { errorMessage, messageUploadConstant, msg_Type, statusCode, successMessage, uploadConstant, userRoleConstant } from "../utils/const";
import { uploadToS3, validateFile } from "../utils/uploadFile";
import { Socket } from "socket.io";

/* Send message using socket function */
export const sendMsg = async (req: any, socket: Socket) => {
    try {
        console.log('Send Message Data============================>', req.data);

        const payload = req.data;

        let receiverObj = await findOne({ collection: 'User', query: { _id: payload.receiverId, isDel: false } })
        console.log(receiverObj);

        if (!receiverObj) {
            (global as any).io.to(payload.senderId).emit("response", { event: "error", message: errorMessage.NOT_EXISTS.replace(":attribute", 'receiverId'), success: false, data: { event: "sendMsg" } })
            return
        }

        // if (payload.user_type == userRoleConstant.I_SUPER_ADMIN && (receiverObj.role == userRoleConstant.I_LOCAL_ADMIN || receiverObj.role == userRoleConstant.P_SUPER_ADMIN)) {
        //     payload.receiverId = receiverObj._id
        // } else if (payload.user_type == userRoleConstant.I_LOCAL_ADMIN && (receiverObj.role == userRoleConstant.MENTOR || receiverObj.role == userRoleConstant.MENTEE)) {
        //     payload.receiverId = receiverObj._id
        // } else if (payload.user_type == userRoleConstant.P_SUPER_ADMIN && (receiverObj.role == userRoleConstant.I_LOCAL_ADMIN || receiverObj.role == userRoleConstant.MENTEE || receiverObj.role == userRoleConstant.MENTOR)) {
        //     payload.receiverId = receiverObj._id
        // } else if (payload.user_type == userRoleConstant.I_LOCAL_ADMIN && (receiverObj.role == userRoleConstant.MENTOR || receiverObj.role == userRoleConstant.MENTEE)) {
        //     payload.receiverId = receiverObj._id
        // } else {
        //     (global as any).io.to(payload.receiverId).to(payload.user_id).emit("response", { event: "error", message: errorMessage.ACTION.replace(":attribute", payload.user_type), success: false, data: { event: "sendMsg" } })
        //     return
        // }

        let query: { $or: any[] } = {
            $or: [
                { $and: [{ senderId: new mongoose.Types.ObjectId(payload.user_id) }, { receiverId: new mongoose.Types.ObjectId(payload.receiverId) }] },
                { $and: [{ senderId: new mongoose.Types.ObjectId(payload.receiverId) }, { receiverId: new mongoose.Types.ObjectId(payload.user_id) }] }
            ]
        };

        const chat = await find({ collection: "Messages", query });

        /* We created id for conversation between two user from here */
        var chId;
        if (chat.length) {
            chId = chat[0].chId;
        } else {
            chId = uuidv4(); // Generate a UUID using v4
        }
        // console.log(chId);


        var conversation = await insertOne({
            collection: "Messages",
            document: {
                senderId: payload.user_id,
                receiverId: payload.receiverId,
                chId: chId,
                message: payload.message,
                msg_type: payload.msg_type,
                messageFile: payload.file,
                messageFileKey: payload.fileKey,
                badgeId: payload.badge
            }
        });

        const conversationData = await findOne({
            collection: "Messages",
            query: { _id: conversation._id },
            populate: [
                { path: "senderId", select: "_id legalFname legalLname role profilePic profilePicKey" },
                { path: "receiverId", select: "_id legalFname legalLname role profilePic profilePicKey" }
            ]
        });

        // If sender send a message first time than set their badge
        updateFirstMessageSystemBadge({ data: payload, type: "FMS" });

        const dataObj: any = {};
        dataObj.event = "sendMsg";
        dataObj.success = true;
        dataObj.data = { "conversationlist": conversationData };


        (global as any).io.to(payload.receiverId).to(payload.user_id).emit("response", dataObj);

    } catch (err: any) {
        logger.error(`There was an issue into send message.: ${err}`);
        (global as any).io.to(socket.id).emit("response", { event: "error", message: err, success: false, data: { event: "sendMsg" } })
    }
};

/* Get message using socket function */
export const getMsg = async (req: any, socket: Socket) => {
    try {
        console.log('Get Message Data============================>', req.data);

        const payload = req.data;

        var skip = 0;

        if (payload.page) {
            skip = (payload.page - 1) * payload.limit;
        } else {
            skip = 0
        }
        console.log(skip);


        let query: any = {};

        if (payload.last_id) {
            query = { _id: { $lt: payload.last_id, msg_type: { $in: [msg_Type.FILE, msg_Type.MEDIA, msg_Type.MESSAGE, msg_Type.PROJECT] } } };
        }

        if (payload.chId) {

            var readConversation = await updateMany({
                collection: "Messages",
                query: { chId: payload.chId, receiverId: payload.user_id, read: false },
                update: { $set: { read: true } },
                options: { new: true }
            });

            query = { chId: payload.chId };

        } else if (payload.senderId) {

            var readConversation = await updateMany({
                collection: "Messages",
                query: { senderId: payload.senderId, receiverId: payload.user_id, read: false },
                update: { $set: { read: true } },
                options: { new: true }
            });

            query = {
                $or: [
                    { $and: [{ senderId: payload.senderId }, { receiverId: payload.user_id }] },
                    { $and: [{ senderId: payload.user_id }, { receiverId: payload.senderId }] }
                ]
            };

        }

        console.log(query);

        const getConversation = await find({
            collection: "Messages",
            query,
            populate: [
                { path: "senderId", select: "_id legalFname legalLname role profilePic profilePicKey" },
                { path: "receiverId", select: "_id legalFname legalLname role profilePic profilePicKey" },
                { path: "badge", select: "badgeName" }
            ],
            sort: { createdAt: -1 },
            skip: skip,
            limit: payload.limit
        });

        const dataObj: any = {};
        dataObj.event = "getMsg";
        dataObj.success = true;
        dataObj.data = { "conversationlist": getConversation };
        console.log('Data', dataObj);

        (global as any).io.to(socket.id).emit("response", dataObj);

    } catch (err: any) {
        logger.error(`There was an issue into get message.: ${err}`);
        (global as any).io.to(socket.id).emit("response", { event: "error", message: err, success: false, data: { event: "getMsg" } })
    }
}

/* Read message using socket function */
export const readMsg = async (req: any, socket: Socket) => {
    try {
        console.log('Read Message Data============================>', req.data);

        const payload = req.data;

        const readConversation = await updateMany({
            collection: "Messages",
            query: { chId: payload.chId, receiverId: payload.user_id, read: false },
            update: { $set: { read: true } },
            options: { new: true }
        });

        const dataObj: any = {};
        if (readConversation) {
            dataObj.event = "readMsg";
            dataObj.success = true;
            dataObj.data = { 'message': 'Success', 'chId': payload.chId };
        } else {
            dataObj.event = "readMsg";
            dataObj.success = true;
            dataObj.data = { 'message': 'Something want wrong!', 'chId': payload.chId };
        }

        (global as any).io.to(socket.id).emit("response", dataObj);

    } catch (err: any) {
        logger.error(`There was an issue into read message.: ${err}`);
        (global as any).io.to(socket.id).emit("response", { event: "error", message: err, success: false, data: { event: "readMsg" } })
    }
}

/* Get message list using socket function */
export const getMsgList = async (req: any, socket: Socket) => {
    try {
        console.log('Get Message List Data============================>', req.data);

        const payload = req.data;
        const options = {
            page: payload.page || 1,
            limit: payload.limit || 10
        };

        let query: any = [];

        query.push(
            {
                $match: {
                    $and: [
                        {
                            $or: [
                                { senderId: new mongoose.Types.ObjectId(payload.user_id) },
                                { receiverId: new mongoose.Types.ObjectId(payload.user_id) },
                            ]
                        },
                        { msg_type: { $in: [msg_Type.MESSAGE, msg_Type.MEDIA, msg_Type.PROJECT, msg_Type.FILE] } }
                    ]

                }
            },
            {
                $addFields: {
                    'client': {
                        $cond: [
                            {
                                $eq: [
                                    "$senderId", new mongoose.Types.ObjectId(payload.user_id)
                                ]
                            },
                            "$receiverId", "$senderId"
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
                $addFields: {
                    legalFname: "$users.legalFname",
                    legalLname: "$users.legalLname",
                    preferredFname: "$users.preferredFname",
                    preferredLname: "$users.preferredLname"
                }
            }
        )

        if (payload.search) {
            query.push(
                {
                    $match: {
                        $or: [
                            { legalFname: { $regex: '.*' + payload.search + '.*', $options: 'i' } },
                            { legalLname: { $regex: '.*' + payload.search + '.*', $options: 'i' } }
                        ]
                    }
                }
            )
        }

        query.push(
            { $skip: (options.page - 1) * options.limit },
            { $limit: options.limit },
            {
                $lookup: {
                    from: 'messages',
                    let: { chId: "$chId", rId: new mongoose.Types.ObjectId(payload.user_id) },
                    pipeline: [
                        {
                            $match: {
                                $expr: {
                                    $and: [
                                        { $eq: ["$$chId", "$chId"] },
                                        { $eq: ["$$rId", "$receiverId"] }
                                    ]
                                },
                                read: { $eq: false }
                            },
                        }
                    ],
                    as: "unreadMessage"
                }
            },
            {
                $lookup: {
                    from: 'messages',
                    let: { chId: "$chId" },
                    pipeline: [
                        {
                            $match: {
                                $expr: { $eq: ["$$chId", "$chId"] }
                            }
                        },
                        {
                            $sort: { createdAt: -1 }
                        },
                        {
                            $limit: 1
                        },
                    ],
                    as: "lastMessage"
                }
            },
            {
                $unwind: "$lastMessage"
            },
            {
                $project: {
                    _id: 1,
                    chId: 1,
                    message: 1,
                    senderId: 1,
                    receiverId: 1,
                    createdAt: 1,
                    unRead: { $size: "$unreadMessage" },
                    read: 1,
                    users: {
                        "_id": "$users._id", "legalFname": "$users.legalFname", "legalLname": "$users.legalLname", "profilePic": "$users.profilePic", "profilePicKey": "$users.profilePicKey",
                        "preferredFname": "$users.preferredFname", "preferredLname": "$users.preferredLname"
                    },
                    lastMessage: 1,

                }
            },
            {
                $group: {
                    _id: "$chId",
                    chId: { $first: "$chId" },
                    senderId: { $first: "$senderId" },
                    receiverId: { $first: "$receiverId" },
                    message: { $first: "$message" },
                    createdAt: { $first: "$createdAt" },
                    read: { $first: "$read" },
                    unRead: { $first: "$unRead" },
                    users: { $first: "$users" },
                    lastMessage: { $first: "$lastMessage" },

                }
            },
            {
                $sort: {
                    "lastMessage.createdAt": -1
                }
            }
        );

        console.log(query);

        const getConversationList = await aggregate({
            collection: "Messages",
            pipeline: query
        });

        const dataObj: any = {};
        dataObj.event = "getMsgList";
        dataObj.success = true;
        dataObj.data = getConversationList;

        (global as any).io.to(socket.id).emit("response", dataObj);

    } catch (err: any) {
        console.log(err);

        logger.error(`There was an issue into get message list.: ${err}`);
        (global as any).io.to(socket.id).emit("response", { event: "error", message: err, success: false, data: { event: "getMsgList" } })
    }
}

/* Message file upload function */
export const uploadMessageFile = async (req: Request, res: Response) => {
    try {

        const msgfile = req.file;
        const maxSize = messageUploadConstant.MESSAGE_FILE_SIZE;
        const extArr = uploadConstant.FILE_UPLOAD_EXT_ARR;

        // validate file
        let validateUplaodedFile = await validateFile(res, msgfile, 'messageFile', extArr, maxSize);

        if (validateUplaodedFile) {
            res.status(statusCode.BAD_REQUEST).send(error(validateUplaodedFile, {}, statusCode.BAD_REQUEST))
            return
        }

        const uploadFile: any = await uploadToS3(msgfile, 'messageFile');

        let file = '';
        let fileKey = '';

        if (uploadFile) {
            file = uploadFile.Location;
            fileKey = uploadFile.key;
        }

        res.status(statusCode.OK).send(success(successMessage.UPLOAD_SUCCESS.replace(':attribute', "message file"), { file, fileKey }))

    } catch (err) {
        logger.error(`There was an issue into upload mentor message file.: ${err} `)
        res.status(statusCode.FORBIDDEN).send(error("There was an issue into upload mentor message file", err))
    }
}
