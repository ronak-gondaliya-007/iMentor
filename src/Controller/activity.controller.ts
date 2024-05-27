import { Request, Response } from "express";
import {
    aggregate,
    countDocuments,
    distinct,
    find,
    findOne,
    findOneAndUpdate,
    insertOne,
    ObjectId,
    updateOne,
} from "../utils/db";
import {
    userRoleConstant,
    errorMessage,
    statusCode,
    successMessage,
    userStatusConstant,
    uploadConstant,
    defaultProfilePicConstant,
    ContentConstants,
    msg_Type,
    eventStatusConstant,
    eventTypeConstant,
    course_type,
    questionConst,
    event_status,
    eventAcceptenceTypeConstant,
} from "../utils/const";
import { success, error } from "../utils/helpers/resSender";
import { logger } from "../utils/helpers/logger";
import exportFileFunction from "../utils/exportCSV";
import { requestUser } from "../Interfaces/schemaInterfaces/user";
import moment from "moment";
import { startCase } from "lodash";
import { formateDate } from "../utils/helpers/functions";

export let activityController = {
    activityFeed: async (req: Request, res: Response) => {
        try {
            let request = req as requestUser;

            let { startDate, endDate, csvDownload } = req.body;
            let query: any = {}, partnerIdOrRegionId: any,
                page = req.body.page || 1,
                limit = req.body.limit || 10,
                sort = req.body.sort, groupMember: Array<any> = [];

            let groupId: Array<any> = request.body?.groupId || []

            if (request.user.region) {
                query["region"] = request.user.region;
                partnerIdOrRegionId = request.user.region
            } else if (request.user.partnerAdmin) {
                query["partnerAdmin"] = request.user.partnerAdmin;
                partnerIdOrRegionId = request.user.partnerAdmin;
            }

            let limitQuery: any = { $sort: { createdAt: -1 } };
            if (limit) {
                limitQuery = { $limit: limit };
            }

            let skipQuery: any = { $sort: { createdAt: -1 } };
            if (page) {
                skipQuery = { $skip: (page - 1) * limit };
            }

            query["isDel"] = false;
            query["role"] = {
                $in: req.body.type
                    ? req.body.type
                    : [userRoleConstant.MENTOR, userRoleConstant.MENTEE],
            };
            query["status"] = { $nin: [userStatusConstant.draft, userStatusConstant.REJECT] };

            if (groupId.length > 0) {
                groupMember = await distinct({ collection: 'Group', field: 'groupMember', query: { _id: { $in: groupId } } })
                query['_id'] = { $in: groupMember }
            }


            console.log(groupMember);

            // return false
            let pipeLine: Array<any> = [
                {
                    $project: {
                        _id: 1,
                        preferredFname: 1,
                        preferredLname: 1,
                        role: 1,
                        partnerAdmin: 1,
                        region: 1,
                        createdAt: 1,
                        isDel: 1,
                        status: 1
                    }
                },
                {
                    $match: { $and: [query, {}] },
                },
                {
                    $lookup: {
                        from: 'additionalinfos',
                        let: { userId: '$_id' },
                        pipeline: [{
                            $match: {
                                $expr: {
                                    $eq: ['$userId', '$$userId']
                                },
                                // 'education_level.assignedSchoolOrInstitutions': { $in: req.body.schoolOrInstitute }
                            },
                        }, { $project: { 'education_level': 1 } }],
                        as: 'additionalInfo'
                    }
                },
                {
                    $unwind: {
                        path: '$additionalInfo',
                        preserveNullAndEmptyArrays: true
                    }
                },
                {
                    $unwind: {
                        path: '$additionalInfo.education_level.assignedSchoolOrInstitutions',
                        preserveNullAndEmptyArrays: true
                    }
                },
                {
                    $match: {
                        // 'additionalInfo.education_level.assignedSchoolOrInstitutions': { $in: req.body.schoolOrInstitute }
                    }
                },

                {
                    $lookup: {
                        from: "messages",
                        let: {
                            senderId: "$_id",
                        },
                        pipeline: [
                            {
                                $match: {
                                    $expr: {
                                        $eq: ["$senderId", "$$senderId"],
                                    },
                                },
                            },
                            {
                                $sort: {
                                    createdAt: -1,
                                },
                            },
                        ],
                        as: "messages",
                    },
                },
                {
                    $unwind: {
                        path: "$messages",
                        preserveNullAndEmptyArrays: true,
                    },
                },
                {
                    $lookup: {
                        'from': 'additionalinfos',
                        'localField': '_id',
                        'foreignField': 'userId',
                        'as': 'userAddInfo'
                    },
                },
                {
                    $unwind: {
                        path: "$userAddInfo",
                        preserveNullAndEmptyArrays: true,
                    },
                },
                {
                    "$match": {
                        event: {
                            "$ne": {}
                        }
                    }
                },
                {
                    $group: {
                        _id: "$_id",
                        type: {
                            $first: "$role",
                        },
                        legalFname: {
                            $first: "$preferredFname",
                        },
                        legalLname: {
                            $first: "$preferredLname",
                        },
                        profilePic: {
                            $first: "$profilePic",
                        },
                        messages: {
                            $addToSet: "$messages",
                        },
                        LastMessages: {
                            $first: '$messages.createdAt' /* {
                                $first: "$messages.createdAt",
                            }, */
                        },
                        projects: {
                            $addToSet: "$project",
                        },
                        content: {
                            $addToSet: "$content",
                        },
                        contentViewed: { $addToSet: '$contentViewed' },
                        menteeSchool: { $first: '$userAddInfo.education_level.assignedSchoolOrInstitutions' },
                        createdAt: { $first: '$createdAt' }
                    },
                },
                {
                    $addFields: {
                        badgesSent: {
                            $filter: {
                                input: "$messages",
                                cond: {
                                    $eq: ["$$this.msg_type", msg_Type.BADGE],
                                },
                            },
                        },
                    },
                },
                {
                    $project: {
                        name: {
                            $concat: ["$legalFname", " ", "$legalLname"],
                        },
                        profilePic: 1,
                        type: 1,
                        messages: {
                            $size: "$messages",
                        },
                        LastMessages: 1,
                        projectStarted: {
                            $size: {
                                $filter: {
                                    input: "$projects",
                                    cond: { $and: [{ $lt: ["$$this.percentageCompleted", 100] }, { $gt: ['$$this.percentageCompleted', 0] }] },
                                },
                            },
                        },
                        projectCompleted: {
                            $size: {
                                $filter: {
                                    input: "$projects",
                                    cond: { $eq: ["$$this.percentageCompleted", 100] },
                                },
                            },
                        },
                        contentViewed: { $size: '$contentViewed' },
                        badgesSent: { $size: "$badgesSent" },
                        school: { $cond: [{ $eq: ['$type', userRoleConstant.MENTOR] }, '-', '$menteeSchool'] },
                        createdAt: 1
                    },
                },
            ];

            let eventPipeline: Array<any> = [
                {
                    $project: {
                        _id: 1,
                        preferredFname: 1,
                        preferredLname: 1,
                        role: 1,
                        partnerAdmin: 1,
                        region: 1,
                        createdAt: 1,
                        isDel: 1,
                        status: 1
                    }
                },
                {
                    $match: { $and: [query, {}] },
                },
                {
                    $lookup: {
                        from: "events",
                        let: { partnerId: "$partnerAdmin", regionId: "$region" },
                        pipeline: [
                            {
                                $match: {
                                    $expr: {
                                        $and: [
                                            {
                                                $or: [
                                                    { $eq: ["$partnerId", "$$partnerId"] },
                                                    { $eq: ["$regionId", "$$regionId"] },
                                                ],
                                            },
                                            {
                                                $eq: ["$event_type", eventTypeConstant.REGULAR],
                                            },
                                            {
                                                $eq: ["$isDel", false],
                                            },
                                            {
                                                $eq: ["$approval", eventStatusConstant.APPROVED]
                                            }
                                        ],
                                    },
                                },
                            },
                            {
                                $project: { event_name: 1, _id: 1, userId: 1, start_date: 1, createdAt: 1 }
                            }
                        ],
                        as: "events",
                    },
                },
                {
                    $addFields: {
                        events: {
                            $map: {
                                input: '$events',
                                as: 'item',
                                in: '$$item._id'
                            }
                        }
                    }
                },
                // {
                //     $unwind: {
                //         path: "$events",
                //         preserveNullAndEmptyArrays: true,
                //     },
                // },
                {
                    $lookup: {
                        from: "eventguests",
                        let: {
                            userId: "$_id",
                            eventId: "$events",
                        },
                        pipeline: [
                            {
                                $match: {
                                    $expr: {
                                        $and: [
                                            {
                                                $eq: ["$userId", "$$userId"],
                                            },
                                            {
                                                $in: ["$eventId", "$$eventId"],
                                            },
                                        ],
                                    },
                                },
                            },
                        ],
                        as: "event",
                    },
                },
                {
                    $unwind: {
                        path: "$event",
                        preserveNullAndEmptyArrays: true,
                    },
                },
                {
                    $lookup: {
                        from: "events",
                        let: { eventId: '$event.eventId' },
                        pipeline: [
                            {
                                $match: {
                                    $expr: {
                                        $and: [
                                            {
                                                $eq: ['$_id', '$$eventId']
                                            },
                                            // {
                                            //     $eq: ['$attendance', eventAcceptenceTypeConstant.ATTENDED]
                                            // }
                                        ]
                                    },
                                },
                            },
                            {
                                $project: { event_name: 1, _id: 1, userId: 1, start_date: 1, createdAt: 1 }
                            },
                            {
                                $sort: { createdAt: -1 }
                            }
                        ],
                        as: "event.eventId",
                    },
                },
                {
                    "$match": {
                        event: {
                            "$ne": {}
                        }
                    }
                },
                {
                    $group: {
                        _id: "$_id",
                        eventAttended: {
                            $addToSet: "$event",
                        }
                    },
                },
                {
                    $addFields: {
                        lastEventAttend: {
                            $arrayElemAt: [
                                {
                                    $filter: {
                                        input: '$eventAttended',
                                        as: 'item',
                                        cond: { $eq: ['$$item.attendance', eventAcceptenceTypeConstant.ATTENDED] }
                                    }
                                }, 0
                            ]
                        }
                    }
                },
                // // {
                // //     $addFields: {
                // //         answer:
                // //         {
                // //             $arrayElemAt: [
                // //                 {
                // //                     $filter: {
                // //                         input: "$answer",
                // //                         cond: {
                // //                             $ne: ['$$this', []]
                // //                         }
                // //                     }
                // //                 },
                // //                 0
                // //             ]
                // //         }
                // //     }
                // // },
                {
                    $addFields: {
                        eventAttended:
                        {
                            $filter: {
                                input: "$eventAttended",
                                as: "eventAttended",
                                cond: { $ne: ["$$eventAttended", {}] }
                            }
                        }
                    }
                },
                {
                    $project: {
                        eventInvited: {
                            $size: {
                                "$filter": {
                                    "input": "$eventAttended",
                                    "cond": {
                                        "$ne": [
                                            "$$this.eventId",
                                            []
                                        ]
                                    }
                                }

                            }
                        },
                        eventAccepted: {
                            $size: {
                                $filter: {
                                    input: "$eventAttended",
                                    cond: { $eq: ["$$this.status", eventStatusConstant.APPROVED] },
                                },
                            },
                        },
                        eventDeclined: {
                            $size: {
                                $filter: {
                                    input: "$eventAttended",
                                    cond: { $eq: ["$$this.status", eventStatusConstant.DECLINED] },
                                },
                            },
                        },
                        eventPending: {
                            $size: {
                                $filter: {
                                    input: "$eventAttended",
                                    cond: { $eq: ["$$this.status", eventStatusConstant.PENDING] },
                                },
                            },
                        },
                        eventAttended: {
                            $size: {
                                $filter: {
                                    input: "$eventAttended",
                                    cond: { $eq: ["$$this.attendance", eventAcceptenceTypeConstant.ATTENDED] },
                                },
                            },
                        },
                        eventNoShow: {
                            $size: {
                                $filter: {
                                    input: "$eventAttended",
                                    cond: { $eq: ["$$this.attendance", eventAcceptenceTypeConstant.NOSHOW] },
                                },
                            },
                        },
                        eventNoResponse: {
                            $size: {
                                $filter: {
                                    input: "$eventAttended",
                                    cond: { $eq: ["$$this.status", eventStatusConstant.PENDING] },
                                },
                            },
                        },
                        lastEventAttend: { $arrayElemAt: ['$lastEventAttend.eventId.start_date', 0] },
                    },
                },
            ]

            if (req.body.schoolOrInstitute && req.body.schoolOrInstitute.length > 0) {
                pipeLine.push({
                    $match: { 'school': { $in: req.body.schoolOrInstitute } }
                })
            }

            if (startDate && endDate) {
                // pipeLine[1]["$match"]["$and"][1]["createdAt"] = {
                //     $gte: new Date(startDate)/* moment(startDate.set({ hour: 0, minute: 0, second: 0 }).toDate() */,
                //     $lt: new Date(endDate)/* moment(endDate)set({ hour: 23, minute: 59, second: 59 }).toDate() */,
                // };

                // Messages 
                pipeLine[6]["$lookup"]["pipeline"][0]["$match"]["createdAt"] = {
                    $gte: new Date(startDate) /* moment(startDate).set({ hour: 0, minute: 0, second: 0 }).toDate() */,
                    $lt: new Date(endDate)/* moment(endDate).set({ hour: 23, minute: 59, second: 59 }).toDate() */,
                };

                // Event
                eventPipeline[2]["$lookup"]["pipeline"][0]["$match"]['$expr']['$and'].push({
                    $and: [{ $gte: ['$start_date', new Date(startDate)] }, { $lt: ['$start_date', new Date(endDate)] }]
                    // $gte: new Date(startDate) /* moment(startDate).set({ hour: 0, minute: 0, second: 0 }).toDate() */,
                    // $lt: new Date(endDate)/* moment(endDate).set({ hour: 23, minute: 59, second: 59 }).toDate() */,
                });

                // RecommenedCourse
                pipeLine[13]["$lookup"]["pipeline"][0]["$match"]["createdAt"] = {
                    $gte: new Date(startDate)/* moment(startDate).set({ hour: 0, minute: 0, second: 0 }).toDate() */,
                    $lt: new Date(endDate)/* moment(endDate).set({ hour: 23, minute: 59, second: 59 }).toDate() */,
                };
            }

            pipeLine.push({ $count: "name" });
            let getUserActivityCount: any = await aggregate({
                collection: "User",
                pipeline: pipeLine,
            });
            getUserActivityCount =
                getUserActivityCount[0] && getUserActivityCount[0].name
                    ? getUserActivityCount[0].name
                    : 0;
            pipeLine.pop();

            let sortKey: Array<any> = []

            if (sort) {
                sortKey = Object.keys(sort)

                if (sortKey[0] == 'eventAccepted' || sortKey[0] == 'eventAttended') {
                    eventPipeline.push({ $sort: { ...sort, _id: -1 } });
                } else {
                    if (sortKey[0] == "name") {
                        pipeLine.push(
                            {
                                $addFields: {
                                    "insensitive": { $toLower: `$${sortKey[0]}` }
                                }
                            }, {
                            $sort: { insensitive: sort[sortKey[0]], _id: sort[sortKey[0]] }
                        }
                        )
                    } else {
                        pipeLine.push({ $sort: { ...sort, _id: -1 } });
                    }
                }
            } else {
                eventPipeline.push({ $sort: { eventAttended: -1, _id: -1 } });
            }


            let exportResponseData: any = [],
                getUserActivity: any = [], eventList: Array<any> = [];

            if (csvDownload == true) {
                getUserActivity = await aggregate({
                    collection: "User",
                    pipeline: pipeLine,
                });

                eventList = await aggregate({ collection: 'User', pipeline: eventPipeline })

                getUserActivity = getUserActivity.map((x: any) => {
                    let events = eventList.find((event: any) => event._id.toString() === x._id.toString());

                    if (events) {
                        return {
                            ...x,
                            eventInvited: events.eventInvited,
                            eventAccepted: events.eventAccepted,
                            eventDeclined: events.eventDeclined,
                            eventPending: events.eventPending,
                            eventAttended: events.eventAttended,
                            eventNoShow: events.eventNoShow,
                            eventNoResponse: events.eventNoResponse,
                            lastEventAttend: events?.lastEventAttend || ''
                        };
                    } else {
                        return {
                            ...x,
                            eventInvited: 0,
                            eventAccepted: 0,
                            eventDeclined: 0,
                            eventPending: 0,
                            eventAttended: 0,
                            eventNoShow: 0,
                            eventNoResponse: 0,
                            lastEventAttend: ''
                        };
                    }
                });
                for (let i = 0; i < getUserActivity.length; i++) {
                    const element = getUserActivity[i];

                    exportResponseData.push({
                        'Name': element.name ? element.name : "",
                        'School/Institution': element.school ? element.school.toString() : "--",
                        'Type': element.type ? element.type : "",
                        'Messages': element.messages ? `${element.messages} Messages` : "0 Messaages",
                        'Last Messages': element.LastMessages ? formateDate(req, element.LastMessages) : "",
                        "Badges Sent": element.badgesSent ? element.badgesSent : "",
                        'Projects Started': element.projectStarted
                            ? element.projectStarted
                            : 0,
                        'Projects Completed': element.projectCompleted
                            ? element.projectCompleted
                            : 0,
                        'Content Viewed': element.contentViewed ? element.contentViewed : 0,
                        'Events Invited': element.eventInvited ? element.eventInvited : 0,
                        'Events Attended': element.eventAttended ? element.eventAttended : 0,
                        'Events No Show': element.eventNoShow ? element.eventNoShow : 0,
                        'Events Accepted': element.eventAccepted ? element.eventAccepted : 0,
                        'Events Declined': element.eventDeclined ? element.eventDeclined : 0,
                        'Events No Response': element.eventNoResponse ? element.eventNoResponse : 0,
                        'Last attended': element.lastEventAttend ? formateDate(req, element.lastEventAttend) : "-",
                    });
                }
            }

            if (!csvDownload) {
                if (page && limit) {
                    pipeLine.push(skipQuery);
                    pipeLine.push(limitQuery);
                    eventPipeline.push(skipQuery);
                    eventPipeline.push(limitQuery)
                }

                eventList = await aggregate({ collection: 'User', pipeline: eventPipeline })


                getUserActivity = await aggregate({
                    collection: "User",
                    pipeline: pipeLine,
                });


                getUserActivity = getUserActivity.map((x: any) => {
                    let events = eventList.find((event: any) => event._id.toString() === x._id.toString());

                    if (events) {
                        return {
                            ...x,
                            eventInvited: events.eventInvited,
                            eventAccepted: events.eventAccepted,
                            eventDeclined: events.eventDeclined,
                            eventPending: events.eventPending,
                            eventAttended: events.eventAttended,
                            eventNoShow: events.eventNoShow,
                            eventNoResponse: events.eventNoResponse,
                            lastEventAttend: events?.lastEventAttend || ''
                        };
                    } else {
                        return {
                            ...x,
                            eventInvited: 0,
                            eventAccepted: 0,
                            eventDeclined: 0,
                            eventPending: 0,
                            eventAttended: 0,
                            eventNoShow: 0,
                            eventNoResponse: 0,
                            lastEventAttend: ''
                        };
                    }
                });
            }

            // console.log("getUserActivity", getUserActivity)

            let result = {
                docs: getUserActivity,
                page: page,
                pages: Math.ceil(getUserActivityCount / limit),
                total: getUserActivityCount,
                limit: limit,
            };

            if (csvDownload) {
                getUserActivity = await exportFileFunction(
                    csvDownload,
                    "Reports",
                    exportResponseData,
                    res,
                    req
                );

                res.send(
                    success(
                        successMessage.FETCH_SUCCESS.replace(":attribute", "User activity"),
                        getUserActivity,
                        statusCode.OK
                    )
                );
            } else {
                res.send(
                    success(
                        successMessage.FETCH_SUCCESS.replace(":attribute", "User activity"),
                        result,
                        statusCode.OK
                    )
                );
            }
        } catch (err: any) {
            console.log(err);

            logger.error("There is some issue in activity feed.", err);
            res
                .status(statusCode.FORBIDDEN)
                .send(
                    error(
                        "There is some issue in activity feed.",
                        err.message,
                        statusCode.FORBIDDEN
                    )
                );
        }
    },

    pairMesssageReport: async (req: Request, res: Response) => {
        try {
            let request = req as requestUser;
            let { startDate, endDate } = req.body;

            startDate = new Date(startDate).setHours(0, 0, 0, 0);
            endDate = new Date(endDate).setHours(23, 59, 59, 999);

            let query: any = { isDel: false };
            query["role"] = {
                $in: [userRoleConstant.MENTEE, userRoleConstant.MENTOR],
            };

            if (request.user.region) {
                query["region"] = request.user.region;
            } else if (request.user.partnerAdmin) {
                query["partnerAdmin"] = request.user.partnerAdmin;
            }

            let pipeLine: Array<any> = [
                {
                    $match: query,
                },
                {
                    $lookup: {
                        from: "messages",
                        let: {
                            contentId: "$contentData.contentId",
                            role: "$role",
                            mentorId: "$_id",
                        },
                        pipeline: [
                            {
                                $match: {
                                    $expr: {
                                        $and: [
                                            {
                                                $eq: [userRoleConstant.MENTOR, "$$role"],
                                            },
                                            {
                                                $eq: ["$senderId", "$$mentorId"],
                                            },
                                        ],
                                    },
                                },
                            },
                        ],
                        as: "mentorMessages",
                    },
                },
                {
                    $lookup: {
                        from: "messages",
                        let: {
                            contentId: "$contentData.contentId",
                            role: "$role",
                            menteeId: "$_id",
                        },
                        pipeline: [
                            {
                                $match: {
                                    $expr: {
                                        $and: [
                                            {
                                                $eq: [userRoleConstant.MENTEE, "$$role"],
                                            },
                                            {
                                                $eq: ["$senderId", "$$menteeId"],
                                            },
                                        ],
                                    },
                                },
                            },
                        ],
                        as: "menteeMessages",
                    },
                },
                {
                    $group: {
                        _id: "$_id",
                        menteeMessages: { $first: "$menteeMessages" },
                        mentorMessages: { $first: "$mentorMessages" },
                        messageByPair: { $addToSet: "$messageByPair" },
                    },
                },
                {
                    $unwind: {
                        path: "$messageByPair",
                        preserveNullAndEmptyArrays: true,
                    },
                },
                {
                    $project: {
                        menteeMessage: { $size: "$menteeMessages" },
                        mentorMessage: { $size: "$mentorMessages" },
                        messagePair: {
                            $reduce: {
                                input: "$messageByPair",
                                initialValue: [],
                                in: {
                                    $concatArrays: ["$$value", "$$this._id"],
                                },
                            },
                        },
                        totalMessage: { $sum: ["$mentorMessage", "$menteeMessage"] },
                    },
                },
                {
                    $group: {
                        _id: null,
                        menteeMessage: { $sum: "$menteeMessage" },
                        mentorMessage: { $sum: "$mentorMessage" },
                        messageByPair: { $addToSet: "$messageByPair" },
                        totalMessage: {
                            $sum: { $add: ["$menteeMessage", "$mentorMessage"] },
                        },
                    },
                },
            ];

            let reportingData = await aggregate({
                collection: "User",
                pipeline: pipeLine,
            });

            res.send(
                success(
                    successMessage.FETCH_SUCCESS.replace(":attribute", "Activity feed"),
                    reportingData
                )
            );
        } catch (err: any) {
            res
                .status(statusCode.FORBIDDEN)
                .send(
                    error(
                        "There is some issue while fetching pair message report",
                        err.message
                    )
                );
        }
    },

    activityFeedProgressBar: async (req: Request, res: Response) => {
        try {
            let request = req as requestUser;

            let { startDate, endDate } = req.body;
            startDate = new Date(startDate).setHours(0, 0, 0, 0);
            endDate = new Date(endDate).setHours(23, 59, 59, 999);

            let query: any = { isDel: false };
            query["role"] = {
                $in: [userRoleConstant.MENTEE, userRoleConstant.MENTOR],
            };

            if (request.user.region) {
                query["region"] = request.user.region;
            } else if (request.user.partnerAdmin) {
                query["partnerAdmin"] = request.user.partnerAdmin;
            }

            let pipeLine: Array<any> = [
                {
                    $match: query,
                },
                {
                    $lookup: {
                        from: "recommendedcourses",
                        let: { userId: "$_id" },
                        pipeline: [
                            {
                                $match: {
                                    $expr: {
                                        $and: [
                                            { $eq: ["$userId", "$$userId"] },
                                            {
                                                $eq: [
                                                    "$courseType",
                                                    ContentConstants.COURSES_TYPE.content,
                                                ],
                                            },
                                        ],
                                    },
                                },
                            },
                        ],
                        as: "contentData",
                    },
                },
                {
                    $unwind: {
                        path: "$contentData",
                        preserveNullAndEmptyArrays: true,
                    },
                },
                {
                    $lookup: {
                        from: "recommendedcourses",
                        let: { userId: "$_id" },
                        pipeline: [
                            {
                                $match: {
                                    $expr: {
                                        $and: [
                                            { $eq: ["$userId", "$$userId"] },
                                            {
                                                $eq: [
                                                    "$courseType",
                                                    ContentConstants.COURSES_TYPE.project,
                                                ],
                                            },
                                        ],
                                    },
                                },
                            },
                        ],
                        as: "projectData",
                    },
                },
                {
                    $unwind: {
                        path: "$projectData",
                        preserveNullAndEmptyArrays: true, // this is required to avoid error while unwinding array of null values in project data
                    },
                },
                {
                    $lookup: {
                        from: "messages",
                        let: {
                            contentId: "$contentData.contentId",
                            role: "$role",
                            mentorId: "$_id",
                        },
                        pipeline: [
                            {
                                $match: {
                                    $expr: {
                                        $and: [
                                            // {
                                            //     $eq: ['$contentId', "$$contentId"]
                                            // },
                                            {
                                                $eq: [userRoleConstant.MENTOR, "$$role"],
                                            },
                                            {
                                                $eq: ["$senderId", "$$mentorId"],
                                            },
                                        ],
                                    },
                                },
                            },
                        ],
                        as: "mentorMessages",
                    },
                },
                {
                    $lookup: {
                        from: "messages",
                        let: {
                            contentId: "$contentData.contentId",
                            role: "$role",
                            menteeId: "$_id",
                        },
                        pipeline: [
                            {
                                $match: {
                                    $expr: {
                                        $and: [
                                            // {
                                            //     $eq: ['$contentId', "$$contentId"]
                                            // },
                                            {
                                                $eq: [userRoleConstant.MENTEE, "$$role"],
                                            },
                                            {
                                                $eq: ["$senderId", "$$menteeId"],
                                            },
                                        ],
                                    },
                                },
                            },
                        ],
                        as: "menteeMessages",
                    },
                },
                {
                    $addFields: {
                        contentSharedByMentees: {
                            $filter: {
                                input: {
                                    $cond: [
                                        { $ifNull: ["$contentData", false] },
                                        "$menteeMessages",
                                        [],
                                    ],
                                },
                                cond: {
                                    $eq: ["$$this.msg_type", msg_Type.CONTENT],
                                },
                            },
                        },
                    },
                },
                {
                    $addFields: {
                        contentSharedByMentors: {
                            $filter: {
                                input: {
                                    $cond: [
                                        { $ifNull: ["$contentData", false] },
                                        "$mentorMessages",
                                        [],
                                    ],
                                },
                                cond: {
                                    $eq: ["$$this.msg_type", msg_Type.CONTENT],
                                },
                            },
                        },
                    },
                },
                {
                    $lookup: {
                        from: "events",
                        let: { partnerId: "$partnerAdmin", regionId: "$regionId" },
                        pipeline: [
                            {
                                $match: {
                                    $expr: {
                                        $and: [
                                            {
                                                $or: [
                                                    { $eq: ["$partnerId", request.user.partnerAdmin] },
                                                    { $eq: ["$regionId", request.user.region] },
                                                ],
                                            },
                                            // {
                                            //     $eq: ['$userId', '$$userId']
                                            // },
                                            {
                                                $eq: ["$isDel", false],
                                            },
                                            {
                                                $eq: ["$approval", eventStatusConstant.APPROVED],
                                            },
                                        ],
                                    },
                                },
                            },
                        ],
                        as: "events",
                    },
                },
                {
                    $lookup: {
                        from: "eventguests",
                        let: { userId: "$_id" },
                        pipeline: [
                            {
                                $match: {
                                    $expr: {
                                        $and: [
                                            {
                                                $eq: ["$userId", "$$userId"],
                                            },
                                            {
                                                $eq: ["$isDel", false],
                                            },
                                            {
                                                $or: [
                                                    { $eq: ["$status", eventStatusConstant.APPROVED] },

                                                    { $eq: ["$status", eventStatusConstant.DECLINED] },
                                                ],
                                            },
                                            // {
                                            //     $eq: ['$status', { $in: [eventStatusConstant.APPROVED, eventStatusConstant.DECLINED] }]
                                            // }
                                        ],
                                    },
                                },
                            },
                        ],
                        as: "eventGuests",
                    },
                },

                {
                    $addFields: {
                        attendedEvents: {
                            $filter: {
                                input: "$eventGuests",
                                cond: {
                                    $eq: ["$$this.status", eventStatusConstant.APPROVED],
                                },
                            },
                        },
                    },
                },

                {
                    $lookup: {
                        from: "pairinfos",
                        let: { userId: "$_id" },
                        pipeline: [
                            {
                                $match: {
                                    $expr: {
                                        $and: [
                                            {
                                                $or: [
                                                    {
                                                        $eq: ["$mentorId", "$$userId"],
                                                    },
                                                    {
                                                        $eq: ["$menteeId", "$$userId"],
                                                    },
                                                ],
                                            },
                                            {
                                                $eq: ["$isConfirm", true],
                                            },
                                        ],
                                    },
                                },
                            },
                        ],
                        as: "pairData",
                    },
                },
                {
                    $unwind: {
                        path: "$pairData",
                        preserveNullAndEmptyArrays: true,
                    },
                },
                {
                    $lookup: {
                        from: "pairinfos",
                        let: {
                            mentorId: "$pairData.mentorId",
                            menteeId: "$pairData.menteeId",
                        },
                        pipeline: [
                            {
                                $match: {
                                    $expr: {
                                        $and: [
                                            {
                                                $and: [
                                                    {
                                                        $eq: ["$mentorId", "$$mentorId"],
                                                    },
                                                    {
                                                        $eq: ["$menteeId", "$$menteeId"],
                                                    },
                                                ],
                                            },
                                            {
                                                $eq: ["$isConfirm", true],
                                            },
                                        ],
                                    },
                                },
                            },
                        ],
                        as: "mentorMenteePair",
                    },
                },
                {
                    $lookup: {
                        from: "messages",
                        let: {
                            mentorId: "$pairData.mentorId",
                            menteeId: "$pairData.menteeId",
                        },
                        pipeline: [
                            {
                                $match: {
                                    $expr: {
                                        $and: [
                                            {
                                                $eq: ["$senderId", "$$mentorId"],
                                            },
                                            {
                                                $eq: ["$receiverId", "$$menteeId"],
                                            },
                                            // {
                                            //     $and: [
                                            //
                                            //     ]
                                            // },
                                            // {
                                            //     $and: [
                                            //         {
                                            //             $eq: ['$senderId', '$$menteeId']
                                            //         },
                                            //         {
                                            //             $eq: ['$receiverId', '$$mentorId']
                                            //         }
                                            //     ]
                                            // }
                                        ],
                                    },
                                },
                            },
                        ],
                        as: "pairMentorMessage",
                    },
                },
                {
                    $lookup: {
                        from: "messages",
                        let: {
                            mentorId: "$pairData.mentorId",
                            menteeId: "$pairData.menteeId",
                        },
                        pipeline: [
                            {
                                $match: {
                                    $expr: {
                                        $and: [
                                            {
                                                $eq: ["$senderId", "$$menteeId"],
                                            },
                                            {
                                                $eq: ["$receiverId", "$$mentorId"],
                                            },
                                        ],
                                    },
                                },
                            },
                        ],
                        as: "pairMenteeMessage",
                    },
                },

                // {
                //     $lookup: {
                //         from: 'messages',
                //         let: { mentorId: '$pairData.mentorId', menteeId: '$pairData.menteeId' },
                //         pipeline: [
                //             {
                //                 $match: {
                //                     $expr: {
                //                         $or: [
                //                             {
                //                                 $and: [
                //                                     {
                //                                         $eq: ['$senderId', '$$mentorId']
                //                                     },
                //                                     {
                //                                         $eq: ['$receiverId', '$$menteeId']
                //                                     },
                //                                     {
                //                                         $eq: ['$msg_type', msg_Type.PROJECT],
                //                                     }
                //                                 ]
                //                             },
                //                             {
                //                                 $and: [
                //                                     {
                //                                         $eq: ['$senderId', '$$menteeId']
                //                                     },
                //                                     {
                //                                         $eq: ['$receiverId', '$$mentorId']
                //                                     },
                //                                     {
                //                                         $eq: ['$msg_type', msg_Type.PROJECT],
                //                                     },
                //                                 ]
                //                             },

                //                         ]
                //                     }
                //                 }
                //             }
                //         ],
                //         as: 'projectSentByPair'
                //     }
                // },
                {
                    $lookup: {
                        from: "recommendedcourses",
                        let: {
                            mentorId: "$pairData.mentorId",
                            menteeId: "$pairData.menteeId",
                        },
                        pipeline: [
                            {
                                $match: {
                                    $expr: {
                                        $and: [
                                            {
                                                $eq: ["$userId", "$$mentorId"],

                                                // $or: [
                                                //     ,
                                                //     {
                                                //         $eq: ['$userId', '$$menteeId']
                                                //     }
                                                // ]
                                            },
                                            {
                                                $eq: ["$courseType", course_type.PROJECT],
                                            },
                                        ],
                                    },
                                },
                            },
                        ],
                        as: "projectSentByMentor",
                    },
                },
                {
                    $lookup: {
                        from: "recommendedcourses",
                        let: {
                            mentorId: "$pairData.mentorId",
                            menteeId: "$pairData.menteeId",
                        },
                        pipeline: [
                            {
                                $match: {
                                    $expr: {
                                        $and: [
                                            {
                                                $eq: ["$userId", "$$menteeId"],

                                                // $or: [
                                                //     ,
                                                //     {
                                                //         $eq: ['$userId', '$$menteeId']
                                                //     }
                                                // ]
                                            },
                                            {
                                                $eq: ["$courseType", course_type.PROJECT],
                                            },
                                        ],
                                    },
                                },
                            },
                        ],
                        as: "projectSentByMentee",
                    },
                },
                // {
                //     $unwind: {
                //         path: '$projectSentByPair',
                //         preserveNullAndEmptyArrays: true
                //     }
                // },
                {
                    $addFields: {
                        pairMessages: {
                            $cond: [
                                {
                                    $and: [
                                        { $gt: [{ $size: "$pairMentorMessage" }, 0] },
                                        { $gt: [{ $size: "$pairMenteeMessage" }, 0] },
                                    ],
                                },
                                { $concatArrays: ["$pairMentorMessage", "$pairMenteeMessage"] },
                                [],
                            ],
                        },
                    },
                },
                {
                    $addFields: {
                        projectSentByPair: {
                            $cond: [
                                {
                                    $and: [
                                        { $gt: [{ $size: "$projectSentByMentor" }, 0] },
                                        { $gt: [{ $size: "$projectSentByMentee" }, 0] },
                                    ],
                                },
                                {
                                    $concatArrays: [
                                        "$projectSentByMentor",
                                        "$projectSentByMentee",
                                    ],
                                },
                                [],
                            ],
                        },
                    },
                },
                {
                    $unwind: {
                        path: "$messageByPair",
                        preserveNullAndEmptyArrays: true,
                    },
                },
            ];

            pipeLine = [
                ...pipeLine,
                {
                    $group: {
                        _id: "$_id",
                        menteeMessages: { $first: "$menteeMessages" },
                        mentorMessages: { $first: "$mentorMessages" },
                        mentorContent: { $first: "$contentSharedByMentors" },
                        menteeContent: { $first: "$contentSharedByMentees" },
                        // events: { $first: '$events' },
                        eventGuests: { $first: "$eventGuests" },
                        approvedEvents: { $first: "$events" },
                        attendedEvents: { $first: "$attendedEvents" },
                        messageByPair: { $addToSet: "$pairMessages" },
                        projectData: { $first: "$projectData" },
                        projectSentByPair: { $addToSet: "$projectSentByPair" },
                        mentorMenteePair: { $addToSet: "$mentorMenteePair" },
                    },
                },
                // {
                //     $addFields: {

                //     }
                // }
                {
                    $project: {
                        menteeMessage: { $size: "$menteeMessages" },
                        mentorMessage: { $size: "$mentorMessages" },
                        contentSharedByMentor: { $size: "$mentorContent" },
                        contentSharedByMentee: { $size: "$menteeContent" },
                        // events: { $size: '$events' },
                        approvedEvents: { $size: "$approvedEvents" },
                        attendedEvents: { $size: "$attendedEvents" },
                        eventGuests: { $size: "$eventGuests" },
                        messageByPair: 1,
                        messagePair: {
                            $reduce: {
                                input: "$messageByPair",
                                initialValue: [],
                                in: {
                                    $concatArrays: ["$$value", "$$this._id"],
                                },
                            },
                        },
                        totalMessage: { $sum: ["$mentorMessage", "$menteeMessage"] },
                        startByPairs: {
                            $cond: [
                                {
                                    $and: [
                                        { $ne: ["$projectData", null] },
                                        { $gt: ["$projectData.percentageCompleted", 100] },
                                        { $lt: ["$projectData.percentageCompleted", 100] },
                                    ],
                                },
                                1,
                                0,
                            ],
                        },
                        completeByPairs: {
                            $cond: [{ $eq: ["$projectData.percentageCompleted", 100] }, 1, 0],
                        },
                        // projectSentByPair: { $size: '$projectSentByPair' },
                        projectSentByPair: 1,
                        projectSent: {
                            $reduce: {
                                input: "$projectSentByPair",
                                initialValue: [],
                                in: {
                                    $concatArrays: ["$$value", "$$this._id"],
                                },
                            },
                        },
                        totalPair: {
                            $reduce: {
                                input: "$mentorMenteePair",
                                initialValue: [],
                                in: {
                                    $concatArrays: ["$$value", "$$this._id"],
                                },
                            },
                        },
                    },
                },
                {
                    $group: {
                        _id: null,
                        menteeMessage: { $sum: "$menteeMessage" },
                        mentorMessage: { $sum: "$mentorMessage" },
                        totalMessage: {
                            $sum: { $add: ["$menteeMessage", "$mentorMessage"] },
                        },
                        contentSharedByMentor: { $sum: "$contentSharedByMentor" },
                        contentSharedByMentee: { $sum: "$contentSharedByMentee" },
                        totalContent: {
                            $sum: {
                                $add: ["$contentSharedByMentor", "$contentSharedByMentee"],
                            },
                        },
                        events: { $sum: "$events" },
                        approvedEvents: { $sum: "$approvedEvents" },
                        attendedEvents: { $sum: "$attendedEvents" },
                        messageByPair: { $addToSet: "$messagePair" },
                        startByPairs: { $sum: "$startByPairs" },
                        completeByPairs: { $sum: "$completeByPairs" },
                        eventGuests: { $sum: "$eventGuests" },
                        projectSentByPair: { $addToSet: "$projectSent" },
                        totalPairs: { $addToSet: "$totalPair" },
                    },
                },
                {
                    $addFields: {
                        messageByPair: {
                            $size: {
                                $filter: {
                                    input: {
                                        $reduce: {
                                            input: "$messageByPair",
                                            initialValue: [],
                                            in: { $setUnion: ["$$value", "$$this"] },
                                        },
                                    },
                                    cond: { $ne: ["$$this", "None"] },
                                },
                            },
                        },
                        /*  { $size: { $arrayElemAt: ['$messageByPair', 1] } } */
                    },
                },
                {
                    $addFields: {
                        projectSentByPair: {
                            $toInt: {
                                $divide: [
                                    {
                                        $size: {
                                            $filter: {
                                                input: {
                                                    $reduce: {
                                                        input: "$projectSentByPair",
                                                        initialValue: [],
                                                        in: { $setUnion: ["$$value", "$$this"] },
                                                    },
                                                },
                                                cond: { $ne: ["$$this", "None"] },
                                            },
                                        },
                                    },
                                    2,
                                ],
                            },
                        },
                        /* { $size: { $arrayElemAt: ['$projectSentByPair', 1] } } */
                    },
                },
                {
                    $addFields: {
                        totalPairs: {
                            $size: {
                                $filter: {
                                    input: {
                                        $reduce: {
                                            input: "$totalPairs",
                                            initialValue: [],
                                            in: { $setUnion: ["$$value", "$$this"] },
                                        },
                                    },
                                    cond: { $ne: ["$$this", "None"] },
                                },
                            },
                        },
                        /* { $size: { $arrayElemAt: ['$projectSentByPair', 1] } } */
                    },
                },
                // },
                // {
                //     $addFields: {
                //         percentageOfRSVP: {
                //             $round: [
                //                 {
                //                     $cond: [{ $gt: ['$eventGuests', 0] }, { $multiply: [{ $divide: ['$eventGuests', '$approvedEvents'] }, 100] }, 0],

                //                 },
                //                 2
                //             ]
                //         }
                //     }
                // },
                // {
                //     $addFields: {
                //         totalPairs: { $sum: ['$startByPairs', '$completeByPairs'] }
                //     }
                // },
            ];

            if (startDate && endDate) {
                pipeLine[1]["$lookup"]["pipeline"][0]["$match"]["createdAt"] = {
                    $gte: new Date(startDate),
                    $lte: new Date(endDate),
                };

                pipeLine[3]["$lookup"]["pipeline"][0]["$match"]["createdAt"] = {
                    $gte: new Date(startDate),
                    $lte: new Date(endDate),
                };

                pipeLine[5]["$lookup"]["pipeline"][0]["$match"]["createdAt"] = {
                    $gte: new Date(startDate),
                    $lte: new Date(endDate),
                };

                pipeLine[9]["$lookup"]["pipeline"][0]["$match"]["createdAt"] = {
                    $gte: new Date(startDate),
                    $lte: new Date(endDate),
                };
            }

            let reportingData = await aggregate({
                collection: "User",
                pipeline: pipeLine,
            });

            res.send(
                success(
                    successMessage.FETCH_SUCCESS.replace(":attribute", "Activity feed"),
                    reportingData
                )
            );
        } catch (err: any) {
            res
                .status(statusCode.FORBIDDEN)
                .send(
                    error(
                        "There is some issue while fetching activity feed data",
                        err.message
                    )
                );
        }
    }, 

    pairReport: async (req: Request, res: Response) => {
        try {
            let request = req as requestUser;

            let { startDate, endDate } = req.body

            let query: any = { isConfirm: true };

            if (request.user.partnerAdmin) {
                query["partnerId"] = request.user.partnerAdmin;
            } else if (request.user.region) {
                query["regionId"] = request.user.region;
            } else {
                res
                    .status(statusCode.UNAUTHORIZED)
                    .send(
                        error(
                            errorMessage.ACTION.replace(":attribute", request.user.role),
                            {},
                            statusCode.UNAUTHORIZED
                        )
                    );
                return;
            }

            let pipeLine: Array<any> = [
                {
                    $match: { $and: [query, {}] },
                },
                {
                    $project: {
                        menteeId: 1, mentorId: 1, partnerIdOrRegionId: 1
                    }
                },
                {
                    $lookup: {
                        from: "events",
                        let: {
                            partnerIdOrRegionId: "$partnerIdOrRegionId",
                            regionId: "$regionId",
                        },
                        pipeline: [
                            {
                                $match: {
                                    $expr: {
                                        $and: [
                                            { $eq: ['$event_type', eventTypeConstant.REGULAR] },
                                            {
                                                $or: [
                                                    {
                                                        $eq: ["$partnerId", "$$partnerIdOrRegionId"],
                                                    },
                                                    {
                                                        $eq: ["$regionId", "$$partnerIdOrRegionId"],
                                                    },
                                                ],
                                            },
                                        ]

                                    },

                                },
                            },
                            {
                                $project: { _id: 1, status: 1, userId: 1, partnerId: 1, regionId: 1, event_type: 1 }
                            }
                        ],
                        as: "events",
                    },
                },
                {
                    $unwind: {
                        path: "$events",
                        preserveNullAndEmptyArrays: true,
                    },
                },
                {
                    $lookup: {
                        from: "eventguests",
                        localField: "events._id",
                        foreignField: "eventId",
                        as: "eventguests",
                    },
                },
                {
                    $addFields: {
                        attendedEvents: {
                            $filter: {
                                input: "$eventguests",
                                cond: {
                                    $eq: ["$$this.status", "Approved"],
                                    // $or: [
                                    //     {
                                    //         $eq: ["$$this.status", "Approved"],
                                    //     },
                                    //     {}
                                    //     // {
                                    //     //     $eq: ["$$this.status", "Declined"],
                                    //     // },
                                    // ],
                                },
                            },
                        },
                    },
                },
                {
                    $lookup: {
                        from: "contents",
                        let: {
                            partnerIdOrRegionId: "$partnerIdOrRegionId",
                            regionId: "$regionId",
                        },
                        pipeline: [
                            {
                                $match: {
                                    $expr: {
                                        $or: [
                                            {
                                                $eq: ["$partnerIdOrRegionId", "$$partnerIdOrRegionId"],
                                            },
                                            {
                                                $eq: ["$partnerIdOrRegionId", "$$partnerIdOrRegionId"],
                                            },
                                        ],
                                    },
                                },
                            },
                            {
                                $project: { _id: 1, isArchived: 1, contentViewedCount: 1, partnerIdOrRegionId: 1 }
                            }
                        ],
                        as: "contents",
                    },
                },
                {
                    $unwind: {
                        path: "$contents",
                        preserveNullAndEmptyArrays: true,
                    },
                },
                {
                    $lookup: {
                        from: "messages",
                        let: {
                            mentorId: "$mentorId",
                            menteeId: "$menteeId",
                        },
                        pipeline: [
                            {
                                $match: {
                                    $expr: {
                                        $and: [
                                            {
                                                $eq: ["$senderId", "$$mentorId"],
                                            },
                                            {
                                                $eq: ["$receiverId", "$$menteeId"],
                                            },
                                        ],
                                    },
                                },
                            },
                            {
                                $project: { _id: 1, senderId: 1, receiverId: 1, contentId: 1, message: 1, msg_type: 1 }
                            }
                        ],
                        as: "mentorMessages",
                    },
                },
                {
                    $lookup: {
                        from: "messages",
                        let: {
                            menteeId: "$menteeId",
                            mentorId: "$mentorId",
                        },
                        pipeline: [
                            {
                                $match: {
                                    $expr: {
                                        $and: [
                                            {
                                                $eq: ["$senderId", "$$menteeId"],
                                            },
                                            {
                                                $eq: ["$receiverId", "$$mentorId"],
                                            },
                                        ],
                                    },
                                },
                            },
                            {
                                $project: { _id: 1, senderId: 1, receiverId: 1, contentId: 1, message: 1, msg_type: 1 }
                            }
                        ],
                        as: "menteeMessages",
                    },
                },
                {
                    $addFields: {
                        contentSharedByMentor: {
                            $filter: {
                                input: "$mentorMessages",
                                cond: {
                                    $eq: ["$$this.msg_type", "Content"],
                                },
                            },
                        },
                    },
                },
                {
                    $addFields: {
                        contentSharedByMentee: {
                            $filter: {
                                input: "$menteeMessages",
                                cond: {
                                    $eq: ["$$this.msg_type", "Content"],
                                },
                            },
                        },
                    },
                },
                {
                    $unwind: {
                        path: "$contentSharedByMentee",
                        preserveNullAndEmptyArrays: true,
                    },
                },
                {
                    $unwind: {
                        path: "$contentSharedByMentor",
                        preserveNullAndEmptyArrays: true,
                    },
                },
                {
                    $unwind: {
                        path: "$menteeMessages",
                        preserveNullAndEmptyArrays: true,
                    },
                },
                {
                    $unwind: {
                        path: "$mentorMessages",
                        preserveNullAndEmptyArrays: true,
                    },
                },
                {
                    $unwind: {
                        path: "$attendedEvents",
                        preserveNullAndEmptyArrays: true,
                    },
                },
                {
                    $group: {
                        _id: "$_id",
                        events: { $addToSet: "$events" },
                        eventGuest: { $addToSet: "$eventguests" },
                        attendedEvents: {
                            $addToSet: "$attendedEvents",
                        },
                        messagesSendByMentor: { $addToSet: "$mentorMessages" },
                        messagesSendByMentee: { $addToSet: "$menteeMessages" },
                        contents: { $addToSet: "$contents" },
                        contentSharedByMentor: { $addToSet: "$contentSharedByMentor" },
                        contentSharedByMentee: { $addToSet: "$contentSharedByMentee" },
                    },
                },
                {
                    $group: {
                        _id: null,
                        events: { $push: "$events" },
                        eventGuest: { $first: "$eventGuest" },
                        attendedEvents: {
                            $push: "$attendedEvents",
                        },
                        messagesSendByMentor: { $push: "$messagesSendByMentor" },
                        messagesSendByMentee: { $push: "$messagesSendByMentee" },
                        contents: { $push: "$contents" },
                        contentSharedByMentor: { $push: "$contentSharedByMentor" },
                        contentSharedByMentee: { $push: "$contentSharedByMentee" },
                    },
                },
                {
                    $addFields: {
                        totalInvited: {
                            $size: {
                                $filter: {
                                    input: {
                                        $reduce: {
                                            input: "$eventGuest",
                                            initialValue: [],
                                            in: {
                                                $setUnion: ["$$value", "$$this"],
                                            },
                                        },
                                    },
                                    cond: { $ne: ["$$this", "None"] },
                                },
                            },
                        },
                        /*  { $size: { $arrayElemAt: ['$messageByPair', 1] } } */
                    },
                },
                {
                    $addFields: {
                        availableContent: {
                            $size: {
                                $filter: {
                                    input: {
                                        $reduce: {
                                            input: "$contents",
                                            initialValue: [],
                                            in: {
                                                $setUnion: ["$$value", "$$this"],
                                            },
                                        },
                                    },
                                    cond: { $eq: ["$$this.isArchived", false] },
                                },
                            },
                        },
                        /*  { $size: { $arrayElemAt: ['$messageByPair', 1] } } */
                    },
                },
                {
                    $addFields: {
                        archivedContent: {
                            $size: {
                                $filter: {
                                    input: {
                                        $reduce: {
                                            input: "$contents",
                                            initialValue: [],
                                            in: {
                                                $setUnion: ["$$value", "$$this"],
                                            },
                                        },
                                    },
                                    cond: { $eq: ["$$this.isArchived", true] },
                                },
                            },
                        },
                        /*  { $size: { $arrayElemAt: ['$messageByPair', 1] } } */
                    },
                },
                {
                    $addFields: {
                        rsvpCount: {
                            $size: {
                                $filter: {
                                    input: {
                                        $reduce: {
                                            input: "$eventGuest",
                                            initialValue: [],
                                            in: {
                                                $setUnion: ["$$value", "$$this"],
                                            },
                                        },
                                    },
                                    cond: {
                                        $or: [
                                            { $eq: ["$$this.status", eventStatusConstant.APPROVED] },
                                            { $eq: ["$$this.status", eventStatusConstant.DECLINED] },
                                        ],
                                    },
                                },
                            },
                        },
                        /*  { $size: { $arrayElemAt: ['$messageByPair', 1] } } */
                    },
                },
                {
                    $addFields: {
                        rsvpPercentage: {
                            $cond: [
                                { $eq: ["$totalInvited", 0] },
                                0,
                                {
                                    $round: [
                                        {
                                            $multiply: [
                                                {
                                                    $divide: ["$rsvpCount", "$totalInvited"],
                                                },
                                                100,
                                            ],
                                        },
                                        2,
                                    ],
                                },
                            ],
                        },
                    },
                },
                {
                    $addFields: {
                        attended: {
                            $size: {
                                $filter: {
                                    input: {
                                        $reduce: {
                                            input: "$attendedEvents",
                                            initialValue: [],
                                            in: {
                                                $setUnion: ["$$value", "$$this.eventId"],
                                            },
                                        },
                                    },
                                    cond: { $ne: ["$$this", "None"] },
                                },
                            },
                        },
                        /*  { $size: { $arrayElemAt: ['$messageByPair', 1] } } */
                    },
                },
                {
                    $addFields: {
                        totalEvent: {
                            $size: {
                                $filter: {
                                    input: {
                                        $reduce: {
                                            input: "$events",
                                            initialValue: [],
                                            in: {
                                                $setUnion: ["$$value", "$$this"],
                                            },
                                        },
                                    },
                                    cond: { $ne: ["$$this", "None"] },
                                },
                            },
                        },
                        /*  { $size: { $arrayElemAt: ['$messageByPair', 1] } } */
                    },
                },
                {
                    $addFields: {
                        contentSharedByMentorCount: {
                            $size: {
                                $filter: {
                                    input: {
                                        $reduce: {
                                            input: "$contentSharedByMentor",
                                            initialValue: [],
                                            in: {
                                                $setUnion: ["$$value", "$$this.contentId"],
                                            },
                                        },
                                    },
                                    cond: { $ne: ["$$this", "None"] },
                                },
                            },
                        },
                        /*  { $size: { $arrayElemAt: ['$messageByPair', 1] } } */
                    },
                },
                {
                    $addFields: {
                        contentSharedByMenteeCount: {
                            $size: {
                                $filter: {
                                    input: {
                                        $reduce: {
                                            input: "$contentSharedByMentee",
                                            initialValue: [],
                                            in: {
                                                $setUnion: ["$$value", "$$this.contentId"],
                                            },
                                        },
                                    },
                                    cond: { $ne: ["$$this", "None"] },
                                },
                            },
                        },
                        /*  { $size: { $arrayElemAt: ['$messageByPair', 1] } } */
                    },
                },
                {
                    $addFields: {
                        totalContents: { $add: ["$availableContent", "$archivedContent"] },
                    },
                },
                {
                    $addFields: {
                        mentorMessagesCount: {
                            $size: {
                                $filter: {
                                    input: {
                                        $reduce: {
                                            input: "$messagesSendByMentor",
                                            initialValue: [],
                                            in: {
                                                $setUnion: ["$$value", "$$this"],
                                            },
                                        },
                                    },
                                    cond: { $ne: ["$$this", "None"] },
                                },
                            },
                        },
                        /*  { $size: { $arrayElemAt: ['$messageByPair', 1] } } */
                    },
                },
                {
                    $addFields: {
                        menteeMessagesCount: {
                            $size: {
                                $filter: {
                                    input: {
                                        $reduce: {
                                            input: "$messagesSendByMentee",
                                            initialValue: [],
                                            in: {
                                                $setUnion: ["$$value", "$$this"],
                                            },
                                        },
                                    },
                                    cond: { $ne: ["$$this", "None"] },
                                },
                            },
                        },
                        /*  { $size: { $arrayElemAt: ['$messageByPair', 1] } } */
                    },
                },
                {
                    $addFields: {
                        pairMessages: {
                            $add: ["$mentorMessagesCount", "$menteeMessagesCount"],
                        },
                    },
                },
                {
                    $project: { events: 0, eventGuest: 0, attendedEvents: 0, messagesSendByMentor: 0, messagesSendByMentee: 0, contents: 0, contentSharedByMentor: 0, contentSharedByMentee: 0 }
                }
                // {
                //   $lookup: {
                //     from: 'users',
                //     let: {mentorId: '$mentorId', menteeId: '$menteeId'},
                //     pipeline: [
                //       {
                //         $match: {
                //           $expr: {
                //             $or: [
                //               {$eq: ['$_id', '$$mentorId']},
                //               {$eq: ['$_id', '$$menteeId']}
                //             ]
                //           }
                //         }
                //       }
                //     ],
                //     as: 'users'
                //   }
                // }
            ];

            if (startDate && endDate) {
                pipeLine[0]["$match"]["$and"][1]["createdAt"] = {
                    $gte: moment(startDate).set({ hour: 0, minute: 0, second: 0 }).toDate(),
                    $lte: moment(endDate).set({ hour: 23, minute: 59, second: 59 }).toDate(),
                };

                pipeLine[2]["$lookup"]["pipeline"][0]["$match"]["start_date"] = {
                    $gte: moment(startDate).set({ hour: 0, minute: 0, second: 0 }).toDate(),
                    $lte: moment(endDate).set({ hour: 23, minute: 59, second: 59 }).toDate(),
                };

                pipeLine[8]["$lookup"]["pipeline"][0]["$match"]["createdAt"] = {
                    $gte: moment(startDate).set({ hour: 0, minute: 0, second: 0 }).toDate(),
                    $lte: moment(endDate).set({ hour: 23, minute: 59, second: 59 }).toDate(),
                };

                pipeLine[9]["$lookup"]["pipeline"][0]["$match"]["createdAt"] = {
                    $gte: moment(startDate).set({ hour: 0, minute: 0, second: 0 }).toDate(),
                    $lte: moment(endDate).set({ hour: 23, minute: 59, second: 59 }).toDate(),
                };
            }


            let pairReport = await aggregate({
                collection: "PairInfo",
                pipeline: pipeLine,
            });
            res.send(
                success(
                    successMessage.FETCH_SUCCESS.replace(":attribute", "PairReport"),
                    pairReport
                )
            );
        } catch (err: any) {
            res
                .status(statusCode.FORBIDDEN)
                .send(
                    error(
                        "There is some issue in Pair Reporting",
                        err.message,
                        statusCode.FORBIDDEN
                    )
                );
        }
    },

    // filterOption: async (req: Request, res: Response) => {
    //     try {
    //         let request = req as requestUser;
    //         let query = {}

    //         let pipeLine: Array<any> = [
    //             {
    //                 $match: {
    //                     $and: [
    //                         {
    //                             role: { $in: [userRoleConstant.MENTEE, userRoleConstant.MENTOR] }
    //                         },
    //                         {
    //                             isDel: false
    //                         },
    //                         {
    //                             status: { $nin: [userStatusConstant.draft] }
    //                         },
    //                         {
    //                             $or: [
    //                                 {
    //                                     partnerAdmin: request.user.partnerAdmin
    //                                 },
    //                                 {
    //                                     region: request.user.region
    //                                 }
    //                             ]
    //                         }
    //                     ]
    //                 }
    //             },
    //             {
    //                 $lookup: {
    //                     from: 'additionalinfos',
    //                     let: { userId: '$_id' },
    //                     pipeline: [
    //                         {
    //                             $match: {
    //                                 $expr: {
    //                                     $eq: ['$userId', '$$userId']
    //                                 }
    //                             }
    //                         },
    //                         {
    //                             $project: { 'education_level': 1 }
    //                         }
    //                     ],
    //                     as: 'userInfo'
    //                 }
    //             },
    //             {
    //                 $unwind: {
    //                     path: '$userInfo',
    //                     preserveNullAndEmptyArrays: true,
    //                 }
    //             },
    //             {
    //                 $unwind: {
    //                     path: '$userInfo.education_level.assignedSchoolOrInstitutions',
    //                     preserveNullAndEmptyArrays: true,
    //                 }
    //             },
    //             {
    //                 $group: {
    //                     _id: null,
    //                     schoolOrInstitue: { $addToSet: '$userInfo.education_level.assignedSchoolOrInstitutions' }
    //                 }
    //             },
    //             {
    //                 $project: {
    //                     _id: 0,
    //                     schoolOrInstitue: 1
    //                 }
    //             }
    //         ]

    //         let userObj = await aggregate({ collection: 'User', pipeline: pipeLine })
    //         res.send(success("Successfully fetched Filteroption", userObj[0]?.schoolOrInstitue || []))
    //     } catch (err: any) {
    //         logger.error("There is some issue in Filter option in activity controller", err.message);
    //         res.status(statusCode.FORBIDDEN).send(error("There is some issue in Filter option", err.mesage, statusCode.FORBIDDEN))
    //     }
    // }

    filterOption: async (req: Request, res: Response) => {
        try {
            let request = req as requestUser;

            let query: any = {
                isDel: false,
            }, groupQuery: any = { isDel: false }, list: any, groupArr: Array<any> = [];
            if (request.user.region) {
                query['_id'] = request.user.region;
                groupQuery['region'] = request.user.region
                list = await distinct({
                    collection: "Region",
                    field: 'assignedSchoolOrInstitute',
                    query: query,
                });

                groupArr = await find({ collection: 'Group', query: groupQuery, project: { 'groupName': 1 } })
            } else if (request.user.partnerAdmin) {
                query['_id'] = request.user.partnerAdmin
                groupQuery['partner'] = request.user.partnerAdmin
                list = await distinct({
                    collection: "Partner",
                    field: 'assignedSchoolOrInstitute',
                    query: query,
                });
                groupArr = await find({ collection: 'Group', query: groupQuery, project: { 'groupName': 1 } })
            }


            // (list?.value || []).sort((a: any, b: any) => { return a.localeCompare(b) });
            res.send(success(successMessage.FETCH_SUCCESS.replace(":attribute", "SchoolOrInstitute"), { list, groupArr }, statusCode.OK));
        } catch (err: any) {
            logger.error("partnerController > SchoolOrInstitute ", err);
            res
                .status(statusCode.FORBIDDEN)
                .send(error("There is some issue to Create SchoolOrInstitute list.", err.message, statusCode.FORBIDDEN));
        }
    },

    pairReportV2: async (req: Request, res: Response) => {
        try {
            let request = req as requestUser;

            let { startDate, endDate } = req.body

            let query: any = {};

            if (request.user.partnerAdmin) {
                query["partnerId"] = request.user.partnerAdmin;
            } else if (request.user.region) {
                query["regionId"] = request.user.region;
            } else {
                res.status(statusCode.UNAUTHORIZED).send(error(errorMessage.ACTION.replace(":attribute", request.user.role), {}, statusCode.UNAUTHORIZED));
                return;
            }

            let isFilter = false;
            if (startDate && endDate) {
                isFilter = true;
                query["createdAt"] = { $gte: new Date(startDate), $lt: new Date(endDate) }
            }


            let mentorIds = distinct({
                collection: "PairInfo",
                field: 'mentorId',
                query: { ...query, isConfirm: true },
            });

            let menteeIds = distinct({
                collection: "PairInfo",
                field: 'menteeId',
                query: { ...query, isConfirm: true },
            });

            let eventIds = distinct({
                collection: 'Event',
                field: '_id',
                query: { ...query, event_type: eventTypeConstant.REGULAR },
            });

            const resp: any = await Promise.allSettled([mentorIds, menteeIds, eventIds]);

            const eventResponse = eventsPairReport(resp[2].value);
            const contentResponse = contentPairReport(query);
            const contentSharedResponse = contentSharedPairReport({ mentorIds: resp[0].value, menteeIds: resp[1].value });
            const messageResponse = messagePairReport({ mentorIds: resp[0].value, menteeIds: resp[1].value }, isFilter, req.body);

            const finalResponse: any = await Promise.allSettled([eventResponse, contentResponse, contentSharedResponse, messageResponse]);

            const response: any = {
                _id: request.user.partnerAdmin ?? request.user.region,
                totalEvent: resp[2].value?.length,
                totalInvited: finalResponse[0].value.totalInvited,
                totalAttend: finalResponse[0].value.totalAttend,
                totalRVSPd: finalResponse[0].value.totalRVSPd,
                rsvpPercentage: Number(finalResponse[0].value.rsvpPercentage),
                totalContents: finalResponse[1].value.totalContents,
                availableContent: finalResponse[1].value.availableContent,
                archivedContent: finalResponse[1].value.archivedContent,
                contentSharedByMentor: finalResponse[2].value.contentSharedByMentor,
                contentSharedByMentee: finalResponse[2].value.contentSharedByMentee,
                pairMessages: finalResponse[3].value.pairMessages,
                mentorMessagesCount: finalResponse[3].value.mentorMessagesCount,
                menteeMessagesCount: finalResponse[3].value.menteeMessagesCount,
            };

            return res.send(success(successMessage.FETCH_SUCCESS.replace(":attribute", "PairReport"), response));
        } catch (err: any) {
            return res.status(statusCode.FORBIDDEN).send(error("There is some issue in Pair Reporting", err.message, statusCode.FORBIDDEN));
        }
    },
};

interface EventCounts {
    totalInvited: number;
    totalRVSPd: number;
    totalAttend: number;
    rsvpPercentage: string;
}

const eventsPairReport = async (eventIds: string[]): Promise<EventCounts> => {

    const [totalInvited, totalRVSPd, totalAttend] = await Promise.all([
        countDocuments({
            collection: 'EventGuest',
            query: { eventId: { $in: eventIds } },
        }),
        countDocuments({
            collection: 'EventGuest',
            query: { eventId: { $in: eventIds }, status: { $ne: event_status.PENDING } },
        }),
        countDocuments({
            collection: 'EventGuest',
            query: { eventId: { $in: eventIds }, status: event_status.APPROVED },
        }),
    ]);

    const rsvpPercentage =
        totalInvited === 0 ? '0.00' : ((totalRVSPd / totalInvited) * 100).toFixed(2);

    return {
        totalInvited,
        totalRVSPd,
        totalAttend,
        rsvpPercentage,
    }

};

interface ContentCounts {
    totalContents: number;
    availableContent: number;
    archivedContent: number;
}

const contentPairReport = async (query: { partnerId?: string; regionId?: string }): Promise<ContentCounts> => {

    const [totalAvailableContent, totalArchivedContent] = await Promise.all([
        countDocuments({
            collection: 'Contents',
            query: { ...query, isArchived: false },
        }),
        countDocuments({
            collection: 'Contents',
            query: { ...query, isArchived: true },
        }),
    ]);

    return {
        totalContents: totalAvailableContent + totalArchivedContent,
        availableContent: totalAvailableContent,
        archivedContent: totalArchivedContent,
    }
}

interface UserIds {
    mentorIds: string[];
    menteeIds: string[];
}
interface ContentSharedCounts {
    contentSharedByMentor: number;
    contentSharedByMentee: number;
}

const contentSharedPairReport = async (userIds: UserIds): Promise<ContentSharedCounts> => {

    const [contentSharedByMentor, contentSharedByMentee] = await Promise.all([
        countDocuments({
            collection: 'Messages',
            query: {
                senderId: { $in: userIds.mentorIds },
                receiverId: { $in: userIds.menteeIds },
                msg_type: msg_Type.CONTENT,
            },
        }),
        countDocuments({
            collection: 'Messages',
            query: {
                senderId: { $in: userIds.menteeIds },
                receiverId: { $in: userIds.mentorIds },
                msg_type: msg_Type.CONTENT,
            },
        }),
    ]);
    return {
        contentSharedByMentor,
        contentSharedByMentee,
    }
}

interface DateRange {
    startDate: string;
    endDate: string;
}

interface MessageCounts {
    pairMessages: number;
    mentorMessagesCount: number;
    menteeMessagesCount: number;
}

const messagePairReport = async (userIds: UserIds, filter: boolean, data: DateRange): Promise<MessageCounts> => {

    let mentorQuery: any = { senderId: { $in: userIds?.mentorIds }, receiverId: { $in: userIds?.menteeIds }, msg_type: { $nin: [msg_Type.ANNOUNCEMENT, msg_Type.PRE_MATCH_ANNOUNCEMENT] } };
    let menteeQuery: any = { senderId: { $in: userIds?.menteeIds }, receiverId: { $in: userIds?.mentorIds }, msg_type: { $nin: [msg_Type.ANNOUNCEMENT, msg_Type.PRE_MATCH_ANNOUNCEMENT] } };

    if (filter) {
        mentorQuery["createdAt"] = { $gte: new Date(data.startDate), $lt: new Date(data.endDate) }
        menteeQuery["createdAt"] = { $gte: new Date(data.startDate), $lt: new Date(data.endDate) }
    }

    const [mentorMessagesCount, menteeMessagesCount] = await Promise.all([
        countDocuments({ collection: 'Messages', query: mentorQuery }),
        countDocuments({ collection: 'Messages', query: menteeQuery })
    ]);

    return {
        pairMessages: mentorMessagesCount + menteeMessagesCount,
        mentorMessagesCount,
        menteeMessagesCount
    };
}