import { Request, Response } from "express";
import { requestUser } from "../Interfaces/schemaInterfaces/user";
import {
    ContentConstants,
    categoryOfQuestion,
    errorMessage,
    eventStatusConstant,
    msg_Type,
    quentionStatus,
    questionState,
    statusCode,
    statusType,
    successMessage,
    uploadConstant,
    userRoleConstant,
    userStatusConstant,
    notificationType,
    notificationMessage,
    quentionType,
    defaultProfilePicConstant,
    questionConst,
    eventAcceptenceTypeConstant,
    User_Activity
} from "../utils/const";
import {
    aggregate,
    distinct,
    find,
    findOne,
    findOneAndUpdate,
    insertOne,
    ObjectId,
    paginate,
    updateMany,
    updateOne,
    deleteOne,
    countDocuments
} from "../utils/db";
import { capitalizeFirstLetter, formatePhoneNumber } from "../utils/helpers/functions";
import { error, success } from "../utils/helpers/resSender";
import { validateFile } from "../utils/uploadFile";
import { logger } from "../utils/helpers/logger";
import _ from 'lodash'
import csvtojson from 'csvtojson'
import config from "../utils/config";
import axios from 'axios'
import { addToMatches } from "../Bull/Queues/matches.queue";
import mongoose from "mongoose";
import { matchedFound, sendMsg } from "./Web/message.controller";
import { getCounts, sendNotification, sendPushNotification } from "./Web/notification.controller";
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs'
import { sendMail } from "../utils/helpers/sendEmail";
import exportFileFunction from "../utils/exportCSV";
import { addToPairMatches } from "../Bull/Queues/pair-matches.queue";
import { authController } from "./Web/auth.controller";

export let matcheController = {
    addQuestion: async function (req: any, res: any) {
        try {
            let request = req as requestUser

            if (request.user.role == userRoleConstant.I_SUPER_ADMIN) {
                res.status(statusCode.UNAUTHORIZED).send(error(errorMessage.ACTION.replace(":attribute", request.user.role), {}, statusCode.UNAUTHORIZED));
                return
            }

            let {
                category,
                question,
                option,
                queType,
                required,
                status,
                weight,
                isDraft,
                longAnswer,
                alternateQuestion,
                isAlternateQuestion
            } = req.body;
            let findData = await findOne({
                collection: "Matches",
                query: { category, question, option, queType, required, status, weight, isDraft, isDel: false },
            });

            if (findData) {
                return res
                    .status(statusCode.BAD_REQUEST)
                    .send(error(errorMessage.ALREADY_EXISTS.replace(":attribute", "Question"), {}, statusCode.BAD_REQUEST));
            }


            let query: any = {
                category,
                question,
                isAlternateQuestion,
                alternateQuestion,
                option,
                queType,
                required,
                status,
                weight,
                isDraft,

                createdBy: request.user._id,
            }

            let orderQuery: any = {};
            if (request.user.role == userRoleConstant.P_SUPER_ADMIN || request.user.role == userRoleConstant.P_LOCAL_ADMIN) {
                query['partnerId'] = request.user.partnerAdmin
                orderQuery['partnerId'] = request.user.partnerAdmin
            } else if (request.user.role == userRoleConstant.I_LOCAL_ADMIN) {
                query['regionId'] = request.user.region
                orderQuery['regionId'] = request.user.region
            }
            orderQuery['isDel'] = false


            let orderNum = await findOne({
                collection: "Matches",
                query: orderQuery,
                sort: { orderNum: -1 },
                limit: 1,
            });

            query["orderNum"] = (orderNum && orderNum.orderNum) ? orderNum.orderNum + 1 : 1;

            const addQuestion = await insertOne({
                collection: "Matches",
                document: query,
            });
            res.send(success("A new question has been successfully added!", addQuestion, statusCode.OK));
        } catch (err: any) {
            console.log(err)
            res.status(statusCode.FORBIDDEN).send(error("There is some issue to get addQuestion.", err.message, statusCode.FORBIDDEN));
        }
    },

    questionList: async function (req: any, res: any) {
        try {
            let { sort, weight, archive, limit, page, category } = req.body;
            let request = req as requestUser
            let sortQuery: any = {};
            sortQuery[String(Object.keys(sort)) || "orderNum"] = String(Object.values(sort)) == "desc" ? -1 : 1;
            // let { partnerAdmin, region } = await findOne({
            //   collection: "User",
            //   query: { _id: req.user._id },
            // });
            let status: Array<any> = []
            status = req.body.status
            let query: any = { $and: [{ isDel: false }] };
            // let query: any = { $and: [{ isDel: false, createdBy: new Object(partnerAdmin) ?? new Object(region) }] };
            if (status.length > 0) {
                query = { ...query, status: { $in: status } }
            }
            if (archive) {
                query.$and.push({ status: questionState.ARCHIVE })
            } else {
                query.$and.push({ status: { $in: [questionState.ACTIVE, questionState.DRAFT] } })
            }

            if (category) {
                query.$and.push({ category: category })
            }

            if (weight) query.$and.push({ weight: parseFloat(weight) });

            if (request.user.role == userRoleConstant.P_SUPER_ADMIN || request.user.role == userRoleConstant.P_LOCAL_ADMIN) {
                query.$and.push({ partnerId: request.user.partnerAdmin })
            } else if (request.user.role == userRoleConstant.I_LOCAL_ADMIN) {
                query.$and.push({ regionId: request.user.region });
            } else {
                res.status(statusCode.UNAUTHORIZED).send(error(errorMessage.ACTION.replace(":attribute", request.user.role), {}, statusCode.UNAUTHORIZED));
                return
            }


            if (req.body.addedBy) {
                query.$and.push({ createdBy: new mongoose.Types.ObjectId(req.body.addedBy) })
            }
            // let data = await paginate({
            //   collection: "Matches",
            //   query: query,
            //   populate: { path: 'createdBy' },
            //   options: {
            //     collation: {
            //       locale: "en",
            //       strength: 2,
            //     },
            //     sort: sortQuery,
            //     limit: limit,
            //     page: page,
            //   },
            // });

            let pipeLine = [
                {
                    $match: query
                },
                {
                    $lookup: {
                        from: 'answerbymentors',
                        localField: '_id',
                        foreignField: 'queAns.question',
                        as: 'mentorAnswer'
                    }
                },
                {
                    $lookup: {
                        from: 'answerbymentees',
                        localField: '_id',
                        foreignField: 'queAns.question',
                        as: 'menteeAnswer'
                    }
                },
                {
                    $lookup: {
                        from: 'users',
                        localField: 'createdBy',
                        foreignField: '_id',
                        as: 'createdBy'
                    }
                },
                {
                    $unwind: {
                        path: '$createdBy',
                        preserveNullAndEmptyArrays: true
                    }
                },
                {
                    $project: {
                        question: 1,
                        category: 1,
                        queType: 1,
                        status: 1,
                        weight: { $toDouble: '$weight' },
                        orderNum: 1,
                        option: 1,
                        isDel: 1,
                        isDefaultQuestion: 1,
                        createdBy: {
                            legalFname: '$createdBy.legalFname',
                            legalLname: '$createdBy.legalLname',
                            _id: '$createdBy._id',
                            role: '$createdBy.role',
                            profilePic: '$createdBy.profilePic'
                        },
                        totalAnswer: { $sum: [{ $size: '$mentorAnswer' }, { $size: '$menteeAnswer' }] },
                        lastUpdatedDate: '$updatedAt'
                    }
                },
                {
                    $sort: sortQuery
                }
            ]

            //query: query, populate: { path: 'createdBy' }, sort: sortQuery
            let data = await aggregate({ collection: 'Matches', pipeline: pipeLine })

            const categorySequence = await findOne({ collection: 'categorySeq', project: { category: 1 } })

            res.send(success(successMessage.FETCH_SUCCESS.replace(":attribute", "QuestionList"), {
                data: data,
                categorySequence: categorySequence.category
            }, statusCode.OK));
        } catch (err: any) {
            res.status(statusCode.FORBIDDEN).send(error("There is some issue to get questionList.", err.message, statusCode.FORBIDDEN));
        }
    },

    getQuestion: async function (req: any, res: any) {
        try {
            let { id } = req.body;
            let question = await findOne({
                collection: "Matches",
                query: { _id: id, isDel: false },
            });
            if (!question) {
                return res
                    .status(statusCode.BAD_REQUEST)
                    .send(error(errorMessage.NOT_EXISTS.replace(":attribute", "question"), {}, statusCode.BAD_REQUEST));
            }
            let data = await findOne({
                collection: "Matches",
                query: { _id: id },
            });

            let menteeQuestion: Array<any> = await find({ collection: 'AnswerByMentee', query: { 'queAns.question': id } });

            let mentorQustion: Array<any> = await find({ collection: 'AnswerByMentors', query: { 'queAns.question': id } }) //AnswerByMentors
            let membersCount = (menteeQuestion?.length || 0) + (mentorQustion?.length || 0)

            res.send(success(successMessage.FETCH_SUCCESS.replace(":attribute", "Question"), {
                data,
                membersCount
            }, statusCode.OK));
        } catch (err: any) {
            res.status(statusCode.FORBIDDEN).send(error("There is some issue to get question.", err.message, statusCode.FORBIDDEN));
        }
    },

    updateQuestion: async function (req: any, res: any) {
        try {

            let request = req as requestUser
            let { id } = req.body;

            let query: any = {}
            let userquery: any = { status: { $in: [userStatusConstant.Matched, userStatusConstant.Matching] } }

            if (request.user.partnerAdmin) {
                query["partnerId"] = request.user.partnerAdmin
                userquery["partnerAdmin"] = request.user.partnerAdmin
            } else if (request.user.region) {
                query["regionId"] = request.user.region
                userquery["region"] = request.user.region
            }

            let findData = await findOne({ collection: "Matches", query: { _id: id, isDel: false, ...query } });
            if (!findData) {
                return res
                    .status(statusCode.BAD_REQUEST)
                    .send(error(errorMessage.ALREADY_EXISTS.replace(":attribute", "Question "), {}, statusCode.BAD_REQUEST));
            }
            if (request.user.role === userRoleConstant.I_SUPER_ADMIN) {
                return res
                    .status(statusCode.BAD_REQUEST)
                    .send(error(errorMessage.REJECT.replace(":attribute", "Access Role"), {}, statusCode.BAD_REQUEST));
            }

            delete req.body._id;
            let data = await updateOne({ collection: "Matches", query: { _id: findData._id }, update: req.body });

            let allMentees = await find({ collection: "User", query: { role: userRoleConstant.MENTEE, ...userquery, } })

            if (allMentees.length) {
                for (let index = 0; index < allMentees.length; index++) {
                    await addToMatches({ menteeId: allMentees[index]._id, jobId: uuidv4() })
                }
            }

            res.send(success(successMessage.SAVE_SUCCESS.replace(":attribute", "Changes"), { data }, statusCode.OK));
        } catch (err: any) {
            res
                .status(statusCode.FORBIDDEN)
                .send(error("There is some issue to get updateQuestion.", err.message, statusCode.FORBIDDEN));
        }
    },

    changeOrder: async function (req: any, res: any) {
        try {
            let { id } = req.body;
            let findData = await findOne({
                collection: "Matches",
                query: {
                    _id: id,
                },
            });

            let data = await updateOne({
                collection: "Matches",
                query: { _id: id },
                update: req.body,
            });

            res.send(success(successMessage.UPDATE_SUCCESS.replace(":attribute", "Question"), data, statusCode.OK));
        } catch (err: any) {
            res
                .status(statusCode.FORBIDDEN)
                .send(error("There is some issue to get updateQuestion.", err.message, statusCode.FORBIDDEN));
        }
    },

    archiveQuestion: async function (req: any, res: any) {
        try {


            let request = req as requestUser
            let { id, status } = req.body;

            let query: any = { _id: id }
            let userquery: any = { status: { $in: [userStatusConstant.Matched, userStatusConstant.Matching] } }

            if (request.user.partnerAdmin) {
                query["partnerId"] = request.user.partnerAdmin
                userquery["partnerAdmin"] = request.user.partnerAdmin
            } else if (request.user.region) {
                query["regionId"] = request.user.region
                userquery["region"] = request.user.region
            }

            let findData = await findOne({ collection: "Matches", query: { _id: id, ...query } });
            if (!findData) {
                return res
                    .status(statusCode.BAD_REQUEST)
                    .send(error(errorMessage.ALREADY_EXISTS.replace(":attribute", "Question "), {}, statusCode.BAD_REQUEST));
            }
            let data = await updateOne({ collection: "Matches", query, update: { status: status } });

            let allMentees = await find({ collection: "User", query: { role: userRoleConstant.MENTEE, ...userquery, } })

            let message = ''

            if (status == 'Archive') {
                message = "Question has been archived!."
            }

            if (status == 'Active') {
                message = "Question has been activated!."
            }

            if (allMentees.length) {
                for (let index = 0; index < allMentees.length; index++) {
                    await addToMatches({ menteeId: allMentees[index]._id, jobId: uuidv4() })
                }
            }

            res.send(success(message, data, statusCode.OK));
        } catch (err: any) {
            res
                .status(statusCode.FORBIDDEN)
                .send(error("There is some issue to get archiveQuestion.", err.message, statusCode.FORBIDDEN));
        }
    },

    deleteQuestion: async function (req: any, res: any) {
        try {

            let request = req as requestUser
            let { id } = req.body;
            let query: any = {}
            let userquery: any = { status: { $in: [userStatusConstant.Matched, userStatusConstant.Matching] } }

            if (request.user.partnerAdmin) {
                query["partnerId"] = request.user.partnerAdmin
                userquery["partnerAdmin"] = request.user.partnerAdmin
            } else if (request.user.region) {
                query["regionId"] = request.user.region
                userquery["region"] = request.user.region
            }

            let findData = await findOne({ collection: "Matches", query: { _id: id, ...query } });
            if (!findData) {
                return res.status(statusCode.BAD_REQUEST).send(error(errorMessage.ALREADY_EXISTS.replace(":attribute", "Question "), {}, statusCode.BAD_REQUEST));
            }
            let data = await deleteOne({ collection: "Matches", query: { _id: findData._id } });

            let allMentees = await find({ collection: "User", query: { role: userRoleConstant.MENTEE, ...userquery, } })

            if (allMentees.length) {
                for (let index = 0; index < allMentees.length; index++) {
                    await addToMatches({ menteeId: allMentees[index]._id, jobId: uuidv4() })
                }
            }

            await updateMany({
                collection: "Matches",
                query: { orderNum: { $gt: findData.orderNum } },
                update: { $inc: { orderNum: -1 } }
            })

            res.send(success(successMessage.REMOVE.replace(":attribute", "Question"), data, statusCode.OK));
        } catch (err: any) {
            res.status(statusCode.FORBIDDEN).send(error("There is some issue to get deleteQuestion.", err.message, statusCode.FORBIDDEN));
        }
    },

    filterOption: async function (req: any, res: any) {
        try {
            const request = req as requestUser;

            let { type, arhive } = req.query;
            let confirm = type == "Potential Matches" ? false : true;

            let query: any = {};

            query = { isDel: false, isConfirm: confirm, isArchive: arhive || false };

            if (request.user.region) {
                query['regionId'] = request.user.region
                query['partnerIdOrRegionId'] = request.user.region
            } else if (request.user.partnerAdmin) {
                query['partnerId'] = request.user.partnerAdmin;
                query['partnerIdOrRegionId'] = request.user.partnerAdmin
            } else {
                // query['regionId'] = request.user.region
                // query['partnerId'] = request.user.partnerAdmin;
                // query['partnerIdOrRegionId'] = request.user.region ? request.user.region : request.user.partnerAdmin
            }

            let pairData = await find({
                collection: "PairInfo",
                query,
                populate: [
                    { path: "menteeId", select: "mentorId legalFname legalLname preferredFname preferredLname" },
                    { path: "mentorId", select: "mentorId legalFname legalLname preferredFname preferredLname" },
                    { path: "partner", select: "partnerName region" },
                ],
            });

            let filterObj: any = {
                SOM: [
                    {
                        label: "0 - 25%",
                        min: 0,
                        max: 25,
                    },
                    {
                        label: "26 - 50%",
                        min: 26,
                        max: 50,
                    },
                    { label: "51 - 75%", min: 51, max: 75 },
                    { label: "76 - 100%", min: 76, max: 100 },
                ],
                location: [],
                mentor: [],
                school: [],
                partner: [],
            };

            for (let ele of pairData) {
                if (ele.location && !filterObj?.location.includes(ele.location)) filterObj.location.push(ele.location);
                if (ele.school && !filterObj?.school.includes(ele.school)) filterObj.school.push(...ele.school);
                if (ele.mentorId && !filterObj?.mentor.includes(ele.mentorId?.preferredFname + " " + ele.mentorId?.preferredLname))
                    filterObj.mentor.push(ele.mentorId?.preferredFname + " " + ele.mentorId?.preferredLname);
                if (
                    (ele.partner || ele.regionId) &&
                    !filterObj.partner.includes(ele?.partner ?? ele?.region)
                )
                    filterObj.partner.push(ele?.partner ?? ele?.region);
            }

            const uniqueSchool = _.uniq(filterObj.school)
            filterObj.school = uniqueSchool;

            (filterObj?.location || []).sort((a: any, b: any) => {
                return a.localeCompare(b)
            });
            (filterObj?.mentor || []).sort((a: any, b: any) => {
                return a.localeCompare(b)
            });
            (filterObj?.partner || []).sort((a: any, b: any) => {
                return a.localeCompare(b)
            });
            (filterObj?.school || []).sort((a: any, b: any) => {
                return a.localeCompare(b)
            });

            res.send(success(successMessage.UPDATE_SUCCESS.replace(":attribute", "Question"), filterObj, statusCode.OK));
        } catch (err: any) {
            res
                .status(statusCode.FORBIDDEN)
                .send(error("There is some issue to get deleteQuestion.", err.message, statusCode.FORBIDDEN));
        }
    },

    doMatching: async function (req: any, res: any) {
        try {
            let { } = req.body;

            res.send(success(successMessage.UPDATE_SUCCESS.replace(":attribute", "Question"), {}, statusCode.OK));
        } catch (err: any) {
            res
                .status(statusCode.FORBIDDEN)
                .send(error("There is some issue to get deleteQuestion.", err.message, statusCode.FORBIDDEN));
        }
    },

    pairListig: async function (req: any, res: any) {
        try {
            let request = req as requestUser;

            let {
                search,
                location,
                school,
                mentor,
                mentee,
                sort,
                SOM,
                page,
                limit,
                dayLeft,
                partner,
                type,
                archive
            } = req.body;
            const payload = req.body;

            const sixtyDaysAgo = new Date();
            sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);

            if (type == "Potential Matches") {
                await updateMany({
                    collection: "PairInfo",
                    query: { isArchive: false, isConfirm: false, createdAt: { $lte: sixtyDaysAgo } },
                    update: { $set: { isArchive: true } },
                });
            }

            let mQuery: any = {};
            if (payload.archive) {
                mQuery = { isConfirm: true, partnerIdOrRegionId: request.user.partnerAdmin ?? request.user.region ?? null }
            } else {
                mQuery = { $or: [{ isConfirm: true }, { isConfirm: false, isArchive: true }], partnerIdOrRegionId: request.user.partnerAdmin ?? request.user.region ?? null }
            }

            // let mQuery: any = {};
            // if (payload.archive) {
            //     mQuery = { isConfirm: true, partnerIdOrRegionId: request.user.partnerAdmin ?? request.user.region ?? null }
            // } else {
            //     mQuery = { $or: [{ isConfirm: true }, { isConfirm: false, isArchive: true }], partnerIdOrRegionId: request.user.partnerAdmin ?? request.user.region ?? null }
            // }

            let menteeList = await distinct({
                collection: 'PairInfo',
                field: 'menteeId',
                // query: { isConfirm: true, partnerIdOrRegionId: request.user.partnerAdmin ?? request.user.region ?? null }
                query: mQuery
            });

            page = page || 0;
            limit = limit || 10;

            let confirm = type == "Potential Matches" ? false : true;
            if (payload.archive == true) {
                confirm = false
            }

            let query: any = [];

            if (!confirm && menteeList.length > 0) {
                query.push({ $match: { menteeId: { $nin: menteeList } } })
            }

            if (request.user.partnerAdmin || request.user.region) {
                query.push({
                    $match: {
                        partnerIdOrRegionId: request.user.partnerAdmin ? request.user.partnerAdmin : request.user.region
                    }
                })
            }

            query.push(
                {
                    $match: {
                        $and: [{ isDel: false }, { isConfirm: confirm }, { isArchive: archive || false }]
                    }
                }
            )

            if (!confirm) {
                query.push(
                    {
                        $project: {
                            _id: "$_id",
                            menteeId: "$menteeId",
                            mentorId: "$mentorId",
                            SOM: "$SOM",
                            addOnDate: "$createdAt",
                            isArchive: "$isArchive",
                            isConfirm: "$isConfirm",
                            isDel: "$isDel",
                            isUpdated: "$isUpdated",
                            location: "$location",
                            partner: "$partner",
                            partnerId: "$partnerId",
                            partnerIdOrRegionId: "$partnerIdOrRegionId",
                            regionId: "$regionId",
                            school: "$school",
                            createdBy: "$createdBy",
                            createdAt: "$createdAt",
                            updatedAt: "$updatedAt"
                        }
                    },
                    // {
                    //     $lookup: {
                    //         from: "messages",
                    //         let: {
                    //             mentorId: "$mentorId",
                    //             menteeId: "$menteeId",
                    //         },
                    //         pipeline: [
                    //             {
                    //                 $match: {
                    //                     $expr: {
                    //                         $and: [
                    //                             {
                    //                                 $eq: ["$senderId", "$$mentorId"],
                    //                             },
                    //                             {
                    //                                 $eq: ["$receiverId", "$$menteeId"],
                    //                             },
                    //                         ],
                    //                     },
                    //                 },
                    //             },
                    //             { $sort: { 'createdAt': -1 } },
                    //             {
                    //                 $project: { _id: 1, senderId: 1, receiverId: 1, contentId: 1, message: 1, msg_type: 1 }
                    //             },
                    //         ],
                    //         as: "mentorMessages",
                    //     },
                    // },
                    // {
                    //     $lookup: {
                    //         from: "messages",
                    //         let: {
                    //             menteeId: "$menteeId",
                    //             mentorId: "$mentorId",
                    //         },
                    //         pipeline: [
                    //             {
                    //                 $match: {
                    //                     $expr: {
                    //                         $and: [
                    //                             {
                    //                                 $eq: ["$senderId", "$$menteeId"],
                    //                             },
                    //                             {
                    //                                 $eq: ["$receiverId", "$$mentorId"],
                    //                             },
                    //                         ],
                    //                     },
                    //                 },
                    //             },
                    //             { $sort: { 'createdAt': -1 } },
                    //             {
                    //                 $project: { _id: 1, senderId: 1, receiverId: 1, contentId: 1, message: 1, msg_type: 1 }
                    //             },
                    //         ],
                    //         as: "menteeMessages",
                    //     },
                    // },
                )
            } else {
                query.push(
                    {
                        $project: { menteeAns: 0, mentorAns: 0 }
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
                                { $sort: { 'createdAt': -1 } },
                                {
                                    $project: { _id: 1, senderId: 1, receiverId: 1, contentId: 1, message: 1, msg_type: 1, createdAt: 1 }
                                },
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
                                { $sort: { 'createdAt': -1 } },
                                {
                                    $project: { _id: 1, senderId: 1, receiverId: 1, contentId: 1, message: 1, msg_type: 1, createdAt: 1 }
                                },
                            ],
                            as: "menteeMessages",
                        },
                    },
                    {
                        $addFields: {
                            menteeMessagesCount: { $size: '$menteeMessages' },
                            mentorMessagesCount: { $size: '$mentorMessages' },
                            mentorMessages: { $arrayElemAt: ['$mentorMessages', 0] },
                            menteeMessages: { $arrayElemAt: ['$menteeMessages', 0] }
                        }
                    },
                    {
                        $lookup: {
                            from: 'eventguests',
                            let: { mentorId: '$mentorId' },
                            pipeline: [{ $match: { $expr: { $and: [{ $eq: ['$userId', '$$mentorId'] }, { $eq: ['$attendance', eventAcceptenceTypeConstant.ATTENDED] }] } } }, { $project: { 'eventId': 1, _id: 0 } }],
                            as: 'mentorEvent'
                        }
                    },
                    {
                        $addFields: {
                            mentorEvent: {
                                $map: {
                                    input: "$mentorEvent",
                                    as: 'mentorEvent',
                                    in: '$$mentorEvent.eventId'
                                }
                            }
                        }
                    },
                    {
                        $lookup: {
                            from: 'eventguests',
                            let: { menteeId: '$menteeId', mentorEvent: '$mentorEvent' },
                            pipeline: [{ $match: { $expr: { $and: [{ $eq: ['$userId', '$$menteeId'] }, { $in: ['$eventId', '$$mentorEvent'] }, { $eq: ['$attendance', eventAcceptenceTypeConstant.ATTENDED] }] } } }, { $sort: { updatedAt: -1 } }],
                            as: 'menteeEvent'
                        }
                    },
                    {
                        $addFields: {
                            attendendEventCount: { $size: '$menteeEvent' },
                            lastEventAttended: { $arrayElemAt: ['$menteeEvent', 0] }
                        }
                    },
                    {
                        $addFields: {
                            menteeEvent: {
                                $map: {
                                    input: "$menteeEvent",
                                    as: 'menteeEvent',
                                    in: '$$menteeEvent.eventId'
                                }
                            }
                        }
                    },
                    {
                        $lookup: {
                            from: 'events',
                            let: { 'eventId': '$lastEventAttended.eventId' },
                            pipeline: [{ $match: { $expr: { $eq: ['$_id', "$$eventId"] } } }, { $sort: { createdAt: -1 } }],
                            as: 'lastAttendedEvent'
                        }
                    },
                    {
                        $project: {
                            'menteeEvent': 0,
                            'mentorEvent': 0,
                            'lastEventAttended': 0
                        }
                    }
                )
            }

            if (payload?.mentee || payload?.loginWeek || sort?.menteeId || sort?.login) {
                query.push(
                    {
                        $lookup: {
                            from: 'users',
                            let: { mId: "$menteeId" },
                            pipeline: [
                                {
                                    $match: {
                                        $expr: {
                                            $and: [
                                                { $eq: ["$$mId", "$_id"] }
                                            ]
                                        }
                                    }
                                },
                                {
                                    $project: {
                                        _id: 1,
                                        preferredFname: 1,
                                        preferredLname: 1,
                                        legalFname: 1,
                                        legalLname: 1,
                                        profilePic: 1,
                                        totalLogin: 1
                                    }
                                }
                            ],
                            as: "menteeId"
                        }
                    },
                    {
                        $unwind: {
                            path: "$menteeId",
                            preserveNullAndEmptyArrays: true
                        }
                    }
                )
            }
            if (payload?.mentee || payload?.loginWeek || payload?.mentor?.length || sort?.mentorId || sort?.login) {
                query.push(
                    {
                        $lookup: {
                            from: 'users',
                            let: { mId: "$mentorId" },
                            pipeline: [
                                {
                                    $match: {
                                        $expr: {
                                            $and: [
                                                { $eq: ["$$mId", "$_id"] }
                                            ]
                                        }
                                    }
                                },
                                {
                                    $project: {
                                        _id: 1,
                                        preferredFname: 1,
                                        preferredLname: 1,
                                        legalFname: 1,
                                        legalLname: 1,
                                        profilePic: 1,
                                        totalLogin: 1
                                    }
                                }
                            ],
                            as: "mentorId"
                        }
                    },
                    {
                        $unwind: {
                            path: "$mentorId",
                            preserveNullAndEmptyArrays: true
                        }
                    }
                )
            }
            if (payload?.partner?.length || sort?.partner) {
                query.push(
                    {
                        $lookup: {
                            from: 'users',
                            let: { aId: "$createdBy" },
                            pipeline: [
                                {
                                    $match: {
                                        $expr: {
                                            $and: [
                                                { $eq: ["$$aId", "$_id"] }
                                            ]
                                        }
                                    }
                                },
                                {
                                    $project: {
                                        _id: 1, legalFname: 1, legalLname: 1, profilePic: 1, totalLogin: 1
                                    }
                                }
                            ],
                            as: "createdBy"
                        }
                    },
                    {
                        $unwind: {
                            path: "$createdBy",
                            preserveNullAndEmptyArrays: true
                        }
                    }
                )
            }
            if (sort?.dayLeft) {
                query.push(
                    {
                        $addFields: {
                            createdAt: "$createdAt",
                            currentDate: { $toDate: new Date() }
                        }
                    },
                    {
                        $addFields: {
                            timeDiff: {
                                $divide: [
                                    {
                                        $subtract: ["$currentDate", "$createdAt"]
                                    },
                                    1000 * 60 * 60 * 24
                                ]
                            }
                        }
                    },
                    {
                        $addFields: {
                            daysDifference: {
                                $trunc: "$timeDiff"
                            }
                        }
                    },
                    {
                        $addFields: {
                            dayLeft: {
                                $subtract: [60, "$daysDifference"]
                            }
                        }
                    }
                )
            }

            // Search
            if (payload?.mentee) {
                query.push(
                    {
                        $addFields: {
                            //Mentee Filter
                            mentee_user_name: {
                                '$concat': ['$menteeId.preferredFname', ' ', '$menteeId.preferredLname']
                            },
                            mentee_reverseUsername: {
                                '$concat': ['$menteeId.preferredLname', ' ', '$menteeId.preferredFname']
                            },
                            mentee_withoutBlankName: {
                                '$concat': ['$menteeId.preferredFname', '$menteeId.preferredLname']
                            },
                            mentee_reverseWithoutBlankName: {
                                '$concat': ['$menteeId.preferredLname', '$menteeId.preferredFname']
                            },
                            mentee_preferredFname: "$menteeId.preferredFname",
                            mentee_preferredLname: "$menteeId.preferredLname",

                            //Mentor Filter
                            mentor_user_name: {
                                '$concat': ['$mentorId.preferredFname', ' ', '$mentorId.preferredLname']
                            },
                            mentor_reverseUsername: {
                                '$concat': ['$mentorId.preferredLname', ' ', '$mentorId.preferredFname']
                            },
                            mentor_withoutBlankName: {
                                '$concat': ['$mentorId.preferredFname', '$mentorId.preferredLname']
                            },
                            mentor_reverseWithoutBlankName: {
                                '$concat': ['$mentorId.preferredLname', '$mentorId.preferredFname']
                            },
                            mentor_preferredFname: "$mentorId.preferredFname",
                            mentor_preferredLname: "$mentorId.preferredLname",
                        }
                    },
                    {
                        $match: {
                            $or: [
                                { mentee_user_name: { $regex: '.*' + payload.mentee + '.*', $options: 'i' } },
                                { mentee_reverseUsername: { $regex: '.*' + payload.mentee + '.*', $options: 'i' } },
                                { mentee_withoutBlankName: { $regex: '.*' + payload.mentee + '.*', $options: 'i' } },
                                { mentee_reverseWithoutBlankName: { $regex: '.*' + payload.mentee + '.*', $options: 'i' } },
                                { mentee_preferredFname: { $regex: '.*' + payload.mentee + '.*', $options: 'i' } },
                                { mentee_preferredLname: { $regex: '.*' + payload.mentee + '.*', $options: 'i' } },

                                { mentor_user_name: { $regex: '.*' + payload.mentee + '.*', $options: 'i' } },
                                { mentor_reverseUsername: { $regex: '.*' + payload.mentee + '.*', $options: 'i' } },
                                { mentor_withoutBlankName: { $regex: '.*' + payload.mentee + '.*', $options: 'i' } },
                                { mentor_reverseWithoutBlankName: { $regex: '.*' + payload.mentee + '.*', $options: 'i' } },
                                { mentor_preferredFname: { $regex: '.*' + payload.mentee + '.*', $options: 'i' } },
                                { mentor_preferredLname: { $regex: '.*' + payload.mentee + '.*', $options: 'i' } }
                            ]
                        }
                    }
                )
            }

            if (payload.mentee) {
                query.push({
                    $project: {
                        mentee_user_name: 0,
                        mentee_reverseUsername: 0,
                        mentee_withoutBlankName: 0,
                        mentee_reverseWithoutBlankName: 0,
                        mentee_preferredFname: 0,
                        mentee_preferredLname: 0,
                        mentor_user_name: 0,
                        mentor_reverseUsername: 0,
                        mentor_withoutBlankName: 0,
                        mentor_reverseWithoutBlankName: 0,
                        mentor_preferredFname: 0,
                        mentor_preferredLname: 0
                    }
                })
            }
            // Filters
            if (payload?.partner && payload?.partner?.length) {
                query.push(
                    {
                        $addFields: {
                            partnerOrRegion: { $concat: ['$createdBy.legalFname', ' ', '$createdBy.legalLname'] }
                        }
                    },
                    {
                        $match: {
                            $or: [
                                { partner: { $in: payload.partner } },
                                { partnerOrRegion: { $in: payload.partner } }
                            ]
                        }
                    }
                )
            }
            if (payload?.loginWeek) {
                console.log("==========> Filter Login Week <===========");
                query.push(
                    {
                        $addFields: {
                            totalLogins: { $add: ["$menteeId.totalLogin", "$mentorId.totalLogin"] }
                        }
                    },
                    {
                        $match: {
                            $and: [
                                { totalLogins: { $gte: payload?.loginWeek?.min } },
                                { totalLogins: { $lte: payload?.loginWeek?.max } }
                            ]
                        }
                    }
                )
            }
            if (payload?.location && payload?.location?.length) {
                console.log("==========> Filter Location <===========");
                query.push(
                    {
                        $match: {
                            location: { $in: payload.location }
                        }
                    }
                )
            }
            if (payload?.school && payload?.school?.length) {
                console.log("==========> Filter School <===========");
                query.push(
                    {
                        $match: {
                            school: { $in: payload.school }
                        }
                    }
                )
            }
            if (payload?.mentor && payload?.mentor?.length) {
                console.log("==========> Filter Mentor <===========");
                query.push(
                    {
                        $addFields: {
                            mentor: { $concat: ['$mentorId.preferredFname', ' ', '$mentorId.preferredLname'] }
                        }
                    },
                    {
                        $match: {
                            mentor: { $in: payload.mentor }
                        }
                    }
                )
            }
            if (payload?.SOM && Object.entries(payload?.SOM).length) {
                console.log("==========> Filter SOM <===========");
                query.push(
                    {
                        $match: {
                            $and: [
                                { SOM: { $gte: payload?.SOM?.min } },
                                { SOM: { $lte: payload?.SOM?.max } }
                            ]
                        }
                    }
                )
            }

            let countQuery: any = [...query];

            // Sorting
            if (sort?.menteeId) {
                console.log("==========> Sort MenteeId <===========");
                query.push(
                    {
                        $addFields: {
                            preferredFnameLower: { $toLower: "$menteeId.preferredFname" },
                        }
                    },
                    {
                        $sort: {
                            preferredFnameLower: sort?.menteeId === "asc" ? 1 : -1
                        }
                    }
                )
            } else if (sort?.mentorId) {
                console.log("==========> Sort MentorId <===========");
                query.push(
                    {
                        $addFields: {
                            preferredFnameLower: { $toLower: "$mentorId.preferredFname" },
                        }
                    },
                    {
                        $sort: {
                            preferredFnameLower: sort?.mentorId === "asc" ? 1 : -1
                        }
                    }
                )
            } else if (sort?.partner) {
                console.log("==========> Sort Partner <===========");
                query.push(
                    {
                        $addFields: {
                            legalFnameLower: { $toLower: "$createdBy.legalFname" },
                        }
                    },
                    {
                        $sort: {
                            legalFnameLower: sort?.partner === "asc" ? 1 : -1
                        }
                    }
                )
            } else if (sort?.login) {
                console.log("==========> Sort Login <===========");
                query.push(
                    {
                        $addFields: {
                            totalLogins: { $add: ["$menteeId.totalLogin", "$mentorId.totalLogin"] }
                        }
                    },
                    {
                        $sort: {
                            totalLogins: sort?.login === "asc" ? 1 : -1
                        }
                    }
                )
            } else if (sort?.addOnDate) {
                console.log("==========> Sort CreatedAt <===========");
                query.push(
                    {
                        $sort: {
                            addOnDate: sort?.addOnDate === "asc" ? 1 : -1
                        }
                    }
                )
            } else if (sort?.location) {
                query.push(
                    {
                        $sort: {
                            location: sort?.location === "asc" ? 1 : -1
                        }
                    }
                )
            } else if (sort?.school) {
                query.push(
                    {
                        $addFields: {
                            schoolName: {
                                $cond: {
                                    if: { $eq: [{ $size: "$school" }, 0] },
                                    then: "",
                                    else: { $arrayElemAt: ["$school", 0] },
                                },
                            },
                        },
                    },
                    {
                        $sort: {
                            schoolName: sort?.school === 'asc' ? 1 : -1,
                        }
                    }
                )
            } else if (sort?.SOM) {
                query.push(
                    {
                        $sort: {
                            SOM: sort?.SOM === "asc" ? 1 : -1
                        }
                    }
                )
            } else if (sort?.dayLeft && type == "Potential Matches") {
                query.push(
                    {
                        $sort: {
                            dayLeft: sort?.dayLeft === "asc" ? 1 : -1
                        }
                    }
                )
            }
            else if (sort?.menteeMessagesCount) {
                query.push({
                    $sort: {
                        menteeMessagesCount: sort?.menteeMessagesCount === "asc" ? 1 : -1
                    }
                })
            }
            else if (sort?.mentorMessagesCount) {
                query.push({
                    $sort: {
                        mentorMessagesCount: sort?.mentorMessagesCount === "asc" ? 1 : -1
                    }
                })
            } else if (sort?.attendendEventCount) {
                query.push({
                    $sort: {
                        attendendEventCount: sort?.attendendEventCount === "asc" ? 1 : -1
                    }
                })
            }
            else {
                if (confirm == true) {
                    query.push(
                        {
                            $sort: {
                                addOnDate: -1
                            }
                        }
                    )
                } else
                    query.push(
                        {
                            $sort: {
                                updatedAt: -1
                            }
                        }
                    )
            }

            query.push(
                { $skip: (page - 1) * limit },
                { $limit: limit }
            )

            if (sort?.dayLeft || type == "Potential Matches") {
                query.push(
                    {
                        $addFields: {
                            createdAt: "$createdAt",
                            currentDate: { $toDate: new Date() }
                        }
                    },
                    {
                        $addFields: {
                            timeDiff: {
                                $divide: [
                                    {
                                        $subtract: ["$currentDate", "$createdAt"]
                                    },
                                    1000 * 60 * 60 * 24
                                ]
                            }
                        }
                    },
                    {
                        $addFields: {
                            daysDifference: {
                                $trunc: "$timeDiff"
                            }
                        }
                    },
                    {
                        $addFields: {
                            dayLeft: {
                                $subtract: [60, "$daysDifference"]
                            }
                        }
                    }
                )
            }

            if (!sort?.menteeId && !sort?.login && !payload?.loginWeek && !payload?.mentee) {
                query.push(
                    {
                        $lookup: {
                            from: 'users',
                            let: { mId: "$menteeId" },
                            pipeline: [
                                {
                                    $match: {
                                        $expr: {
                                            $and: [
                                                { $eq: ["$$mId", "$_id"] }
                                            ]
                                        }
                                    }
                                },
                                {
                                    $project: {
                                        _id: 1,
                                        preferredFname: 1,
                                        preferredLname: 1,
                                        legalFname: 1,
                                        legalLname: 1,
                                        profilePic: 1,
                                        totalLogin: 1
                                    }
                                }
                            ],
                            as: "menteeId"
                        }
                    },
                    {
                        $unwind: {
                            path: "$menteeId",
                            preserveNullAndEmptyArrays: true
                        }
                    }
                )
            }

            if (!sort?.mentorId && !sort?.login && !payload?.loginWeek && !payload?.mentor?.length && !payload?.mentee) {
                query.push(
                    {
                        $lookup: {
                            from: 'users',
                            let: { mId: "$mentorId" },
                            pipeline: [
                                {
                                    $match: {
                                        $expr: {
                                            $and: [
                                                { $eq: ["$$mId", "$_id"] }
                                            ]
                                        }
                                    }
                                },
                                {
                                    $project: {
                                        _id: 1,
                                        preferredFname: 1,
                                        preferredLname: 1,
                                        legalFname: 1,
                                        legalLname: 1,
                                        profilePic: 1,
                                        totalLogin: 1
                                    }
                                }
                            ],
                            as: "mentorId"
                        }
                    },
                    {
                        $unwind: {
                            path: "$mentorId",
                            preserveNullAndEmptyArrays: true
                        }
                    }
                )
            }

            if (!sort?.partner && !payload?.partner?.length) {
                query.push(
                    {
                        $lookup: {
                            from: 'users',
                            let: { aId: "$createdBy" },
                            pipeline: [
                                {
                                    $match: {
                                        $expr: {
                                            $and: [
                                                { $eq: ["$$aId", "$_id"] }
                                            ]
                                        }
                                    }
                                },
                                {
                                    $project: {
                                        _id: 1, legalFname: 1, legalLname: 1, profilePic: 1, totalLogin: 1
                                    }
                                }
                            ],
                            as: "createdBy"
                        }
                    },
                    {
                        $unwind: {
                            path: "$createdBy",
                            preserveNullAndEmptyArrays: true
                        }
                    }
                )
            }

            // query.push(
            //     {
            //         $lookup: {
            //             from: 'users',
            //             let: { pId: "$_id" },
            //             pipeline: [
            //                 {
            //                     $match: {
            //                         $expr: {
            //                             $and: [
            //                                 { $eq: ["$$pId", "$createdForPair"] }
            //                             ]
            //                         }
            //                     }
            //                 }
            //             ],
            //             as: "note"
            //         }
            //     },
            //     {
            //         $addFields: {
            //             note: { $size: "$note" }
            //         }
            //     }
            // )

            const pairList = aggregate({
                collection: "PairInfo",
                pipeline: query
            });

            const pairListCount = aggregate({
                collection: "PairInfo",
                pipeline: countQuery
            });

            const response: any = await Promise.allSettled([pairList, pairListCount]);

            let pairListData = {
                docs: response[0]?.value,
                total: response[1]?.value?.length,
                page: page,
                limit: limit,
                pages: Math.ceil(response[1]?.value?.length / limit)
            };

            res.send(success(successMessage.FETCH_SUCCESS.replace(":attribute", "pairList"), pairListData, statusCode.OK));
        } catch (err: any) {
            res
                .status(statusCode.FORBIDDEN)
                .send(error("There is some issue to get deleteQuestion.", err.message, statusCode.FORBIDDEN));
        }
    },

    getPair: async function (req: any, res: any) {
        try {
            let { id } = req.query;
            let pairList = await findOne({
                collection: "PairInfo",
                query: { _id: id },
                populate: [
                    {
                        path: "menteeId",
                        select: "legalFname legalLname preferredFname preferredLname profilePic address"
                    },
                    {
                        path: "mentorId",
                        select: "legalFname legalLname preferredFname preferredLname profilePic address"
                    },
                    { path: "menteeAns.question", select: "queType weight question" },
                    { path: "mentorAns.question", select: "queType weight question" },
                ],
            });

            const alreadyPaired = await findOne({
                collection: "PairInfo",
                query: { menteeId: pairList?.menteeId?._id, isConfirm: true }
            });

            if (alreadyPaired) {
                pairList.isConfirm = true;
            }

            let menteeSchool = await findOne({ collection: 'AdditionalInfo', query: { userId: pairList.menteeId._id } })

            const findQue = await findOne({
                collection: 'Matches',
                query: {
                    question: questionConst.School_Question,
                    $or: [{ partnerId: pairList?.partnerIdOrRegionId }, { regionId: pairList?.partnerIdOrRegionId }]
                }
            })

            const findMentorAns = await findOne({
                collection: 'AnswerByMentors',
                query: { user: pairList?.mentorId?._id, 'queAns.question': findQue?._id }
            })

            const mentorSchool = (findMentorAns?.queAns?.filter((i: any) => (i?.question != undefined && i?.question?.toString()) === findQue?._id?.toString()))

            pairList.menteeId.school = menteeSchool?.education_level?.assignedSchoolOrInstitutions || []
            pairList.mentorId.school = mentorSchool?.[0]?.answer || []
            pairList.mentorId.profilePic = (pairList.mentorId && pairList.mentorId.profilePic) ? pairList.mentorId.profilePic : "";

            let msgList = await findOne({
                collection: "Messages", query: {
                    $or: [
                        { $and: [{ senderId: pairList.mentorId }, { receiverId: pairList.menteeId }] },
                        { $and: [{ senderId: pairList.menteeId }, { receiverId: pairList.mentorId }] }
                    ]
                },
                sort: { createdAt: -1 }
            })

            pairList.message = msgList
            if (!pairList)
                return res
                    .status(statusCode.BAD_REQUEST)
                    .send(error(errorMessage.NOT_EXISTS.replace(":attribute", "Pair"), {}, statusCode.BAD_REQUEST));
            res.send(success(successMessage.FETCH_SUCCESS.replace(":attribute", "Pair"), pairList, statusCode.OK));
        } catch (err: any) {

            console.log(err)
            res
                .status(statusCode.FORBIDDEN)
                .send(error("There is some issue to get pair.", err.message, statusCode.FORBIDDEN));
        }
    },

    doPairOperation: async function (req: any, res: any) {
        try {
            let request = req as requestUser;
            let { id, type } = req.body;

            let updateQuery: any = { $set: {} };
            let message = "";
            let audit;
            if (type == "Select Pair") {
                updateQuery.$set["isConfirm"] = true;
                updateQuery.$set['createdBy'] = request.user._id, updateQuery.$set['isUpdated'] = false, updateQuery.$set['addOnDate'] = new Date(), message = "Pair was successfully selected!"
                audit = User_Activity.SELECTED_PAIR;
            }
            if (type == "UnSelect Pair") {
                updateQuery.$set["isConfirm"] = false;
                updateQuery.$set['isUpdated'] = false, message = "Pair was successfully unselected!"
                audit = User_Activity.UNSELECTED_PAIR;
            }
            if (type == "Archive Pair") {
                updateQuery.$set["isArchive"] = true;
                updateQuery.$set["isConfirm"] = false;
                message = "Pair was successfully archived!"
            }
            if (type == "UnArchive Pair") {
                updateQuery.$set["isArchive"] = false;
                updateQuery.$set["isUpdated"] = false;
                message = "Pair was successfully unarchived!"
            }

            let pairList = await find({
                collection: "PairInfo",
                query: { _id: id, isDel: false },
            });

            if (!pairList) {
                return res
                    .status(statusCode.BAD_REQUEST)
                    .send(error(errorMessage.NOT_EXISTS.replace(":attribute", "Pair"), {}, statusCode.BAD_REQUEST));
            }

            var updatePair = await findOneAndUpdate({
                collection: "PairInfo",
                query: { _id: new Object(id) },
                update: updateQuery,
                options: { new: true }
            });

            // Send system badges when mentee or mentor matched first time than send matched badge
            // updateMatchedBadge({ data: { mentorId: updatePair.mentorId, menteeId: updatePair.menteeId } });

            if (type == "Select Pair") {

                let status: any = statusType.MATCHED

                let isMentorRegister = await findOne({ collection: "User", query: { _id: updatePair.mentorId } })
                let isMenteeRegister = await findOne({ collection: "User", query: { _id: updatePair.mentorId } })

                if (isMentorRegister && !isMentorRegister.password) {
                    status = statusType.MATCHED_NOT_REGISTERED
                }

                if (isMenteeRegister && !isMenteeRegister.password) {
                    status = statusType.MATCHED_NOT_REGISTERED
                }

                await findOneAndUpdate({
                    collection: "User",
                    query: { _id: updatePair.mentorId },
                    update: { $set: { status: status } },
                    options: { new: true }
                });

                await findOneAndUpdate({
                    collection: "User",
                    query: { _id: updatePair.menteeId },
                    update: { $set: { status: status } },
                    options: { new: true }
                });

                // Send notification when mentor and mentee pair confirm by admin or partner
                let data: any = {
                    userId: request.user._id.toString(),
                    user_role: request.user.role,
                    sendTo: [updatePair.mentorId.toString(), updatePair.menteeId.toString()],
                    type: notificationType.MATCHED,
                    dataId: updatePair._id.toString(),
                    content: notificationMessage.matched,
                    mentorId: updatePair.mentorId,
                    menteeId: updatePair.menteeId,
                };
                sendNotification(data);
                let sendPushMentor = authController.checkActiveUser(updatePair.mentorId.toString());
                let sendPushMentee = authController.checkActiveUser(updatePair.menteeId.toString());
                const sendPush: any = await Promise.allSettled([sendPushMentor, sendPushMentee]);
                let sendTo: any = [];
                if (sendPush[0].value) {
                    sendTo.push(updatePair.mentorId.toString());
                }
                if (sendPush[1].value) {
                    sendTo.push(updatePair.menteeId.toString());
                }
                data.sendTo = sendTo;
                sendPushNotification(data);

                // for (let i = 0; i < data.sendTo?.length; i++) {
                //     const badgeCounts = await countDocuments({
                //         collection: 'Notification',
                //         query: { to: data.sendTo[i], read: false }
                //     });
                //     data.badgeCounts = badgeCounts;
                //      sendPushNotification(data);
                // }

                // Send popup when mentor and mentee pair confirm by admin or partner
                matchedFound({
                    data: {
                        mentorId: updatePair.mentorId.toString(),
                        menteeId: updatePair.menteeId.toString()
                    }
                })

            } else if (type == "UnSelect Pair" || type == "UnArchive Pair") {

                const unselectedPairUser = [{ mentorId: updatePair.mentorId }, { menteeId: updatePair.menteeId }];

                unselectedPairUser.map(async (ele: any) => {

                    let query: any = {};
                    let updateQuery: any = {};
                    let countQuery: any = {};
                    if (ele.mentorId) {
                        query = { mentorId: ele.mentorId, isConfirm: true };
                        updateQuery = { _id: ele.mentorId };
                        countQuery = { userId: ele.mentorId?.toString(), role: userRoleConstant.MENTOR };
                    } else {
                        query = { menteeId: ele.menteeId, isConfirm: true };
                        updateQuery = { _id: ele.menteeId };
                        countQuery = { userId: ele.menteeId?.toString(), role: userRoleConstant.MENTEE };
                    }
                    const allPair = await findOne({
                        collection: "PairInfo",
                        query,
                    });

                    const user = await findOne({
                        collection: "User",
                        query: updateQuery,
                    });

                    let userStatus: string = statusType.MATCHING;
                    if (allPair && user.password && user.password != "") {
                        userStatus = statusType.MATCHED
                    } else if (allPair && !user.password && user.password == "") {
                        userStatus = statusType.MATCHED_NOT_REGISTERED
                    }

                    await updateMany({
                        collection: "User",
                        query: updateQuery,
                        update: { $set: { status: userStatus } },
                        options: { new: true }
                    });

                    await updateMany({
                        collection: "Notification",
                        query: { dataId: updatePair._id.toString(), isDel: false },
                        update: { $set: { isDel: true } },
                        options: { new: true }
                    });

                    await getCounts({ data: { user_id: countQuery.userId, user_type: countQuery.role } });
                });

            }

            res.send(success(message, { auditIds: [pairList.mentorId, pairList.menteeId], isAuditLog: true, audit }, statusCode.OK));

        } catch (err: any) {
            res
                .status(statusCode.FORBIDDEN)
                .send(error("There is some issue to get deleteQuestion.", err.message, statusCode.FORBIDDEN));
        }
    },

    dragAndDrop: async function (req: any, res: any) {
        try {
            let request = req as requestUser
            let {
                oldPosition,
                newPosition,
                type,
                oldCategories,
                newCategories,
                newCategoriesPoz,
                id,
                oldCategoriesPoz
            } = req.body;
            let findQuestion = await find({
                collection: "Matches",
                query: {
                    isDel: false,
                    _id: id,
                },
            });
            if (!findQuestion)
                return res
                    .status(statusCode.BAD_REQUEST)
                    .send(error(errorMessage.NOT_EXISTS.replace(":attribute", "Question"), {}, statusCode.BAD_REQUEST));

            if (oldPosition && newPosition && type == 'Question') {

                const position = await findOne({
                    collection: 'Matches',
                    query: { _id: id, orderNum: oldPosition }
                })

                const isOldPositionExits = await findOne({
                    collection: 'Matches',
                    query: { orderNum: oldPosition }
                })

                const isNewPositionExits = await findOne({
                    collection: 'Matches',
                    query: { orderNum: newPosition }
                })

                if (!position) {
                    res.statusCode = statusCode.BAD_REQUEST;
                    throw new Error(
                        errorMessage.NOT_EXISTS.replace(':attribute', 'position')
                    );
                } else if (!isOldPositionExits) {
                    res.statusCode = statusCode.BAD_REQUEST;
                    throw new Error(
                        errorMessage.NOT_EXISTS.replace(':attribute', 'oldPosition')
                    );
                } else if (!isNewPositionExits) {
                    res.statusCode = statusCode.BAD_REQUEST;
                    throw new Error(
                        errorMessage.NOT_EXISTS.replace(':attribute', 'newPosition')
                    );
                } else {

                    let headerPosition
                    if (oldPosition < newPosition) {
                        headerPosition = await findOneAndUpdate({
                            collection: 'Matches',
                            query: { _id: id },
                            update: {
                                $set: {
                                    orderNum: newPosition
                                }
                            }
                        })
                        const btPostion = await updateMany({
                            collection: 'Matches',
                            query: {
                                _id: { $ne: new ObjectId(id) },
                                $or: [{ partnerId: request.user.partnerAdmin }, { regionId: request.user.region }],
                                isDel: false,
                                orderNum: {
                                    $gte: oldPosition,
                                    $lte: newPosition
                                }
                            },
                            update: {
                                $inc: { orderNum: -1 }
                            }
                        })
                    } else {
                        headerPosition = await findOneAndUpdate({
                            collection: 'Matches',
                            query: { _id: id },
                            update: {
                                $set: {
                                    orderNum: newPosition
                                }
                            }
                        })
                        const btPostion = await updateMany({
                            collection: 'Matches',
                            query: {
                                _id: { $ne: id },
                                $or: [{ partnerId: request.user.partnerAdmin }, { regionId: request.user.region }],
                                isDel: false,
                                orderNum: {
                                    $gte: newPosition,
                                    $lte: oldPosition
                                }
                            },
                            update: {
                                $inc: { orderNum: 1 }
                            }
                        })
                    }
                }
            }

            if (oldCategories && newCategories && type == 'Question') {
                const isQuestionCategory = await findOne({
                    collection: 'Matches',
                    query: { _id: id, category: oldCategories }
                })

                if (!isQuestionCategory) {
                    res.statusCode = statusCode.BAD_REQUEST;
                    throw new Error(
                        errorMessage.NOT_EXISTS.replace(':attribute', 'category')
                    );
                }

                const changeQuestionCategory = await findOneAndUpdate({
                    collection: 'Matches',
                    query: {
                        _id: id,
                        $or: [{ partnerId: request.user.partnerAdmin }, { regionId: request.user.region }],
                        isDel: false
                    },
                    update: { $set: { category: newCategories } }
                })

            }
            // change type of 2 for question Changes ...

            if (newCategoriesPoz && type == "Category") {
                await updateOne({
                    collection: "categorySeq",
                    update: { $set: { category: newCategoriesPoz } },
                });
            }

            res.send(success(successMessage.UPDATE_SUCCESS.replace(":attribute", "Question"), {}, statusCode.OK));

        } catch (err: any) {
            res.status(statusCode.FORBIDDEN).send(error("There is Some Issue To Get DragAndDrop", err.message, statusCode.FORBIDDEN));
        }
    },

    filters: async function (req: Request, res: Response) {
        try {

            let request = req as requestUser

            const status = quentionStatus;
            const weight = await distinct({ collection: 'Matches', field: 'weight' });
            const category = await distinct({ collection: 'Matches', field: 'category', sort: { category: 1 } });

            let query: any = {}
            if (request.user.partnerAdmin) {
                query['partnerId'] = request.user.partnerAdmin
            } else if (request.user.region) {
                query['regionId'] = request.user.region
            }

            query['isDel'] = false
            let addedBy = await find({
                collection: 'Matches',
                query: query,
                populate: { path: 'createdBy', select: 'legalFname legalLname preferredFname preferredLname' },
                project: { 'createdBy': 1 }
            })
            addedBy = _.uniqBy(addedBy, 'createdBy._id')

            addedBy.sort((a: any, b: any) => {
                return a?.createdBy?.legalFname.localeCompare(b?.createdBy?.legalFname)
            })
            res.send(success(successMessage.UPDATE_SUCCESS.replace(":attribute", "Question"), {
                status,
                weight,
                category,
                addedBy: addedBy.length > 0 ? addedBy : []
            }, statusCode.OK));
        } catch (err: any) {
            res
                .status(statusCode.FORBIDDEN)
                .send(error("There is some issue to get deleteQuestion.", err.message, statusCode.FORBIDDEN));
        }
    },

    sendMessageToPair: async (req: Request, res: Response) => {
        try {
            const { message, pairId, files, media, type } = req.body;
            const request = req as requestUser;
            const senderId = request.user._id.toString()

            const isPairExists = await findOne({ collection: 'PairInfo', query: { _id: pairId } });

            if (!isPairExists) {
                res.status(statusCode.BAD_REQUEST).send(error(errorMessage.NOT_EXISTS.replace(':attribute', 'pair'), {}, statusCode.BAD_REQUEST))
                return
            }

            var menteesList: Array<any> = [], mentorList: Array<any> = [], mentorAndMentees: Array<any> = []
            let audit;

            let chType;
            if (type == "Message Mentees") {
                menteesList = await distinct({ collection: 'PairInfo', field: 'menteeId', query: { _id: pairId } });
                mentorAndMentees = menteesList
                audit = User_Activity.SEND_MESSAGE_MENTEES;
            } else if (type == "Message Mentors") {
                mentorList = await distinct({ collection: 'PairInfo', field: 'mentorId', query: { _id: pairId } });
                mentorAndMentees = mentorList
                audit = User_Activity.SEND_MESSAGE_MENTORS;
            } else {
                menteesList = await distinct({ collection: 'PairInfo', field: 'menteeId', query: { _id: pairId } });
                mentorList = await distinct({ collection: 'PairInfo', field: 'mentorId', query: { _id: pairId } });
                audit = User_Activity.SEND_MESSAGE_PAIR;
                mentorAndMentees = mentorList.concat(menteesList);
                chType = "Pair"
            }

            let addMessage: any

            for (let i = 0; i < mentorAndMentees.length; i++) {
                const receiverId = mentorAndMentees[i];

                let query: { $or: any[] } = {
                    $or: [
                        { $and: [{ senderId: senderId }, { receiverId: receiverId }] },
                        { $and: [{ senderId: receiverId }, { receiverId: senderId }] }
                    ]
                };

                const chat = await find({ collection: "Messages", query });

                var chId;
                if (chat.length) {
                    chId = chat[0].chId;
                } else {
                    chId = uuidv4(); // Generate a UUID using v4
                }

                if (files && files.length > 0) {
                    for (let i = 0; i < files.length; i++) {
                        const file = files[i];

                        await sendMsg({
                            data: {
                                chType: chType,
                                user_id: senderId,
                                user_type: request.user.role,
                                receiverId: receiverId.toString(),
                                // message: message,
                                msg_type: msg_Type.FILE,
                                file: file.Location,
                                fileKey: file.key
                            }
                        });

                    }
                }

                if (media && media.length > 0) {
                    for (let i = 0; i < media.length; i++) {
                        const mediaFile = media[i];

                        await sendMsg({
                            data: {
                                chType: chType,
                                user_id: senderId,
                                user_type: request.user.role,
                                receiverId: receiverId.toString(),
                                // message: message,
                                msg_type: msg_Type.MEDIA,
                                file: mediaFile.Location,
                                fileKey: mediaFile.key
                            }
                        });

                    }
                }

                if (message) {
                    await sendMsg({
                        data: {
                            chType: chType,
                            user_id: senderId,
                            user_type: request.user.role,
                            receiverId: receiverId.toString(),
                            message: message,
                            msg_type: msg_Type.MESSAGE
                        }
                    });
                }

            }

            res.send(success("Your message has been sent.", { addMessage, auditIds: mentorAndMentees, isAuditLog: true, audit }, statusCode.OK))
        } catch (err) {
            logger.error(`There was an issue into send request mail.: ${err} `)
            res.status(statusCode.FORBIDDEN).send(error("There was an issue into send message.", err))
        }
    },

    attendedEventsOfPairs: async (req: Request, res: Response) => {
        try {
            let pairObj = await findOne({ collection: 'PairInfo', query: { _id: req.body.pairId, isDel: false } });
            if (!pairObj) {
                res.status(statusCode.BAD_REQUEST).send(error(errorMessage.NOT_EXISTS.replace(":attribute", 'Pair'), {}, statusCode.BAD_REQUEST));
                return
            }

            let query: { $and: any[] } = { $and: [{ approval: eventStatusConstant.APPROVED, isDel: false }] }

            query.$and.push({
                $or: [{ guest: pairObj.mentorId }, { guest: pairObj.menteeId }]
            })

            if (req.body.search) {
                query.$and.push({ event_name: new RegExp(req.body.search, 'i') })
            }

            if (req.body.eventType && req.body.eventType != "All") {
                query.$and.push({
                    isVirtual: (req.body.eventType == 'Online') ? true : false
                })
            }

            let pipeLine: Array<any> = [
                {
                    $match: query
                },
                {
                    $lookup: {
                        from: 'eventguests',
                        let: { mentorId: '$pairObj.mentorId', eventId: '$_id' },
                        pipeline: [{ $match: { $expr: { $and: [{ $eq: ['$userId', pairObj.mentorId] }, { $eq: ['$attendance', eventAcceptenceTypeConstant.ATTENDED] }, { $eq: ['$eventId', '$$eventId'] }] } } }, { $project: { 'eventId': 1, _id: 0 } }],
                        as: 'mentorEvents'
                    }
                },
                {
                    $addFields: {
                        mentorEvents: {
                            $map: {
                                input: "$mentorEvents",
                                as: 'mentorEvents',
                                in: '$$mentorEvents.eventId'
                            }
                        }
                    }
                },
                {
                    $lookup: {
                        from: 'eventguests',
                        let: { menteeId: '$pairObj.menteeId', mentorEvent: '$mentorEvents' },
                        pipeline: [{ $match: { $expr: { $and: [{ $eq: ['$userId', pairObj.menteeId] }, { $in: ['$eventId', '$$mentorEvent'] }, { $eq: ['$attendance', eventAcceptenceTypeConstant.ATTENDED] }] } } }, { $sort: { updatedAt: -1 } }],
                        as: 'menteeEvents'
                    }
                },
                {
                    $unwind: '$menteeEvents'
                },
                {
                    $lookup: {
                        from: 'events',
                        let: { 'eventId': '$menteeEvents.eventId' },
                        pipeline: [{ $match: { $expr: { $eq: ['$_id', '$$eventId'] } } }, { $project: { event_name: 1, location: 1, start_date: 1, isVirtual: 1, thumbnail: 1 } }],
                        as: 'events'
                    }
                },
                {
                    $unwind: '$events'
                },
                {
                    $project: {
                        event_name: '$events.event_name',
                        location: '$events.location',
                        start_date: '$events.start_date',
                        isVirtual: '$events.isVirtual',
                        thumbnail: '$events.thumbnail'
                    }
                }
            ]

            const eventListCount = await aggregate({ collection: 'Event', pipeline: pipeLine });

            pipeLine.push(
                {
                    $skip: (req.body.page - 1) * req.body.limit
                },
                {
                    $limit: req.body?.limit || 9
                }
            )

            let eventList = await aggregate({ collection: 'Event', pipeline: pipeLine })

            // let eventList = await paginate({
            //     collection: 'Event', query: query, options: {
            //         select: { event_name: 1, location: 1, start_date: 1, isVirtual: 1, thumbnail: 1 },
            //         page: req.body?.page || 1, limit: req.body?.limit || 9
            //     }
            // })

            // const isApprovedEvent = await find({
            //     collection: 'EventGuest',
            //     query: {
            //         $or: [{ userId: pairObj.mentorId }, { userId: pairObj.menteeId }],
            //         status: eventStatusConstant.APPROVED
            //     }
            // })
            let result = {
                docs: eventList,
                page: req.body?.page || 1,
                pages: Math.ceil(eventListCount.length / req.body.limit),
                total: eventListCount.length,
                limit: req.body.limit
            }

            // if (isApprovedEvent && isApprovedEvent.length > 0) {
            //     eventList = eventList
            // } else {
            //     eventList = {
            //         docs: [],
            //         "page": 1,
            //         "pages": 1,
            //         "total": 0,
            //         "limit": 9
            //     }
            // }

            res.send(success(successMessage.FETCH_SUCCESS.replace(":attribute", 'AttendedEvent'), result))
        } catch (err: any) {
            logger.error(`There is some issue in fetching attended event for pairs: ${err} `)
            res.status(statusCode.FORBIDDEN).send(error("There is some issue in fetching attended event for pairs", err.message, statusCode.FORBIDDEN))
        }
    },

    conversation: async (req: Request, res: Response) => {
        try {
            let pairObj = await findOne({ collection: "PairInfo", query: { _id: req.body.pairId, isDel: false } });
            if (!pairObj) {
                res.status(statusCode.BAD_REQUEST).send(error(errorMessage.NOT_EXISTS.replace(":attribute", "Pair"), {}, statusCode.BAD_REQUEST));
                return
            }
            // let
            let query: any = {
                $or: [
                    { $and: [{ senderId: pairObj.mentorId }, { receiverId: pairObj.menteeId }] },
                    { $and: [{ senderId: pairObj.menteeId }, { receiverId: pairObj.mentorId }] },
                    { $and: [{ receiverId: pairObj.mentorId }, { chType: 'Pair' }] },
                ]
            };
            // if (req.body.search) {
            //   query['message'] = new RegExp(req.body.search, 'i')
            // }

            if (req.body.last_id) {
                query['_id'] = {
                    $lt: req.body.last_id,
                    msg_Type: { $in: [msg_Type.FILE, msg_Type.MEDIA, msg_Type.MESSAGE, msg_Type.PROJECT, msg_Type.CONTENT] }
                }
            }

            query['msg_type'] = {
                $in: [msg_Type.FILE, msg_Type.MEDIA, msg_Type.MESSAGE, msg_Type.PROJECT, msg_Type.CONTENT]
            }

            let messageList: Array<any> = await find({
                collection: 'Messages', query: query, populate: [
                    { path: "senderId", select: "_id preferredFname preferredLname role profilePic profilePicKey" },
                    { path: "receiverId", select: "_id preferredFname preferredLname role profilePic profilePicKey" },
                    { path: "badge", select: "badgeName" },
                    { path: 'contentId' }
                ],
                sort: { createdAt: -1 },
                // limit: req.body.limit || 10
                // skip: skip,
            });

            let messageCount = messageList.length;

            let mediaList = messageList.filter((x: any) => {
                return x.msg_type == msg_Type.MEDIA
            });
            let filesList = messageList.filter((x: any) => {
                return x.msg_type == msg_Type.FILE || x.msg_type == msg_Type.PROJECT
            })
            let linkList = messageList.filter((x: any) => {
                return x.msg_type == msg_Type.CONTENT && x.contentId.category == ContentConstants.CONTENT_CATEGORY.link
            })

            if (req.body.search) {
                messageList = messageList.filter((item: any) => item?.message?.toLowerCase()?.replace(/\n/g, '')?.includes(req.body.search?.toLowerCase()) || item?.message?.toLowerCase()?.replace(/\n/g, ' ')?.includes(req.body.search?.toLowerCase()));
            }

            messageList = messageList.slice(0, req.body.limit || 10)

            res.send(success(successMessage.FETCH_SUCCESS.replace(":attribute", 'Conversation'), {
                messageList,
                messageCount,
                mediaList,
                filesList,
                linkList,
            }))
        } catch (err: any) {
            res.status(statusCode.FORBIDDEN).send(error("There is some issue to retrive conversation", err.message, statusCode.FORBIDDEN))
        }
    },

    importQuestionFromCSV: async (req: Request, res: Response) => {
        try {
            let csvFile: any = req.file
            let request = req as requestUser
            const extArr = uploadConstant.CSV_FILE_EXT_ARR;

            if (request.user.role == userRoleConstant.I_SUPER_ADMIN) {
                res.status(statusCode.UNAUTHORIZED).send(error(errorMessage.ACTION.replace(":attribute", request.user.role), {}, statusCode.UNAUTHORIZED));
                return
            }

            // validate file
            let validateUplaodedFile = await validateFile(res, csvFile, 'csv', extArr);
            if (validateUplaodedFile) {
                res.status(statusCode.BAD_REQUEST).send(error(validateUplaodedFile, {}, statusCode.BAD_REQUEST))
                return
            }
            let skippedQuestion: Array<any> = [], message: string = ''


            csvtojson()
                .fromFile(__dirname + "/../../uploads/QuestionCsv/" + csvFile.filename)
                .then(async (data: Array<any>) => {
                    const totalData = data.length;

                    for (let i = 0; i < data.length; i++) {
                        let rows = data[i];
                        let obj: any = {}, orderQuery: any = {}, isCategotyMatched = false, isQustionTypeMatched = false
                        let questionCategory = Object.values(categoryOfQuestion);
                        let questionType = Object.values(quentionType)

                        for (var key in questionCategory) {
                            if (questionCategory[key] == rows['category']) {
                                isCategotyMatched = true
                                break
                            }
                        }
                        if (!isCategotyMatched) {
                            message = "Please enter a valid question category."
                        }

                        for (var key in questionType) {
                            if (questionType[key] == rows['questionType']) {
                                isQustionTypeMatched = true
                                break
                            }
                        }
                        if (!isQustionTypeMatched) {
                            message = "Please enter a valid questionType."
                        }

                        let rowsKey = ['category', 'question', 'answer', 'questionType', 'status', 'weight']
                        for (var key in rows) {
                            for (let j = 0; j < rowsKey.length; j++) {
                                if (!rows[rowsKey[j]]) {
                                    key = capitalizeFirstLetter(rowsKey[j]);
                                    message = `${key} is required.`
                                    break
                                }
                            }
                            // if (rows.question && rows.questionType && rows.status && rows.weight && rows.category) {

                            // }
                            /* else {
                message = "Question is required."
              } */
                        }

                        if (rows['weight'] < 0.1 || rows['weight'] > 1) {
                            message = errorMessage.BETWEEN.replace(':attribute', 'weight').replace(":min", "0.1").replace(":max", "1")
                        }

                        if (!message) {
                            // let matchObj = await findOne({ collection: 'Matches', query: { question: rows.question, category: rows.category, queType: rows.questionType, weight: rows.weight, status: rows.status } });
                            obj = {
                                question: rows.question,
                                queType: rows.questionType,
                                status: rows.status,
                                weight: rows.weight,
                                category: rows.category,
                                createdBy: request.user._id
                            }

                            if (rows.alternateQuestion) {
                                obj['isAlternateQuestion'] = true;
                                obj['alternateQuestion'] = rows.alternateQuestion
                            }


                            if (request.user.partnerAdmin) {
                                orderQuery['partnerId'] = request.user.partnerAdmin
                                obj['partnerId'] = request.user.partnerAdmin
                            } else if (request.user.region) {
                                orderQuery['regionId'] = request.user.region
                                obj['regionId'] = request.user.region
                            } else {
                                obj = {}
                                rows.message = `${request.user.role} can't add question.`
                                rows.row = i + 2;

                                skippedQuestion.push(rows);
                            }
                            orderQuery['isDel'] = false
                            let orderNum = await findOne({
                                collection: "Matches",
                                query: orderQuery,
                                sort: { orderNum: -1 },
                                limit: 1,
                            });

                            obj['orderNum'] = (orderNum && orderNum.orderNum) ? orderNum.orderNum + 1 : 1;

                            let answerArr: Array<any> = []
                            let answerArray = rows.answer.split(",")
                            for (let j = 0; j < answerArray.length; j++) {
                                const answer = answerArray[j];
                                answerArr.push({
                                    optionNum: j + 1,
                                    option: answer
                                })
                            }
                            obj['option'] = answerArr

                            let isEmptyObj = _.isEmpty(obj)
                            if (!isEmptyObj) {
                                await insertOne({ collection: 'Matches', document: obj })
                            }
                        } /* else {
              message = "Question is required."
            } */

                        if (message) {
                            rows.message = message;
                            rows.row = i + 2;

                            skippedQuestion.push(rows);
                            message = "";
                        }
                    }
                    let uploadedQuestion = data.length - skippedQuestion.length
                    let skippedQuestionCount = skippedQuestion.length
                    let keyArr: Array<any> = [], skippedQuestionKey: Array<any> = []
                    skippedQuestion.forEach(obj => {
                        let obj1 = { ...obj };
                        let key = Object.keys(obj1);
                        for (let i = 0; i < key.length; i++) {
                            keyArr.push(key[i]);

                        }
                    });

                    skippedQuestionKey = keyArr.filter((item, field) => {
                        return keyArr.indexOf(item) == field
                    })

                    let csvUrl: any;

                    if (skippedQuestion && skippedQuestion.length > 0) {
                        csvUrl = await exportFileFunction(true, 'skipQuestionCsv', skippedQuestion, res, req);
                    }

                    csvUrl = (csvUrl && csvUrl.filePath) ? csvUrl.filePath : "";

                    res.status(statusCode.OK).send(success("CSV uploaded successfully.", {
                        skippedQuestion, totalData,
                        skippedQuestionCount, uploadedQuestion, skippedQuestionKey, csvUrl
                    }, statusCode.OK))
                })

        } catch (err: any) {
            res.status(statusCode.FORBIDDEN).send(error("There is some issue while uploading csv", err.message, statusCode.FORBIDDEN))
        }
    },
    pairProjects: async (req: Request, res: Response) => {
        try {
            let request = req as requestUser;

            const { type, pairId } = req.body;

            let pairObj = await findOne({
                collection: 'PairInfo',
                query: { _id: pairId },
                populate: [{ path: 'mentorId menteeId' }]
            });

            if (!pairObj) {
                res.status(statusCode.BAD_REQUEST).send(error(errorMessage.NOT_EXISTS.replace(":attribute", 'Pair'), {}, statusCode.BAD_REQUEST));
                return
            }

            let query: any = {};
            if (type == msg_Type.CONTENT) {
                query = { userId: request.user._id, isDefaultCourse: false, courseType: msg_Type.CONTENT }
            } else {
                query = {
                    $or: [{ userId: pairObj.mentorId?._id }, { userId: pairObj.menteeId?._id }],
                    isDefaultCourse: false,
                    courseType: { $in: [msg_Type.PROJECT, msg_Type.TRAINING] }
                }
            }

            let userArr: Array<any> = [pairObj.mentorId?.thinkificUserId, pairObj.menteeId?.thinkificUserId]

            let projectList: Array<any> = []
            let getCourse: Array<any> = [], filteredItems: Array<any> = []
            for (let i = 0; i < userArr.length; i++) {
                const user = userArr[i];

                if (user) {
                    getCourse = await find({
                        collection: "RecommendedCourses",
                        query,
                        populate: [
                            {
                                path: 'thinkificCourseId'
                            },
                            {
                                path: "contentId", populate: {
                                    path: 'createdBy',
                                    model: "User", // Assuming the reference to user is in the User model
                                }
                            }
                        ]
                    });

                    if (type !== msg_Type.CONTENT) {

                        let Courses: any = [];
                        getCourse.map((ele: any) => {
                            Courses.push(ele.enrollId);
                        });

                        // Get course detail using third party api call
                        let courseUrl = config.THINKIFIC.API_BASE_URL + "/enrollments/?query[user_id]=" + user;

                        let contentDetail = await axios({
                            method: 'get',
                            url: courseUrl,
                            headers: {
                                'X-Auth-Subdomain': config.THINKIFIC.SUBDOMAIN,
                                'X-Auth-API-Key': config.THINKIFIC.KEY
                            }
                        });

                        if (contentDetail.data && contentDetail.data.items) {

                            // Filter the items based on targetIds
                            filteredItems.push(...contentDetail.data.items.filter((item: any) => Courses.includes(item.id.toString())));

                            // return res.send(success(successMessage.FETCH_SUCCESS.replace(':attribute', "Course"), { contentList: projectList }, statusCode.OK));
                        } else {
                            return res.send(error("No content data received", "", statusCode.INTERNAL_SERVER_ERROR));
                        }
                    }

                }
            }

            projectList = getCourse.map((item: any) => {
                let newItem = item;
                filteredItems.forEach((item2: any) => {
                    if ((pairObj.mentorId?.thinkificUserId.toString() === item2?.user_id.toString() || pairObj.menteeId?.thinkificUserId.toString() === item2.user_id.toString()) && item?.enrollId?.toString() == item2.id.toString()) {

                        newItem.percentage_completed = item2.percentage_completed; // if they do set a new property for your new object called info as the info from item 2 of this arrInfo array
                        newItem.course_name = item2.course_name
                    }
                });
                return newItem;
            });


            projectList = _.uniqWith(projectList, (pre, cur) => {
                if (pre.courseId == cur.courseId) {
                    cur.mentorId = {
                        name: pairObj.mentorId?.preferredFname + " " + pairObj.mentorId?.preferredLname,
                        profilePic: pairObj.mentorId?.profilePic,
                        _id: pairObj.mentorId?._id
                    };

                    cur.mentor_percentage = cur?.percentage_completed || 0

                    cur.menteeId = {
                        name: pairObj.menteeId?.preferredFname + " " + pairObj.menteeId?.preferredLname,
                        profilePic: pairObj.menteeId?.profilePic,
                        _id: pairObj.menteeId?._id
                    }

                    cur.mentee_percentage = pre?.percentage_completed || 0
                    return true;
                } else {
                    cur.mentorId = {
                        name: pairObj.mentorId?.preferredFname + " " + pairObj.mentorId?.preferredLname,
                        profilePic: pairObj.mentorId?.profilePic,
                        _id: pairObj.mentorId?._id
                    };

                    cur.mentor_percentage = (pairObj.mentorId._id.toString() == cur.userId.toString()) ? cur.percentage_completed : 0

                    cur.menteeId = {
                        name: pairObj.menteeId?.preferredFname + " " + pairObj.menteeId?.preferredLname,
                        profilePic: pairObj.menteeId?.profilePic,
                        _id: pairObj.menteeId?._id
                    }

                    cur.mentee_percentage = (pairObj.menteeId._id.toString() == cur.userId.toString()) ? cur.percentage_completed : 0
                    return false
                }
            });

            if (req.body.search) {
                projectList = projectList.filter((data: any) => data.course_name.match(new RegExp(req.body.search, 'i')))
            }

            let page = 1;
            let limit = 10
            if (req.body.limit) {
                limit = req.body.limit
            }

            let pages = Math.ceil(projectList.length / limit);
            let total = projectList.length;
            if (req.body.page) {
                page = req.body.page
            }
            projectList = projectList.slice((page - 1) * limit, page * limit)

            let result = {
                docs: projectList,
                page: page,
                pages,
                total,
                limit: limit
            }

            return res.send(success(successMessage.FETCH_SUCCESS.replace(':attribute', "Content"), { contentList: result }, statusCode.OK));

        } catch (err: any) {
            console.log(err);

            logger.error(`There was an issue into get content list.: ${err}`)
            res.status(statusCode.FORBIDDEN).send(error("There was an issue into get content list.", err.message, statusCode.FORBIDDEN))
        }
    },

    contentAccessed: async (req: Request, res: Response) => {
        try {

            let pairObj = await findOne({ collection: 'PairInfo', query: { _id: req.body.pairId } });

            if (!pairObj) {
                res.status(statusCode.BAD_REQUEST).send(error(errorMessage.NOT_EXISTS.replace(":attribute", "Pair"), {}, statusCode.BAD_REQUEST))
                return
            }

            let query: any = {}

            if (req.body.search) {
                query['contentId.fileName'] = new RegExp(req.body.search, 'i')
            }

            let findQueryParam = (req.body?.contentType || []).find((x: any) => x == "All")

            if (req.body?.contentType?.length > 0 && !findQueryParam) {
                query['contentId.category'] = { $in: req.body.contentType }
            }

            let pipeLine = [
                {
                    $match: {
                        'courseType': ContentConstants.COURSES_TYPE.content,
                        $or: [
                            {
                                userId: pairObj.mentorId
                            },
                            {
                                userId: pairObj.menteeId
                            }
                        ]
                    }
                },
                {
                    $lookup: {
                        from: 'contents',
                        localField: 'contentId',
                        foreignField: "_id",
                        as: 'contentId'
                    }
                },
                {
                    $unwind: {
                        path: '$contentId',
                        preserveNullAndEmptyArrays: true
                    }
                },
                {
                    $match: query
                },
                {
                    $lookup: {
                        from: 'users',
                        localField: 'contentId.createdBy',
                        foreignField: "_id",
                        as: 'contentId.createdBy'
                    }
                },
                {
                    $unwind: {
                        path: '$contentId.createdBy',
                        preserveNullAndEmptyArrays: true
                    }
                },
                {
                    $group: {
                        _id: "$contentId.category",
                        data: {
                            $addToSet: {
                                _id: '$contentId._id',
                                name: '$contentId.fileName',
                                contentFile: '$contentId.contentFile',
                                contentLink: '$contentId.contentLink',
                                thumbnailFile: "$contentId.thumbnailFile",
                                createdAt: '$contentId.createdAt',
                                category: '$contentId.category',
                                type: "$contentId.type",
                                createdBy: { $concat: ['$contentId.createdBy.legalFname', " ", "$contentId.createdBy.legalLname"] },
                                createdByProfilePic: '$contentId.createdBy.profilePic'
                            }
                        },
                    }
                },
                {
                    $project: {
                        _id: 1,
                        data: { $slice: ['$data', req.body?.skip || 0, req.body?.limit || 3] },
                        "totalDocs": { "$size": "$data" },
                        "totalPages": { $ceil: { $divide: [{ "$size": "$data" }, req.body?.limit || 9] } }
                    }
                }
            ]

            let contentAccessedList = await aggregate({ collection: 'RecommendedCourses', pipeline: pipeLine })
            res.send(success(successMessage.FETCH_SUCCESS.replace(":attribute", "Content Accessed List"), contentAccessedList, statusCode.OK))

        } catch (err: any) {
            res.status(statusCode.FORBIDDEN).send(error("There is some issue during fetching content of pair", err.message, statusCode.FORBIDDEN))
        }
    },

    getArchievedPairDetail: async (req: Request, res: Response) => {
        try {
            const { pairId } = req.body;
            const isPairExists = await findOne({ collection: 'PairInfo', query: { _id: pairId } });

            if (!isPairExists) {
                res.status(statusCode.BAD_REQUEST).send(error(errorMessage.NOT_EXISTS.replace(':attribute', 'pair')));
            }

            const mentorId = isPairExists.mentorId;
            const menteeId = isPairExists.menteeId;

            const meesageCount = await find({
                collection: 'Messages',
                query: { $or: [{ senderId: mentorId, receiverId: menteeId }, { senderId: menteeId, receiverId: mentorId }] }
            });

            const mentor = await findOne({ collection: 'User', query: { _id: mentorId }, project: 'totalLogin' })
            const mentee = await findOne({ collection: 'User', query: { _id: menteeId }, project: 'totalLogin' })

            const message = meesageCount.length;
            let login = mentor.totalLogin + mentee.totalLogin;

            res.send(success("Pair detail", { message, login }, statusCode.OK))
        } catch (err) {
            logger.error(`There was an issue into get pair.: ${err} `)
            res.status(statusCode.FORBIDDEN).send(error(err))
        }
    },


    uploadPairCsv: async (req: Request, res: Response) => {
        try {
            let csvFile: any = req.file;
            let request = req as requestUser;
            const extArr = uploadConstant.CSV_FILE_EXT_ARR

            if (request.user.role == userRoleConstant.I_SUPER_ADMIN) {
                res.status(statusCode.UNAUTHORIZED).send(error(errorMessage.ACTION.replace(":attribute", request.user.role), {}, statusCode.UNAUTHORIZED));
                return
            }

            let validateFileUploadedFile = await validateFile(res, csvFile, 'pairCsv', extArr);
            if (validateFileUploadedFile) {
                res.status(statusCode.BAD_REQUEST).send(error(validateFileUploadedFile, {}, statusCode.BAD_REQUEST));
                return
            }

            let skippedPair: Array<any> = [], message: string = ""

            csvtojson()
                .fromFile(process.cwd() + "/uploads/PairCsv/" + csvFile.filename)
                .then(async (csv: Array<any>) => {
                    const totalData = csv.length;
                    const pairedMentees = new Set();
                    const auditIds: any = [];

                    var i = 0;
                    for await (const data of csv) {
                        const rows = data;
                        let isPaired = false;

                        for (var key in rows) {
                            if (!rows['mentorEmail'] || !rows['mentorFname'] || !rows['mentorLname']) {
                                message = `Invalid mentor's First/Last name or Email.`
                                break
                            } else if (!rows['menteeEmail'] || !rows['menteeFname'] || !rows['menteeLname']) {
                                message = `Invalid mentee's First/Last name or Email.`
                                break
                            } else if (!rows[key]) {
                                key = capitalizeFirstLetter(key);
                                message = `${key} is required.`
                                break
                            }
                        }

                        if (rows['mentorEmail']) {
                            let regexPattern = /\S+@\S+\.\S+/
                            let isEmailValid = regexPattern.test(rows['mentorEmail']);
                            if (!isEmailValid) {
                                message = `Invalid Email of Mentor.`
                            }

                            let emailExists = await findOne({
                                collection: 'User',
                                query: { email: rows.mentorEmail?.toLowerCase(), isDel: false }
                            });

                            if (emailExists) {
                                message = `This ${rows['mentorEmail']} mentor email is already exists.`
                            }
                        } else if (rows['menteeEmail']) {
                            let regexPattern = /\S+@\S+\.\S+/
                            let isEmailValid = regexPattern.test(rows['menteeEmail'])
                            if (!isEmailValid) {
                                message = `Invalid Email of Mentee.`
                            }

                            let emailExists = await findOne({
                                collection: 'User',
                                query: { email: rows.mentorEmail?.toLowerCase(), isDel: false }
                            });

                            if (emailExists) {
                                message = `This ${rows['menteeEmail']} mentee email is already exists.`
                            }
                        }

                        if (rows['mentorPhoneNo'] && (rows['mentorPhoneNo'].length < 10 || rows['mentorPhoneNo'].length > 11 || rows['mentorPhoneNo'].includes(".")) ||
                            rows['menteePhoneNo'] && (rows['menteePhoneNo'].length < 10 || rows['menteePhoneNo'].length > 11 || rows['menteePhoneNo'].includes("."))) {
                            message = "Phone number length should be 10 or 11"
                        }

                        if (pairedMentees.has(rows['menteeEmail'])) {
                            isPaired = true;
                            message = `Mentee with email ${rows['menteeEmail']} is already paired.`;
                        }

                        if (!message && rows['mentorEmail'] && rows['menteeEmail']) {

                            pairedMentees.add(rows['menteeEmail']);

                            if (!isPaired) {

                                const mentor = addMentor(rows, request.user);
                                const mentee = addMentee(rows, request.user);

                                const mentorOrMentee: any = await Promise.allSettled([mentor, mentee]);

                                let users: Array<any> = [mentorOrMentee[0].value, mentorOrMentee[1].value];
                                auditIds.push(mentorOrMentee[0].value);
                                auditIds.push(mentorOrMentee[1].value);

                                if (mentorOrMentee[1]?.value?.error) {
                                    message = mentorOrMentee[1]?.value?.message;
                                } else {
                                    let questionObj: any = {}

                                    if (request.user.partnerAdmin) {
                                        questionObj['partnerId'] = request.user.partnerAdmin
                                    } else if (request.user.region) {
                                        questionObj['regionId'] = request.user.region
                                    }
                                    questionObj['isDel'] = false;
                                    questionObj['status'] = questionState.ACTIVE
                                    const questionList = await find({ collection: "Matches", query: questionObj });

                                    const mentorAnswerObj = answerByMentor(mentorOrMentee[0]?.value?._id, mentorOrMentee[1]?.value?._id, request.user, questionList);
                                    const menteeAnswerObj = answerByMentee(mentorOrMentee[1]?.value?._id, mentorOrMentee[0]?.value?._id, request.user, questionList);

                                    const mentorOrMenteeAnswer: any = await Promise.allSettled([mentorAnswerObj, menteeAnswerObj]);

                                    // const uniqueId = uuidv4();
                                    await addToPairMatches({
                                        mentorId: mentorOrMentee[0]?.value?._id?.toString(),
                                        isCsvPair: true,
                                        addOnDate: new Date(),
                                        pairUser: mentorOrMentee[1]?.value?._id?.toString(),
                                        jobId: uuidv4()
                                    });
                                    await addToPairMatches({
                                        menteeId: mentorOrMentee[1]?.value?._id?.toString(),
                                        isCsvPair: true,
                                        addOnDate: new Date(),
                                        pairUser: mentorOrMentee[0]?.value?._id?.toString(),
                                        jobId: uuidv4()
                                    });

                                    for (let u = 0; u < users.length; u++) {
                                        const user = users[u];

                                        const url = process.env.FRONT_URL + `register?id=${user._id}`;
                                        var template = fs.readFileSync(__dirname + "/../../src/utils/emailTemplates/headerfooter.html").toString();
                                        var content = fs.readFileSync(__dirname + "/../../src/utils/emailTemplates/registerUserInvitation.html").toString();
                                        content = content.replace(/{{fullname}}/g, (user.legalFname + " " + user.legalLname));
                                        content = content.replace(/{{adminUserName}}/g, (request.user.legalFname + " " + request.user.legalLname));
                                        content = content.replace(/{{adminUserRole}}/g, request.user.role)
                                        content = content.replace(/{{adminUserProfilePic}}/g, request.user.profilePic ? request.user.profilePic : defaultProfilePicConstant.USER_PROFILE_PIC)
                                        content = content.replace(/{{url}}/g, url)
                                        template = template.replace(/{{template}}/g, content);

                                        sendMail(user.email, `You're Registered for iMentor`, 'iMentor', template);
                                    }
                                }

                            }
                        }

                        if (message) {
                            rows.mesage = message;
                            rows.row = i + 2;
                            skippedPair.push(rows);
                            message = ""
                        }

                    }

                    let skippedPairCount = skippedPair.length;
                    let uploadedPair = csv.length - skippedPairCount;

                    let csvUrl: any;

                    if (skippedPair && skippedPair.length > 0) {
                        csvUrl = await exportFileFunction(true, 'skipPairCsv', skippedPair, res, req);
                    }

                    csvUrl = (csvUrl && csvUrl.filePath) ? csvUrl.filePath : "";
                    res.status(statusCode.OK).send(success(successMessage.UPLOAD_SUCCESS.replace(":attribute", 'PairCsv'), {
                        skippedPair,
                        skippedPairCount,
                        uploadedPair,
                        csvUrl,
                        totalData,
                        auditIds,
                        isAuditLog: true,
                        isCsv: true,
                        audit: User_Activity.CREATE_BULK_PAIR
                    }))
                })

        } catch (err: any) {
            res.status(statusCode.FORBIDDEN).send(error("There is some issue during uploading csv", err.message, statusCode.FORBIDDEN))
        }
    },

    pairProjectV2: async (req: Request, res: Response) => {
        try {
            let pairObj = await findOne({ collection: "PairInfo", query: { _id: req.body.pairId, isDel: false } });

            if (!pairObj) {
                res.status(statusCode.BAD_REQUEST).send(error(errorMessage.NOT_EXISTS.replace(":attribute", "Pair"), {}, statusCode.BAD_REQUEST));
                return
            }

            let pipeLine = [
                {
                    $match: {
                        userId: { $in: [pairObj.mentorId, pairObj.menteeId] },
                        courseType: "Project"
                    }
                },
                {
                    $lookup: {
                        from: 'thinkificcourses',
                        localField: 'thinkificCourseId',
                        foreignField: '_id',
                        as: 'thinkificcourses'
                    }
                },
                {
                    $unwind: {
                        path: '$thinkificcourses',
                        preserveNullAndEmptyArrays: true
                    }
                },
                {
                    $lookup: {
                        from: 'users',
                        localField: 'userId',
                        foreignField: '_id',
                        as: 'userId'
                    }
                },
                {
                    $unwind: {
                        path: '$userId',
                        preserveNullAndEmptyArrays: true
                    }
                },
                {
                    $addFields: {
                        mentorPercentage: {
                            $cond: [{ $eq: ['$userId.role', "Mentor"] }, '$percentageCompleted', 0]
                        },
                        menteePercentage: {
                            $cond: [{ $eq: ['$userId.role', "Mentee"] }, '$percentageCompleted', 0]
                        },
                    }
                },
                {
                    $group: {
                        _id: {
                            thinkificCourseId: '$thinkificCourseId',
                            userId: "$userId._id"
                        },
                        mentorUser: {
                            $addToSet: {
                                $cond: [{ $eq: ['$userId.role', "Mentor"] }, '$userId', null]
                            }
                        },
                        menteeUser: {
                            $addToSet: {
                                $cond: [{ $eq: ['$userId.role', "Mentee"] }, '$userId', null]
                            }
                        },
                        mentorPercentage: { $first: '$mentorPercentage' },
                        menteePercentage: { $first: '$menteePercentage' },
                        thinkificcourses: { $first: '$thinkificcourses' }
                    }
                },
                {
                    $sort: {
                        mentorPercentage: -1,
                        menteePercentage: -1
                    }
                },
                {
                    $group: {
                        _id: { thinkificCourseId: '$_id.thinkificCourseId' },
                        mentorUser: { $push: "$mentorUser" },
                        menteeUser: { $push: "$menteeUser" },
                        mentorPercentageF: { $first: '$mentorPercentage' },
                        menteePercentageF: { $first: '$menteePercentage' },
                        mentorPercentageL: { $last: '$mentorPercentage' },
                        menteePercentageL: { $last: '$menteePercentage' },
                        thinkificcourses: { $first: '$thinkificcourses' }
                    }
                },
                {
                    $unwind: {
                        path: '$mentorUser',
                        preserveNullAndEmptyArrays: true
                    }
                },
                {
                    $unwind: {
                        path: '$menteeUser',
                        preserveNullAndEmptyArrays: true
                    }
                },
                {
                    $match: {
                        mentorUser: { $ne: null },
                        menteeUser: { $ne: null }
                    }
                },
                {
                    $project: {
                        _id: "$_id.thinkificCourseId",
                        mentorId: { $arrayElemAt: ["$mentorUser", 0] },
                        menteeId: { $arrayElemAt: ["$menteeUser", 0] },
                        mentor_percentage: {
                            $cond: {
                                if: { $gt: ["$mentorPercentageF", "$mentorPercentageL"] },
                                then: "$mentorPercentageF",
                                else: "$mentorPercentageL"
                            }
                        },
                        mentee_percentage: {
                            $cond: {
                                if: { $gt: ["$menteePercentageF", "$menteePercentageL"] },
                                then: "$menteePercentageF",
                                else: "$menteePercentageL"
                            }
                        },
                        thinkificCourseId: '$thinkificcourses'
                    }
                },
                {
                    $addFields: {
                        'menteeId.name': { $concat: ['$menteeId.preferredFname', " ", "$menteeId.preferredLname"] },
                        'mentorId.name': { $concat: ['$mentorId.preferredFname', " ", "$mentorId.preferredLname"] }
                    }
                },
                {
                    $sort: {
                        _id: 1
                    }
                }
            ];

            let page = 1;
            let limit = 10
            if (req.body.limit) {
                limit = req.body.limit
            }

            if (req.body.page) {
                page = req.body.page
            }

            let projectData = await aggregate({ collection: "RecommendedCourses", pipeline: pipeLine });

            let pages = Math.ceil(projectData.length / limit);
            let total = projectData.length;
            projectData = projectData.slice((page - 1) * limit, page * limit)

            if (req.body.search) {
                projectData = projectData.filter((item: any) => {
                    if (item.thinkificCourseId && item.thinkificCourseId.courseName) {
                        return item.thinkificCourseId.courseName.toLowerCase().includes(req.body.search.toLowerCase());
                    }
                    return false;
                });
            }

            let result = {
                docs: projectData,
                page: page,
                pages,
                total,
                limit: limit
            }

            res.send(success(successMessage.FETCH_SUCCESS.replace(":attribute", "Project"), result))
        } catch (err: any) {
            res.status(statusCode.FORBIDDEN).send(error("Three is some issue in pair project v2", err.message, statusCode.FORBIDDEN))
        }
    },

    pairListV2: async (req: Request, res: Response) => {
        try {
            const request = req as requestUser;
            const payload = req.body;

            let query: any = {};
            let countQuery: any = {};

            const sixtyDaysAgo = new Date();
            sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);

            if (payload.type == "Potential Matches") {
                await updateMany({
                    collection: "PairInfo",
                    query: { isArchive: false, isConfirm: false, createdAt: { $lte: sixtyDaysAgo } },
                    update: { $set: { isArchive: true } },
                    options: { new: true }
                });
            }

            payload.page = payload.page ? payload.page - 1 : 0;
            payload.limit = payload.limit ?? 0;
            const skip = payload.page * payload.limit;

            let confirm = payload.type == "Potential Matches" ? false : true;
            if (payload.archive) {
                confirm = false
            }

            if (payload.archive) {
                query = { isConfirm: confirm }
            } else {
                query = { $or: [{ isConfirm: confirm }, { isConfirm: confirm, isArchive: payload.archive || false }] }
            }

            if (payload.partner.length) {
                query.partnerIdOrRegionId = { $in: payload.partner };
            } else if (request.user.partnerAdmin || request.user.region) {
                query.partnerIdOrRegionId = request.user.partnerAdmin ?? request.user.region;
            }

            if (payload.mentee) {
                query.$or = [
                    { 'menteeId.preferredFname': { $regex: payload.mentee, $options: 'i' } },
                    { 'menteeId.preferredLname': { $regex: payload.mentee, $options: 'i' } },
                    { 'mentorId.preferredFname': { $regex: payload.mentee, $options: 'i' } },
                    { 'mentorId.preferredLname': { $regex: payload.mentee, $options: 'i' } },
                ];
            }

            countQuery = { ...query };

            const pairList = find({
                collection: "PairInfo",
                query: query,
                project: ["-menteeAns", "-mentorAns"],
                skip: skip,
                limit: payload.limit,
                populate: [
                    { path: 'menteeId', select: '_id preferredFname preferredLname legalFname legalLname profilePic totalLogin' },
                    { path: 'mentorId', select: '_id preferredFname preferredLname legalFname legalLname profilePic totalLogin' },
                    { path: 'createdBy', select: '_id legalFname legalLname profilePic totalLogin' },
                ],
            });

            const pairListCount = countDocuments({
                collection: "PairInfo",
                query: countQuery
            });

            const response: any = await Promise.allSettled([pairList, pairListCount]);

            let pairListData = {
                page: payload.page + 1,
                limit: payload.limit,
                total: response[1]?.value,
                pages: Math.ceil(response[1]?.value / payload.limit),
                docs: response[0]?.value
            };

            res.send(success(successMessage.FETCH_SUCCESS.replace(":attribute", "pairList"), pairListData, statusCode.OK));
        } catch (err: any) {
            res
                .status(statusCode.FORBIDDEN)
                .send(error("There is some issue to get deleteQuestion.", err.message, statusCode.FORBIDDEN));
        }
    }
};

async function addMentor(rows: any, user: any) {
    try {

        let mentorObj = await findOne({
            collection: 'User',
            query: { email: rows.mentorEmail?.toLowerCase(), role: userRoleConstant.MENTOR, isDel: false }
        });
        let menteeObj = await findOne({
            collection: 'User',
            query: { email: rows.menteeEmail?.toLowerCase(), role: userRoleConstant.MENTEE, isDel: false }
        });


        if (mentorObj && menteeObj?.status !== userStatusConstant.Matched) {

            if (mentorObj?.status !== userStatusConstant.Matched) {
                let updateObj: any = {
                    status: userStatusConstant.Matching,
                    onboardingStep: 5,
                    preMatchStep: 4,
                    pairImported: true
                }

                mentorObj = await findOneAndUpdate({
                    collection: "User",
                    query: { _id: mentorObj?._id, isDel: false, status: { $ne: userStatusConstant.Matched } },
                    update: { $set: updateObj },
                    options: { new: true }
                });

                return mentorObj;
            } else {
                return mentorObj;
            }

        }

        if (mentorObj === null && menteeObj?.status !== userStatusConstant.Matched) {

            const dataObj: any = {
                role: userRoleConstant.MENTOR,
                legalFname: rows.mentorFname,
                legalLname: rows.mentorLname,
                preferredFname: rows.mentorFname,
                preferredLname: rows.mentorLname,
                email: rows.mentorEmail.toLowerCase(),
                primaryPhoneNo: formatePhoneNumber(rows.mentorPhoneNo),
                countryCode: "+1",
                onboardingStep: 4,
                preMatchStep: 4,
                status: userStatusConstant.Matching,
                pairImported: true
            }

            if (user?.partnerAdmin) {
                dataObj['partnerAdmin'] = user?.partnerAdmin;
            } else if (user?.region) {
                dataObj['region'] = user?.region
            }

            mentorObj = await insertOne({ collection: 'User', document: dataObj });

            return mentorObj;
        }

        if (mentorObj === null && menteeObj?.status !== userStatusConstant.Matched) {

            const dataObj: any = {
                role: userRoleConstant.MENTOR,
                legalFname: rows.mentorFname,
                legalLname: rows.mentorLname,
                preferredFname: rows.mentorFname,
                preferredLname: rows.mentorLname,
                email: rows.mentorEmail.toLowerCase(),
                primaryPhoneNo: formatePhoneNumber(rows.mentorPhoneNo),
                countryCode: "+1",
                onboardingStep: 4,
                preMatchStep: 4,
                status: userStatusConstant.Matching,
                pairImported: true
            }

            if (user?.partnerAdmin) {
                dataObj['partnerAdmin'] = user?.partnerAdmin;
            } else if (user?.region) {
                dataObj['region'] = user?.region
            }

            mentorObj = await insertOne({ collection: 'User', document: dataObj });

            return mentorObj;
        }


    } catch (error) {
        console.log("Add mentor common function", error);
    }
}

async function addMentee(rows: any, user: any) {
    try {

        let menteeObj: any = {};

        menteeObj = await findOne({
            collection: 'User',
            query: { email: rows.menteeEmail?.toLowerCase(), role: userRoleConstant.MENTEE, isDel: false }
        });

        if (menteeObj) {

            if (menteeObj?.status !== userStatusConstant.Matched) {
                let updateObj: any = {
                    status: userStatusConstant.Matching,
                    onboardingStep: 5,
                    preMatchStep: 3,
                    pairImported: true
                }

                menteeObj = await findOneAndUpdate({
                    collection: "User",
                    query: { _id: menteeObj?._id, isDel: false, status: { $ne: userStatusConstant.Matched } },
                    update: { $set: updateObj },
                    options: { new: true }
                });

                return menteeObj;
            } else {
                menteeObj = {
                    error: true,
                    message: "Mentee already matched."
                };
            }

            return menteeObj;
        }

        if (menteeObj === null) {

            const dataObj: any = {
                role: userRoleConstant.MENTEE,
                legalFname: rows.menteeFname,
                legalLname: rows.menteeLname,
                preferredFname: rows.menteeFname,
                preferredLname: rows.menteeLname,
                email: rows.menteeEmail.toLowerCase(),
                primaryPhoneNo: rows.menteePhoneNo ? formatePhoneNumber(rows.menteePhoneNo) : '',
                countryCode: "+1",
                onboardingStep: 4,
                preMatchStep: 4,
                status: userStatusConstant.Matching,
                pairImported: true
            }

            if (user?.partnerAdmin) {
                dataObj['partnerAdmin'] = user?.partnerAdmin;
            } else if (user?.region) {
                dataObj['region'] = user?.region
            }

            menteeObj = await insertOne({ collection: 'User', document: dataObj });

            return menteeObj;
        }

        if (menteeObj === null) {

            const dataObj: any = {
                role: userRoleConstant.MENTEE,
                legalFname: rows.menteeFname,
                legalLname: rows.menteeLname,
                preferredFname: rows.menteeFname,
                preferredLname: rows.menteeLname,
                email: rows.menteeEmail.toLowerCase(),
                primaryPhoneNo: rows.menteePhoneNo ? formatePhoneNumber(rows.menteePhoneNo) : '',
                countryCode: "+1",
                onboardingStep: 4,
                preMatchStep: 4,
                status: userStatusConstant.Matching,
                pairImported: true
            }

            if (user?.partnerAdmin) {
                dataObj['partnerAdmin'] = user?.partnerAdmin;
            } else if (user?.region) {
                dataObj['region'] = user?.region
            }

            menteeObj = await insertOne({ collection: 'User', document: dataObj });

            return menteeObj;
        }


    } catch (error) {
        console.log("Add mentee common function", error);
    }
}

async function answerByMentor(mentorId: any, menteeId: any, user: any, que: any) {
    try {
        console.log("==============================> answerByMentor <=================================", mentorId, menteeId);

        let answerObj = await findOne({
            collection: "AnswerByMentors",
            query: { user: mentorId, createdBy: user.partnerAdmin ?? user.region }
        });

        if (answerObj === null) {

            let queAns: Array<any> = []
            for (let q = 0; q < que.length; q++) {
                let question = que[q];

                if (question.question != questionConst.School_Question) {
                    queAns.push({
                        question: question._id,
                        answer: [{ ans: question.option[0].option, subAns: [] }]
                    })
                }
            }

            let answerByMentor = {
                queAns: queAns,
                user: mentorId,
                createdBy: user.partnerAdmin ?? user.region,
                status: userStatusConstant.ACTIVE,
            }

            answerObj = await insertOne({ collection: "AnswerByMentors", document: answerByMentor });
        }
        return answerObj;

    } catch (error) {
        console.log("Answer by mentor common function", error);
    }
}

async function answerByMentee(menteeId: any, mentorId: any, user: any, que: any) {
    try {
        console.log("==============================> answerByMentee <=================================", menteeId, mentorId);

        let answerObj = await findOne({
            collection: "AnswerByMentee",
            query: { user: menteeId, createdBy: user.partnerAdmin ?? user.region }
        });

        if (answerObj === null) {

            let queAns: Array<any> = []
            for (let q = 0; q < que.length; q++) {
                let question = que[q];
                if (question.question != questionConst.School_Question) {
                    queAns.push({
                        question: question._id,
                        answer: [{ ans: question.option[0].option, subAns: [] }]
                    })
                }
            }

            let answerByMentee = {
                queAns: queAns,
                user: menteeId,
                createdBy: user.partnerAdmin ?? user.region,
                status: userStatusConstant.ACTIVE,
            }

            answerObj = await insertOne({ collection: "AnswerByMentee", document: answerByMentee });
        }

        return answerObj;

    } catch (error) {
        console.log("Answer by mentee common function", error);
    }


}
