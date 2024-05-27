import { Request, Response } from "express";
import {
  find,
  findOne,
  insertOne,
  updateMany,
  aggregate,
  countDocuments,
  findOneAndUpdate,
  distinct,
} from "../../utils/db";
import {
  statusCode,
  successMessage,
  msg_Type,
  messageUploadConstant,
  errorMessage,
  userRoleConstant,
  badges,
  notificationType,
  notificationMessage,
  uploadConstant,
} from "../../utils/const";
import { success, error } from "../../utils/helpers/resSender";
import { validateFile, uploadToS3 } from "../../middleware/multer";
import { logger } from "../../utils/helpers/logger";
import { v4 as uuidv4 } from "uuid";
import mongoose from "mongoose";
// import { updateMessageSystemBadge, updateProjectCompleteSystemBadge } from "../../utils/helpers/common";
import { sendNotification } from "./notification.controller";
import { PushNotification } from "../Web/notification.controller";
import { authController } from "./auth.controller";
import axios from "axios";

/* Send message using socket function */
export const sendMsg = async (req: any) => {
    try {
        console.log('Send Message Data============================>', req.data);

        const payload = req.data;

        // Use WebPurify API to check for profanity in the message
        // const webPurifyResponse = await axios.get("https://api1.webpurify.com/services/rest/", {
        //     params: {
        //         method: "webpurify.live.check",
        //         api_key: process.env.TEXT_KEY,
        //         text: payload.message,
        //         format: "json"
        //     },
        // });
        // console.log("=============> webPurifyResponse <===============", webPurifyResponse.data);

        let query: { $or: any[] };

        if (payload.groupId) {
            query = {
                $or: [
                    {
                        $and: [
                            { senderId: new mongoose.Types.ObjectId(payload.user_id) }, { receiverId: new mongoose.Types.ObjectId(payload.receiverId) },
                            { groupId: new mongoose.Types.ObjectId(payload.groupId) }, { msg_type: { $nin: [msg_Type.ANNOUNCEMENT, msg_Type.PRE_MATCH_ANNOUNCEMENT] } }
                        ]
                    },
                    {
                        $and: [
                            { senderId: new mongoose.Types.ObjectId(payload.receiverId) }, { receiverId: new mongoose.Types.ObjectId(payload.user_id) },
                            { groupId: new mongoose.Types.ObjectId(payload.groupId) }, { msg_type: { $nin: [msg_Type.ANNOUNCEMENT, msg_Type.PRE_MATCH_ANNOUNCEMENT] } }
                        ]
                    }
                ]
            };
        } else {
            query = {
                $or: [
                    { $and: [{ senderId: new mongoose.Types.ObjectId(payload.user_id) }, { receiverId: new mongoose.Types.ObjectId(payload.receiverId) }, { msg_type: { $nin: [msg_Type.ANNOUNCEMENT, msg_Type.PRE_MATCH_ANNOUNCEMENT] } }] },
                    { $and: [{ senderId: new mongoose.Types.ObjectId(payload.receiverId) }, { receiverId: new mongoose.Types.ObjectId(payload.user_id) }, { msg_type: { $nin: [msg_Type.ANNOUNCEMENT, msg_Type.PRE_MATCH_ANNOUNCEMENT] } }] }
                ]
            };
        }

        const chat = await findOne({ collection: "Messages", query });

        /* We created id for conversation between two user from here */
        var chId;
        if (chat) {
            chId = chat.chId;
        } else {
            chId = uuidv4(); // Generate a UUID using v4
        }
        var chType;
        if (payload.groupId) {
            chType = "Group";
            var chatID = await findOne({
                collection: "Messages", query: {
                    $or: [
                        { $and: [{ senderId: new mongoose.Types.ObjectId(payload.user_id) }, { receiverId: new mongoose.Types.ObjectId(payload.receiverId) }, { msg_type: { $nin: [msg_Type.ANNOUNCEMENT, msg_Type.PRE_MATCH_ANNOUNCEMENT] } }] },
                        { $and: [{ senderId: new mongoose.Types.ObjectId(payload.receiverId) }, { receiverId: new mongoose.Types.ObjectId(payload.user_id) }, { msg_type: { $nin: [msg_Type.ANNOUNCEMENT, msg_Type.PRE_MATCH_ANNOUNCEMENT] } }] }
                    ]
                }
            });
        }
        
        if(payload.chType == "Pair") {
            chType = payload.chType;
        }

        var conversation = await insertOne({
            collection: "Messages",
            document: {
                senderId: payload.user_id,
                receiverId: payload.receiverId,
                chId: chId,
                chType: chType,
                message: payload.message,
                msg_type: payload.msg_type,
                messageFile: payload.file,
                messageFileKey: payload.fileKey,
                badge: payload.badge,
                duration: payload.duration,
                groupId: payload.groupId,
                contentId: payload.contentId,
                messageSortDate: Date.now()
            }
        });
        console.log("=============> Conversation <===========", conversation);

        const conversationData = findOne({
            collection: "Messages",
            query: { _id: conversation._id },
            populate: [
                { path: "senderId", select: "_id legalFname legalLname preferredFname preferredLname role profilePic profilePicKey isDel isDisabled" },
                { path: "receiverId", select: "_id legalFname legalLname preferredFname preferredLname role profilePic profilePicKey isDel isDisabled" },
                { path: "groupId", select: "_id groupName" }
            ]
        });

        const getSenderMessages = find({
            collection: "Messages",
            query: { senderId: payload.user_id, msg_type: { $nin: [msg_Type.ANNOUNCEMENT, msg_Type.PRE_MATCH_ANNOUNCEMENT] } }
        });

        const response: any = await Promise.allSettled([conversationData, getSenderMessages]);
        console.log("conversationData=================>", response[0].value);

        if (payload.groupId) {
            response[0].value.chId = chatID?.chId;
        }

        // if (response[1]?.value?.length == 1) {
        //     // If sender send a message first time than set their badge
        //     updateMessageSystemBadge({ data: payload, type: badges.FMS });
        // }

        // if (response[1]?.value?.length == 5) {
        //     // If sender send a message fifth time than set their badge
        //     updateMessageSystemBadge({ data: payload, type: badges.HFM });
        // }

        if (payload.contentId) {
            const content = await findOne({
                collection: "Contents",
                query: { _id: payload.contentId }
            });
            response[0].value.contentId = content;
        }

        // check user is connected or not, if not connected then send push notification
        // console.log("ReceiverId===================>", payload.receiverId, "In ActiveUser Index===================>", Array.from((global as any).activeUsers).indexOf(payload.receiverId));
        // if (Array.from((global as any).activeUsers).indexOf(payload.receiverId) < 0) {
        //     const message: any = {
        //         userId: payload.user_id,
        //         user_role: payload.user_type,
        //         sendTo: [payload.receiverId],
        //         type: notificationType.MESSAGE,
        //         content: notificationMessage.sendMessage,
        //         dataId: conversation._id
        //     };
        //     sendNotification(message)
        // }

        const dataObj: any = {};
        dataObj.event = "sendMsg";
        dataObj.success = true;
        dataObj.data = { "conversationlist": response[0].value };

        (global as any).io.to(payload.receiverId).to(payload.user_id).emit("response", dataObj);

        var isNotify = await distinct({ collection: 'NotificationManage', field: 'deviceId', query: { user_id: payload.receiverId, messageNotification: true } });
        console.log("isNotify================>", isNotify);

        let sendPush = await authController.checkActiveUser(payload.receiverId?.toString());

        if (isNotify.length) {
            const message: any = {
                userId: payload.user_id,
                user_role: payload.user_type,
                sendTo: [payload.receiverId],
                type: notificationType.MESSAGE,
                content: notificationMessage.sendMessage,
                dataId: conversation._id
            };
            sendNotification(message)
        }

        isNotify = isNotify.filter((device: any) => device !== '');
        isNotify = isNotify.filter((device: any) => device !== null);

        const badgeCounts = await countDocuments({
            collection: 'Notification',
            query: { to: payload.receiverId, read: false }
        });

        if (isNotify.length) {
            let name = response[0].value?.senderId.preferredFname + " " + response[0].value?.senderId.preferredLname;

            var message = { //this may vary according to the message type (single recipient, multicast, topic, et cetera)
                registration_ids: isNotify,
                priority: "high",
                notification: {
                    title: name,
                    body: name + " " + notificationMessage.sendMessage,
                    imageUrl: response[0].value?.senderId?.profilePic ?? "",
                    image: response[0].value?.senderId?.profilePic ?? "",
                    badge: badgeCounts,
                    sound: "default",
                },
                apns: {
                    payload: {
                        aps: {
                            'mutable-content': 1
                        }
                    },
                    fcm_options: {
                        image: response[0].value?.senderId?.profilePic ?? ""
                    }
                },
                data: {
                    data: {
                        chId: response[0].value?.chId,
                        user: response[0].value?.senderId._id?.toString(),
                        user_id: response[0].value?.receiverId._id?.toString(),
                        user_type: response[0].value?.receiverId.role,
                        type: 'message',
                        screen: 'MessageDetail',
                        users: response[0].value?.senderId
                    }
                }
            };

            if (isNotify.length) {
                PushNotification(message)
            }

        }

    } catch (err: any) {
        logger.error(`There was an issue into send message.: ${err}`);
        (global as any).io.to(req.data.senderId).emit("response", { event: "error", message: err, success: false, data: { event: "sendMsg" } })
    }
};

/* Get message using socket function */
export const getMsg = async (req: any) => {
  try {
    console.log("Get Message Data============================>", req.data);

    const payload = req.data;

    let query: any = [];
    let countQuery: any = {};
    let nextQuery: any = {};

    if (!countQuery["$and"]) {
      countQuery["$and"] = [];
    }

    if (!nextQuery["$and"]) {
      nextQuery["$and"] = [];
    }

    if (payload.chId) {
      nextQuery["$and"].push({
        chId: payload.chId,
        msg_type: {
          $nin: [msg_Type.ANNOUNCEMENT, msg_Type.PRE_MATCH_ANNOUNCEMENT],
        },
      });
      countQuery["$and"].push({
        chId: payload.chId,
        msg_type: {
          $nin: [msg_Type.ANNOUNCEMENT, msg_Type.PRE_MATCH_ANNOUNCEMENT],
        },
      });
      query.push({
        $match: {
          chId: payload.chId,
          msg_type: {
            $nin: [msg_Type.ANNOUNCEMENT, msg_Type.PRE_MATCH_ANNOUNCEMENT],
          },
        },
      });
    } else {
      nextQuery["$and"].push({
        $or: [
          {
            $and: [
              { senderId: new mongoose.Types.ObjectId(payload.senderId) },
              { receiverId: new mongoose.Types.ObjectId(payload.user_id) },
              {
                msg_type: {
                  $nin: [
                    msg_Type.ANNOUNCEMENT,
                    msg_Type.PRE_MATCH_ANNOUNCEMENT,
                  ],
                },
              },
            ],
          },
          {
            $and: [
              { senderId: new mongoose.Types.ObjectId(payload.user_id) },
              { receiverId: new mongoose.Types.ObjectId(payload.senderId) },
              {
                msg_type: {
                  $nin: [
                    msg_Type.ANNOUNCEMENT,
                    msg_Type.PRE_MATCH_ANNOUNCEMENT,
                  ],
                },
              },
            ],
          },
        ],
      });

      countQuery["$and"].push({
        $or: [
          {
            $and: [
              { senderId: new mongoose.Types.ObjectId(payload.senderId) },
              { receiverId: new mongoose.Types.ObjectId(payload.user_id) },
              {
                msg_type: {
                  $nin: [
                    msg_Type.ANNOUNCEMENT,
                    msg_Type.PRE_MATCH_ANNOUNCEMENT,
                  ],
                },
              },
            ],
          },
          {
            $and: [
              { senderId: new mongoose.Types.ObjectId(payload.user_id) },
              { receiverId: new mongoose.Types.ObjectId(payload.senderId) },
              {
                msg_type: {
                  $nin: [
                    msg_Type.ANNOUNCEMENT,
                    msg_Type.PRE_MATCH_ANNOUNCEMENT,
                  ],
                },
              },
            ],
          },
        ],
      });

      query.push({
        $match: {
          $and: [
            {
              $or: [
                {
                  $and: [
                    { senderId: new mongoose.Types.ObjectId(payload.senderId) },
                    {
                      receiverId: new mongoose.Types.ObjectId(payload.user_id),
                    },
                    {
                      msg_type: {
                        $nin: [
                          msg_Type.ANNOUNCEMENT,
                          msg_Type.PRE_MATCH_ANNOUNCEMENT,
                        ],
                      },
                    },
                  ],
                },
                {
                  $and: [
                    { senderId: new mongoose.Types.ObjectId(payload.user_id) },
                    {
                      receiverId: new mongoose.Types.ObjectId(payload.senderId),
                    },
                    {
                      msg_type: {
                        $nin: [
                          msg_Type.ANNOUNCEMENT,
                          msg_Type.PRE_MATCH_ANNOUNCEMENT,
                        ],
                      },
                    },
                  ],
                },
              ],
            },
          ],
        },
      });
    }

    if (payload.last_id) {
      nextQuery["$and"].push({
        _id: { $gte: new mongoose.Types.ObjectId(payload.last_id) },
      });
      // countQuery["$and"].push({ _id: { $gte: new mongoose.Types.ObjectId(payload.last_id) } });
      query.push({
        $match: { _id: { $lt: new mongoose.Types.ObjectId(payload.last_id) } },
      });
    } else {
      nextQuery["$and"] = {};
    }

    query.push(
      { $sort: { createdAt: -1 } },
      { $limit: payload.limit },
      {
        $lookup: {
          from: "groups",
          let: { gid: "$groupId" },
          pipeline: [
            {
              $match: {
                $expr: {
                  $eq: ["$$gid", "$_id"],
                },
              },
            },
            { $project: { _id: 1, groupName: 1 } },
          ],
          as: "groupId",
        },
      },
      {
        $lookup: {
          from: "users",
          let: { rid: "$receiverId" },
          pipeline: [
            {
              $match: {
                $expr: {
                  $eq: ["$$rid", "$_id"],
                },
              },
            },
            {
              $project: {
                _id: 1,
                legalFname: 1,
                legalLname: 1,
                preferredFname: 1,
                preferredLname: 1,
                role: 1,
                profilePic: 1,
                profilePicKey: 1,
                isDel: 1,
                isDisabled: 1,
              },
            },
          ],
          as: "receiverId",
        },
      },
      {
        $lookup: {
          from: "users",
          let: { sid: "$senderId" },
          pipeline: [
            {
              $match: {
                $expr: {
                  $eq: ["$$sid", "$_id"],
                },
              },
            },
            {
              $project: {
                _id: 1,
                legalFname: 1,
                legalLname: 1,
                preferredFname: 1,
                preferredLname: 1,
                role: 1,
                profilePic: 1,
                profilePicKey: 1,
                isDel: 1,
                isDisabled: 1,
              },
            },
          ],
          as: "senderId",
        },
      },
      {
        $lookup: {
          from: "contents",
          let: { cid: "$contentId" },
          pipeline: [
            {
              $match: {
                $expr: {
                  $eq: ["$$cid", "$_id"],
                },
              },
            },
            {
              $project: {
                _id: 1,
                thumbnailFile: 1,
                fileName: 1,
                type: 1,
                category: 1,
                contentFile: 1,
                contentLink: 1,
              },
            },
          ],
          as: "contentId",
        },
      },
      {
        $unwind: {
          path: "$groupId",
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $unwind: {
          path: "$groupId",
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $unwind: {
          path: "$senderId",
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $unwind: {
          path: "$contentId",
          preserveNullAndEmptyArrays: true,
        },
      }
    );

    // Get message List
    const getConversation = aggregate({
      collection: "Messages",
      pipeline: query,
    });

    // Get message count
    const countConversation = countDocuments({
      collection: "Messages",
      query: countQuery,
    });

    const getPreviousDataCount = countDocuments({
      collection: "Messages",
      query: nextQuery,
    });

    const responseConversation: any = await Promise.allSettled([
      getConversation,
      countConversation,
      getPreviousDataCount,
    ]);

    const pages = Math.ceil(responseConversation[1].value / payload.limit);
    const nextData = responseConversation[2].value
      ? responseConversation[2].value
      : 0;

    const conversationList: any = {
      page: payload.page,
      limit: payload.limit,
      isNextPage: responseConversation[1].value - nextData > 10 ? true : false,
      isPreviousPage: nextData > 0 ? true : false,
      totalData: responseConversation[1].value,
      totalPage: pages,
      data: responseConversation[0].value,
    };

    // Get shared content list
    const getSharedContent = await find({
      collection: "Messages",
      query: {
        $or: [
          {
            $and: [
              { senderId: payload.senderId },
              { receiverId: payload.user_id },
            ],
          },
          {
            $and: [
              { senderId: payload.user_id },
              { receiverId: payload.senderId },
            ],
          },
        ],
        msg_type: msg_Type.CONTENT,
      },
      sort: { createdAt: -1 },
      populate: [{ path: "contentId" }],
      limit: 4,
    });

    const dataObj: any = {};
    dataObj.event = "getMsg";
    dataObj.success = true;
    dataObj.data = {
      type: payload.type ? payload.type : "",
      conversationlist: conversationList,
      sharedContent: getSharedContent,
    };

    const userId = payload.socket_id ? payload.socket_id : payload.user_id;

    (global as any).io.to(userId).emit("response", dataObj);
  } catch (err: any) {
    logger.error(`There was an issue into get message.: ${err}`);
    (global as any).io
      .to(req.data.user_id)
      .emit("response", {
        event: "error",
        message: err,
        success: false,
        data: { event: "getMsg" },
      });
  }
};

/* Read message using socket function */
export const readMsg = async (req: any) => {
  try {
    console.log("Read Message Data============================>", req.data);

    const payload = req.data;

    const readConversation = await updateMany({
      collection: "Messages",
      query: { chId: payload.chId, receiverId: payload.user_id, read: false },
      update: { $set: { read: true } },
      options: { new: true },
    });

    const dataObj: any = {};
    if (readConversation) {
      dataObj.event = "readMsg";
      dataObj.success = true;
      dataObj.data = { message: "Success", chId: payload.chId };
    } else {
      dataObj.event = "readMsg";
      dataObj.success = true;
      dataObj.data = { message: "Something want wrong!", chId: payload.chId };
    }

    (global as any).io.to(payload.senderId).emit("response", dataObj);
  } catch (err: any) {
    logger.error(`There was an issue into read message.: ${err}`);
    (global as any).io
      .to(req.data.user_id)
      .emit("response", {
        event: "error",
        message: err,
        success: false,
        data: { event: "readMsg" },
      });
  }
};

/* Get message list using socket function */
export const getMsgList = async (req: any) => {
  try {
    console.log("Get Message List Data============================>", req.data);

    const payload = req.data;

    let query: any = [];

    query.push(
      {
        $match: {
          $and: [
            {
              $or: [
                {
                  senderId: new mongoose.Types.ObjectId(payload.user_id),
                  msg_type: {
                    $nin: [
                      msg_Type.ANNOUNCEMENT,
                      msg_Type.PRE_MATCH_ANNOUNCEMENT,
                    ],
                  },
                  chId: { $ne: null },
                  receiverId: { $ne: null },
                },
                {
                  receiverId: new mongoose.Types.ObjectId(payload.user_id),
                  msg_type: {
                    $nin: [
                      msg_Type.ANNOUNCEMENT,
                      msg_Type.PRE_MATCH_ANNOUNCEMENT,
                    ],
                  },
                  chId: { $ne: null },
                  senderId: { $ne: null },
                },
              ],
            },
          ],
        },
      },
      {
        $group: {
          _id: "$chId",
          document: { $first: "$$ROOT" },
        },
      },
      {
        $replaceRoot: { newRoot: "$document" },
      }
    );

    query.push(
      {
        $group: {
          _id: {
            $cond: {
              if: { $gt: ["$senderId", "$receiverId"] },
              then: { senderId: "$senderId", receiverId: "$receiverId" },
              else: { senderId: "$receiverId", receiverId: "$senderId" },
            },
          },
          chId: { $first: "$chId" },
          chType: { $first: "$chType" },
          senderId: { $first: "$senderId" },
          receiverId: { $first: "$receiverId" },
          message: { $first: "$message" },
          msg_type: { $first: "$msg_type" },
          reactions: { $first: "$reactions" },
          read: { $first: "$read" },
          messageSortDate: { $first: "$messageSortDate" },
          createdAt: { $first: "$createdAt" },
        },
      },
      {
        $addFields: {
          client: {
            $cond: [
              {
                $eq: [
                  "$senderId",
                  new mongoose.Types.ObjectId(payload.user_id),
                ],
              },
              "$receiverId",
              "$senderId",
            ],
          },
        },
      },
      {
        $lookup: {
          from: "users",
          localField: "client",
          foreignField: "_id",
          as: "users",
        },
      },
      {
        $lookup: {
          from: "groups",
          let: { gid: "$groupId" },
          pipeline: [
            {
              $match: {
                $expr: {
                  $eq: ["$$gid", "$_id"],
                },
              },
            },
            { $project: { _id: 1, groupName: 1 } },
          ],
          as: "group",
        },
      },
      {
        $unwind: "$users",
      },
      {
        $unwind: {
          path: "$group",
          preserveNullAndEmptyArrays: true,
        },
      }
    );

    if (payload.search) {
      query.push(
        {
          $addFields: {
            user_name: {
              $concat: ["$users.preferredFname", " ", "$users.preferredLname"],
            },
            reverseUsername: {
              $concat: ["$users.preferredLname", " ", "$users.preferredFname"],
            },
            withoutBlankName: {
              $concat: ["$users.preferredFname", "$users.preferredLname"],
            },
            reverseWithoutBlankName: {
              $concat: ["$users.preferredLname", "$users.preferredFname"],
            },
            preferredFname: "$users.preferredFname",
            preferredLname: "$users.preferredLname",
            groupName: "$group.groupName",
          },
        },
        {
          $match: {
            $or: [
              {
                user_name: {
                  $regex: ".*" + payload.search + ".*",
                  $options: "i",
                },
              },
              {
                reverseUsername: {
                  $regex: ".*" + payload.search + ".*",
                  $options: "i",
                },
              },
              {
                withoutBlankName: {
                  $regex: ".*" + payload.search + ".*",
                  $options: "i",
                },
              },
              {
                reverseWithoutBlankName: {
                  $regex: ".*" + payload.search + ".*",
                  $options: "i",
                },
              },
              {
                preferredFname: {
                  $regex: ".*" + payload.search + ".*",
                  $options: "i",
                },
              },
              {
                preferredLname: {
                  $regex: ".*" + payload.search + ".*",
                  $options: "i",
                },
              },
              // { groupName: { $regex: '.*' + payload.search + '.*', $options: 'i' } },
            ],
          },
        }
      );
    }

    query.push(
      {
        $lookup: {
          from: "messages",
          let: {
            chId: "$chId",
            rId: new mongoose.Types.ObjectId(payload.user_id),
          },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ["$$chId", "$chId"] },
                    { $eq: ["$$rId", "$receiverId"] },
                  ],
                },
                read: { $eq: false },
              },
            },
          ],
          as: "unreadMessage",
        },
      },
      {
        $addFields: {
          unreadMessage: { $size: "$unreadMessage" },
        },
      },
      {
        $lookup: {
          from: "messages",
          let: { sId: "$senderId", rId: "$receiverId" },
          pipeline: [
            {
              $match: {
                $expr: {
                  $or: [
                    {
                      $and: [
                        { $eq: ["$$sId", "$senderId"] },
                        { $eq: ["$$rId", "$receiverId"] },
                      ],
                    },
                    {
                      $and: [
                        { $eq: ["$$rId", "$senderId"] },
                        { $eq: ["$$sId", "$receiverId"] },
                      ],
                    },
                  ],
                },
              },
            },
            {
              $sort: { messageSortDate: -1 },
            },
            {
              $limit: 1,
            },
            {
              $addFields: {
                message: {
                  $cond: {
                    if: {
                      $gte: [{ $size: "$reactions" }, 1],
                    },
                    then: {
                      $concat: [
                        "Reacted ",
                        { $arrayElemAt: ["$reactions", 0] },
                        " on “",
                        "$message",
                      ],
                    },
                    else: "$message",
                  },
                },
                isReacted: {
                  $cond: {
                    if: {
                      $gte: [{ $size: "$reactions" }, 1],
                    },
                    then: true,
                    else: false,
                  },
                },
              },
            },
          ],
          as: "lastMessage",
        },
      },
      {
        $unwind: "$lastMessage",
      },
      {
        $project: {
          _id: 1,
          chId: 1,
          message: 1,
          senderId: 1,
          receiverId: 1,
          createdAt: 1,
          unRead: "$unreadMessage",
          read: 1,
          users: {
            _id: "$users._id",
            legalFname: "$users.legalFname",
            legalLname: "$users.legalLname",
            profilePic: "$users.profilePic",
            profilePicKey: "$users.profilePicKey",
            role: "$users.role",
            isDel: "$users.isDel",
            isDisabled: "$users.isDisabled",
            preferredFname: "$users.preferredFname",
            preferredLname: "$users.preferredLname",
          },
          group: 1,
          lastMessage: 1,
        },
      },
      // {
      //     $group: {
      //         _id: "$chId",
      //         chId: { $first: "$chId" },
      //         senderId: { $first: "$senderId" },
      //         receiverId: { $first: "$receiverId" },
      //         message: { $first: "$message" },
      //         createdAt: { $first: "$createdAt" },
      //         read: { $first: "$read" },
      //         unRead: { $first: "$unRead" },
      //         users: { $first: "$users" },
      //         group: { $first: "$group" },
      //         lastMessage: { $first: "$lastMessage" },
      //     }
      // },
      {
        $sort: {
          "lastMessage.createdAt": -1,
        },
      }
    );

    const myAggregate = await aggregate({
      collection: "Messages",
      pipeline: query,
    });

    const dataObj: any = {};
    dataObj.event = "getMsgList";
    dataObj.success = true;
    dataObj.data = myAggregate;

    (global as any).io.to(payload.user_id).emit("response", dataObj);
  } catch (err: any) {
    logger.error(`There was an issue into get message list.: ${err}`);
    (global as any).io
      .to(req.data.user_id)
      .emit("response", {
        event: "error",
        message: err,
        success: false,
        data: { event: "getMsgList" },
      });
  }
};

/* Send message reaction using socket function */
export const sendMsgReaction = async (req: any) => {
  try {
    console.log(
      "Send Message Reaction Data============================>",
      req.data
    );

    const payload = req.data;

    const chat = await findOne({
      collection: "Messages",
      query: {
        _id: payload.messageId,
        receiverId: payload.user_id,
        reactions: { $in: [payload.reactionType] },
      },
      populate: [
        {
          path: "senderId",
          select: "_id role preferredFname preferredLname profilePic",
        },
        {
          path: "receiverId",
          select: "_id role preferredFname preferredLname profilePic",
        },
      ],
    });

    const dataObj: any = {
      event: "sendMsgReaction",
      success: true,
      data: { reaction: payload.reactionType, messageId: payload.messageId },
    };

    if (!chat) {
      var updateConversation = await findOneAndUpdate({
        collection: "Messages",
        query: { _id: payload.messageId, receiverId: payload.user_id },
        update: {
          $set: {
            reactions: [payload.reactionType],
            messageSortDate: new Date(),
          },
        },
        options: { new: true },
      });

      var notification_message = updateConversation?.message
        ? updateConversation?.message
        : "";
      if (updateConversation?.msg_type === msg_Type.MESSAGE) {
        notification_message = updateConversation?.message;
      } else if (updateConversation?.msg_type === msg_Type.MEDIA) {
        let MediaExtensions = ["jpg", "jpeg", "png"];

        // Split the URL by dot (.)
        const parts = updateConversation?.messageFile.split(".").pop();

        if (MediaExtensions.includes(parts)) {
          notification_message = "Photo";
        }
      } else if (updateConversation?.msg_type === msg_Type.FILE) {
        let FileExtensions = ["ppt", "pptx", "doc", "docx", "pdf", "csv"];

        // Split the URL by dot (.)
        const parts = updateConversation?.messageFile.split(".").pop();

        if (parts === "mp3") {
          notification_message = "Audio";
        } else if (FileExtensions.includes(parts)) {
          notification_message = "File";
        }
      }

      updateConversation.message = `Reacted , ${
        payload.reactionType
      } on “${notification_message?.toLowerCase()}”`;
      updateConversation.isReacted =
        updateConversation.reactions.length > 0 ? true : false;
      dataObj.lastMessage = updateConversation;

      (global as any).io
        .to(payload.senderId)
        .to(payload.user_id)
        .emit("response", dataObj);

      // check user is connected or not, if not connected then send push notification
      // console.log("ReceiverId===================>", payload.senderId, "In ActiveUser Index===================>", Array.from((global as any).activeUsers).indexOf(payload.senderId));
      // if (Array.from((global as any).activeUsers).indexOf(payload.senderId) < 0) {
      //     const notiMessage: any = {
      //         userId: payload.user_id,
      //         user_role: payload.user_type,
      //         sendTo: [payload.senderId],
      //         type: notificationType.REACTION,
      //         content: notificationMessage.reactMessage.replace(':attribute', updateConversation?.msg_type === msg_Type.MESSAGE ? "message" : message?.toLowerCase()),
      //         dataId: payload.messageId
      //     };
      //     sendNotification(notiMessage)
      // }

      const conversation = await findOne({
        collection: "Messages",
        query: { _id: payload.messageId, receiverId: payload.user_id },
        populate: [
          {
            path: "senderId",
            select: "_id role preferredFname preferredLname profilePic",
          },
          {
            path: "receiverId",
            select: "_id role preferredFname preferredLname profilePic",
          },
        ],
      });

      var isNotify = await distinct({
        collection: "NotificationManage",
        field: "deviceId",
        query: { user_id: payload.senderId, messageNotification: true },
      });
      console.log("isNotify================>", isNotify);

      let sendPush = await authController.checkActiveUser(payload.senderId);

      if (sendPush == true && isNotify.length) {
        const notiMessage: any = {
          userId: payload.user_id,
          user_role: payload.user_type,
          sendTo: [payload.senderId],
          type: notificationType.REACTION,
          content: notificationMessage.reactMessage.replace(
            ":attribute",
            updateConversation?.msg_type === msg_Type.MESSAGE
              ? "message"
              : notification_message?.toLowerCase()
          ),
          dataId: payload.messageId,
        };
        sendNotification(notiMessage);
      }

      isNotify = isNotify.filter((device: any) => device !== "");
      isNotify = isNotify.filter((device: any) => device !== null);

      const badgeCounts = await countDocuments({
        collection: "Notification",
        query: { to: payload.senderId, read: false },
      });

      // let sendPush = await authController.checkActiveUser(payload.senderId);

      if (isNotify.length) {
        var message: any = {
          //this may vary according to the message type (single recipient, multicast, topic, et cetera)
          registration_ids: isNotify,
          priority: "high",
          notification: {
            title: payload.user_name,
            body:
              payload.user_name +
              " " +
              notificationMessage.reactMessage.replace(
                ":attribute",
                updateConversation?.msg_type === msg_Type.MESSAGE
                  ? "message"
                  : notification_message?.toLowerCase()
              ),
            imageUrl: conversation?.receiverId?.profilePic ?? "",
            image: conversation?.receiverId?.profilePic ?? "",
            badge: badgeCounts,
            sound: "default",
          },
          apns: {
            payload: {
              aps: {
                "mutable-content": 1,
              },
            },
            fcm_options: {
              image: conversation?.receiverId?.profilePic ?? "",
            },
          },
          data: {
            data: {
              chId: conversation?.chId,
              user: conversation?.receiverId._id?.toString(),
              user_id: conversation?.senderId._id?.toString(),
              user_type: conversation?.senderId.role,
              type: "reactMessage",
              screen: "MessageDetail",
              users: conversation?.receiverId,
            },
          },
        };

        if (!chat) {


            var updateConversation = await findOneAndUpdate({
                collection: "Messages",
                query: { _id: payload.messageId, receiverId: payload.user_id },
                update: { $set: { reactions: [payload.reactionType], messageSortDate: new Date() } },
                options: { new: true }
            });

            var notification_message = updateConversation?.message ? updateConversation?.message : "";
            if (updateConversation?.msg_type === msg_Type.MESSAGE) {
                notification_message = updateConversation?.message
            } else if (updateConversation?.msg_type === msg_Type.MEDIA) {
                let MediaExtensions = ["jpg", "jpeg", "png"];

                // Split the URL by dot (.)
                const parts = updateConversation?.messageFile.split(".").pop();

                if (MediaExtensions.includes(parts)) {
                    notification_message = "Photo"
                }

            } else if (updateConversation?.msg_type === msg_Type.FILE) {
                let FileExtensions = ["ppt", "pptx", "doc", "docx", "pdf", "csv"];

                // Split the URL by dot (.)
                const parts = updateConversation?.messageFile.split(".").pop();

                if (parts === "mp3") {
                    notification_message = "Audio"
                } else if (FileExtensions.includes(parts)) {
                    notification_message = "File"
                }
            }

            updateConversation.message = `Reacted , ${payload.reactionType} on “${notification_message?.toLowerCase()}”`;
            updateConversation.isReacted = updateConversation.reactions.length > 0 ? true : false;
            dataObj.lastMessage = updateConversation;

            (global as any).io.to(payload.senderId).to(payload.user_id).emit("response", dataObj);

            // check user is connected or not, if not connected then send push notification
            // console.log("ReceiverId===================>", payload.senderId, "In ActiveUser Index===================>", Array.from((global as any).activeUsers).indexOf(payload.senderId));
            // if (Array.from((global as any).activeUsers).indexOf(payload.senderId) < 0) {
            //     const notiMessage: any = {
            //         userId: payload.user_id,
            //         user_role: payload.user_type,
            //         sendTo: [payload.senderId],
            //         type: notificationType.REACTION,
            //         content: notificationMessage.reactMessage.replace(':attribute', updateConversation?.msg_type === msg_Type.MESSAGE ? "message" : message?.toLowerCase()),
            //         dataId: payload.messageId
            //     };
            //     sendNotification(notiMessage)
            // }

            const conversation = await findOne({
                collection: "Messages",
                query: { _id: payload.messageId, receiverId: payload.user_id },
                populate: [
                    { path: 'senderId', select: '_id role preferredFname preferredLname profilePic' },
                    { path: 'receiverId', select: '_id role preferredFname preferredLname profilePic' }
                ]
            });

            var isNotify = await distinct({ collection: 'NotificationManage', field: 'deviceId', query: { user_id: payload.senderId, messageNotification: true } });
            console.log("isNotify================>", isNotify);

            let sendPush = await authController.checkActiveUser(payload.senderId);

            if (sendPush == true && isNotify.length) {
                const notiMessage: any = {
                    userId: payload.user_id,
                    user_role: payload.user_type,
                    sendTo: [payload.senderId],
                    type: notificationType.REACTION,
                    content: notificationMessage.reactMessage.replace(':attribute', updateConversation?.msg_type === msg_Type.MESSAGE ? "message" : notification_message?.toLowerCase()),
                    dataId: payload.messageId
                };
                sendNotification(notiMessage)
            }

            isNotify = isNotify.filter((device: any) => device !== '');
            isNotify = isNotify.filter((device: any) => device !== null);

            const badgeCounts = await countDocuments({
                collection: 'Notification',
                query: { to: payload.senderId, read: false }
            });

            // let sendPush = await authController.checkActiveUser(payload.senderId);

            if (isNotify.length) {

                var message: any = { //this may vary according to the message type (single recipient, multicast, topic, et cetera)
                    registration_ids: isNotify,
                    priority: "high",
                    notification: {
                        title: payload.user_name,
                        body: payload.user_name + " " + notificationMessage.reactMessage.replace(':attribute', updateConversation?.msg_type === msg_Type.MESSAGE ? "message" : notification_message?.toLowerCase()),
                        imageUrl: conversation?.receiverId?.profilePic ?? "",
                        image: conversation?.receiverId?.profilePic ?? "",
                        badge: badgeCounts,
                        sound: "default",
                    },
                    apns: {
                        payload: {
                            aps: {
                                'mutable-content': 1
                            }
                        },
                        fcm_options: {
                            image: conversation?.receiverId?.profilePic ?? ""
                        }
                    },
                    data: {
                        data: {
                            chId: conversation?.chId,
                            user: conversation?.receiverId._id?.toString(),
                            user_id: conversation?.senderId._id?.toString(),
                            user_type: conversation?.senderId.role,
                            type: 'reactMessage',
                            screen: 'MessageDetail',
                            users: conversation?.receiverId
                        }
                    }
                };

                if (sendPush == true) {
                    PushNotification(message)
                }
            }

        } else {

            const latestMessage = await findOne({
                collection: "Messages",
                query: {
                    $or: [
                        { $and: [{ senderId: new mongoose.Types.ObjectId(payload.senderId) }, { receiverId: new mongoose.Types.ObjectId(payload.user_id) }] },
                        { $and: [{ senderId: new mongoose.Types.ObjectId(payload.user_id) }, { receiverId: new mongoose.Types.ObjectId(payload.senderId) }] }
                    ],
                    msg_type: { $nin: [msg_Type.ANNOUNCEMENT, msg_Type.PRE_MATCH_ANNOUNCEMENT] }
                },
                sort: { createdAt: -1 },
                limit: 1
            });

            var updateConversation = await findOneAndUpdate({
                collection: "Messages",
                query: { _id: payload.messageId, receiverId: payload.user_id },
                update: { $set: { messageSortDate: new Date(chat.createdAt), reactions: [] } },
                options: { new: true }
            });

            latestMessage.isReacted = false;
            dataObj.lastMessage = latestMessage;

            (global as any).io.to(payload.senderId).to(payload.user_id).emit("response", dataObj);

        }
      }
    } else {
      const latestMessage = await findOne({
        collection: "Messages",
        query: {
          $or: [
            {
              $and: [
                { senderId: new mongoose.Types.ObjectId(payload.senderId) },
                { receiverId: new mongoose.Types.ObjectId(payload.user_id) },
              ],
            },
            {
              $and: [
                { senderId: new mongoose.Types.ObjectId(payload.user_id) },
                { receiverId: new mongoose.Types.ObjectId(payload.senderId) },
              ],
            },
          ],
          msg_type: {
            $nin: [msg_Type.ANNOUNCEMENT, msg_Type.PRE_MATCH_ANNOUNCEMENT],
          },
        },
        sort: { createdAt: -1 },
        limit: 1,
      });

      var updateConversation = await findOneAndUpdate({
        collection: "Messages",
        query: { _id: payload.messageId, receiverId: payload.user_id },
        update: {
          $set: { messageSortDate: new Date(chat.createdAt), reactions: [] },
        },
        options: { new: true },
      });

      latestMessage.isReacted = false;
      dataObj.lastMessage = latestMessage;

      (global as any).io
        .to(payload.senderId)
        .to(payload.user_id)
        .emit("response", dataObj);
    }
  } catch (err: any) {
    console.error(`There was an issue into send message reaction.: ${err}`);
    logger.error(`There was an issue into send message reaction.: ${err}`);
    (global as any).io
      .to(req.data.user_id)
      .emit("response", {
        event: "error",
        message: err,
        success: false,
        data: { event: "sendMsgReaction" },
      });
  }
};

/* Message file upload function */
export const uploadMessageFile = async (req: Request, res: Response) => {
  try {
    console.log(req);

    const msgfile = req.file;
    const maxSize = messageUploadConstant.MESSAGE_FILE_SIZE;
    const extArr = uploadConstant.FILE_UPLOAD_EXT_ARR;

    // validate file
    const isValidFile = await validateFile(
      res,
      msgfile,
      "messageFile",
      extArr,
      maxSize
    );

    if (isValidFile !== undefined && isValidFile) {
      res
        .status(statusCode.OK)
        .send(error(isValidFile, {}, statusCode.BAD_REQUEST));
      return;
    }

    const uploadFile: any = await uploadToS3(msgfile, "messageFile");

    let file = "";
    let fileKey = "";

    if (uploadFile) {
      file = uploadFile.Location;
      fileKey = uploadFile.key;
    }

    res
      .status(statusCode.OK)
      .send(
        success(
          successMessage.UPLOAD_SUCCESS.replace(":attribute", "message file"),
          { file, fileKey },
          statusCode.OK
        )
      );
    return;
  } catch (err) {
    logger.error(
      `There was an issue into upload mentor message file.: ${err} `
    );
    res
      .status(statusCode.FORBIDDEN)
      .send(
        error(
          "There was an issue into upload mentor message file",
          { err },
          statusCode.FORBIDDEN
        )
      );
  }
};

/* Matched popup send */
export const matchedFound = async (req: any) => {
  try {
    console.log("Matched Found Data============================>", req.data);

    const payload = req.data;

    const getPairDetail = await findOne({
      collection: "PairInfo",
      query: {
        $or: [
          { _id: payload.dataId },
          {
            $and: [
              { menteeId: payload.menteeId },
              { mentorId: payload.mentorId },
            ],
          },
        ],
        isConfirm: true,
        isDel: false,
      },
      project: { mentorAns: 0, menteeAns: 0 },
      populate: [
        {
          path: "menteeId",
          select:
            "_id legalFname legalLname preferredFname preferredLname profilePic role",
        },
        {
          path: "mentorId",
          select:
            "_id legalFname legalLname preferredFname preferredLname profilePic role",
        },
      ],
    });

    if (!getPairDetail) {
      (global as any).io
        .to(payload.user_id)
        .emit("response", {
          event: "error",
          message: "Matched not found",
          success: false,
          data: { event: "matchedFound" },
        });
      return;
    }

    const dataObj: any = {};
    dataObj.event = "matchedFound";
    dataObj.success = true;
    dataObj.data = getPairDetail;

    if (payload.dataId) {
      (global as any).io.to(payload.user_id).emit("response", dataObj);
      return;
    } else {
      (global as any).io
        .to(payload.menteeId)
        .to(payload.mentorId)
        .emit("response", dataObj);
      return;
    }
  } catch (err) {
    logger.error(
      `There was an issue into upload mentor message file.: ${err} `
    );
    (global as any).io
      .to(req.data.user_id)
      .emit("response", {
        event: "error",
        message: err,
        success: false,
        data: { event: "matchedFound" },
      });
  }
};

/* Lesson completed socket function */
export const lessonCompleted = async (req: any) => {
  try {
    console.log("Lesson Completed Data============================>", req.data);

    const payload = req.data;

    const dataObj: any = {};
    dataObj.event = "lessonCompleted";
    dataObj.success = true;
    dataObj.data = payload;

    // updateProjectCompleteSystemBadge({ data: { _id: payload.userId } });

    let userId = payload.userId.toString();

    (global as any).io.to(userId).emit("response", dataObj);
    return;
  } catch (err) {
    logger.error(`There was an issue into lesson completed.: ${err} `);
    (global as any).io
      .to(req.data.user_id)
      .emit("response", {
        event: "error",
        message: err,
        success: false,
        data: { event: "lessonCompleted" },
      });
  }
};

/* Progress project send completed percentage socket function */
export const progressPercentage = async (req: any) => {
  try {
    console.log(
      "Progress Percentage Data============================>",
      req.data
    );

    const payload = req.data;

    const dataObj: any = {};
    dataObj.event = "progressPercentage";
    dataObj.success = true;
    dataObj.data = payload;

    if (payload && payload?.userId) {
      let userId = payload?.userId?.toString();
      (global as any).io.to(userId).emit("response", dataObj);
    }
    return;
  } catch (err) {
    logger.error(`There was an issue into progress percentage.: ${err} `);
    if (req && req.data && req.data.userId) {
      (global as any).io
        .to(req?.data?.userId?.toString())
        .emit("response", {
          event: "error",
          message: err,
          success: false,
          data: { event: "progressPercentage" },
        });
    }
  }
};

/* If user del or disabled than send socket event */
export const userInactivated = async (req: any) => {
  try {
    console.log("User Inactivated Data============================>", req.data);

    const payload = req.data;

    for await (const item of payload.users) {
      // Get send notification user role
      const user = await findOne({
        collection: "User",
        query: { _id: item.toString() },
      });

      const dataObj: any = {};
      dataObj.event = "userInactivated";
      dataObj.success = true;
      dataObj.data = {
        _id: user._id,
        legalFname: user.legalFname,
        legalLname: user.legalLname,
        role: user.role,
        isDel: user.isDel,
        isDisabled: user.isDisabled,
      };

      var user_id = item.toString();
      var admin_id = user?.partnerAdmin
        ? user.partnerAdmin.toString()
        : user.region.toString();

      if (user.role == userRoleConstant.MENTOR) {
        (global as any).io.to(user_id).to(admin_id).emit("response", dataObj);
        return;
      } else {
        const mentor = await findOne({
          collection: "PairInfo",
          query: {
            menteeId: item.toString(),
            isConfirm: true,
            isDel: false,
            isArchive: false,
          },
        });

        var mentor_id = mentor?.mentorId?.toString();

        (global as any).io
          .to(user_id)
          .to(admin_id)
          .to(mentor_id)
          .emit("response", dataObj);
        return;
      }
    }
  } catch (err) {
    logger.error(`There was an issue into user inactivated.: ${err} `);
    (global as any).io
      .to(req.data.user_id)
      .emit("response", {
        event: "error",
        message: err,
        success: false,
        data: { event: "userInactivated" },
      });
  }
};