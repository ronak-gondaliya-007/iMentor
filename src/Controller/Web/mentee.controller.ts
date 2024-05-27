import { Request, Response } from "express";
import { aggregate, find, findOne, findOneAndUpdate, countDocuments, deleteOne } from "../../utils/db";
import { userRoleConstant, errorMessage, statusCode, successMessage, statusType, msg_Type, userStatusConstant, categoryOfQuestion } from "../../utils/const";
import { success, error } from "../../utils/helpers/resSender";
import { logger } from "../../utils/helpers/logger";
import { requestUser } from "../../Interfaces/schemaInterfaces/user";
import _ from "underscore"
import mongoose from "mongoose";
import { addToMatches } from "../../Bull/Queues/matches.queue";
import { v4 as uuidv4 } from 'uuid';

export let menteeController = {

    /* Mentee get pre match to do list detail function*/
    getPreMatchDetail: async (req: Request, res: Response) => {
        try {
            let request = req as requestUser;

            const userObj = await findOne(
                {
                    collection: 'User',
                    query: {
                        _id: request.user._id,
                        isDel: false,
                        onboardingStep: 5,
                        $or: [{ preMatchStep: { $exists: false } }, { preMatchStep: { $lte: 4 } }]
                    },
                    project: { email: 1, legalFname: 1, legalLname: 1, status: 1, onboardingStep: 1, preMatchStep: 1, calendarOfEvents: 1, parentalConsent: 1, partnerAdmin: 1, region: 1, thinkificUserId: 1 },
                    populate: [
                        { path: "calendarOfEvents", select: "_id start_date end_date event_type" }
                    ]
                });

            console.log(userObj);

            if (!userObj?.calendarOfEvents) {
                userObj.calendarOfEvents = {}
            }

            res.status(statusCode.OK).send(success(successMessage.READ_SUCCESS.replace(':attribute', "Pre-Match List"), { userObj }, statusCode.OK))

        } catch (err: any) {
            logger.error(`There was an issue into get preMatch detail.: ${err}`)
            res.status(statusCode.FORBIDDEN).send(error("There was an issue into get preMatch detail.", { err }, statusCode.FORBIDDEN))
        }
    },

    /* Mentee pre match to do list function */
    menteePreMatchToDoList: async (req: Request, res: Response) => {
        try {
            let request = req as requestUser;

            const { step, isDraft, reschedule, schedule_id, isAgree } = req.body;

            const userObj = await findOne({ collection: 'User', query: { _id: request.user._id, onboardingStep: 5, role: userRoleConstant.MENTEE, isDel: false, status: { $in: [statusType.COMPLETED, statusType.DRAFT] } } });

            if (!userObj) {
                res.status(statusCode.OK).send(error(errorMessage.NOT_EXISTS.replace(":attribute", "User"), {}, statusCode.BAD_REQUEST));
                return
            }

            if (step == 2) {

                const calendarOfEventsQuery: any = {
                    calendarOfEvents: schedule_id
                };

                if (!reschedule) {
                    if (isDraft === true) {
                        calendarOfEventsQuery.status = statusType.DRAFT;
                        calendarOfEventsQuery.preMatchStep = 1;
                    } else {
                        calendarOfEventsQuery.status = statusType.COMPLETED;
                        calendarOfEventsQuery.preMatchStep = 2;
                    }
                }

                const mentee = await findOneAndUpdate({
                    collection: 'User',
                    query: {
                        _id: request.user._id,
                        status: statusType.COMPLETED,
                        isDel: false,
                        role: userRoleConstant.MENTEE,
                        onboardingStep: 5,
                        preMatchStep: 1
                    },
                    update: {
                        $set: calendarOfEventsQuery
                    },
                    options: { new: true }
                });

                res.status(statusCode.OK).send(success(successMessage.UPDATE_SUCCESS.replace(':attribute', "Mentee"), { mentee }, statusCode.OK))
            }

            if (step == 3) {

                const completeOnboardingQuery: any = {
                    parentalConsent: isAgree
                };

                // if (!reschedule) {
                if (isDraft === true) {
                    completeOnboardingQuery.status = statusType.DRAFT;
                    completeOnboardingQuery.preMatchStep = 1;
                } else {
                    completeOnboardingQuery.status = statusType.COMPLETED;
                    completeOnboardingQuery.preMatchStep = 3;
                }
                // }

                const mentee = await findOneAndUpdate({
                    collection: 'User',
                    query: {
                        _id: request.user._id,
                        status: { $in: [statusType.COMPLETED, statusType.DRAFT] },
                        isDel: false,
                        role: userRoleConstant.MENTEE,
                        onboardingStep: 5,
                        preMatchStep: { $in: [1, 2] }
                    },
                    update: {
                        $set: completeOnboardingQuery
                    },
                    options: { new: true }
                });

                // if (isDraft === false) {
                //     userObj.status = statusType.MATCHING;
                //     // await addToMatches({ menteeId: userObj._id, jobId: uuidv4() });

                //     // await deleteOne({ collection: "Messages", query: { receiverId: request.user._id, msg_type: msg_Type.ANNOUNCEMENT } });
                // }


                res.status(statusCode.OK).send(success(successMessage.UPDATE_SUCCESS.replace(':attribute', "Mentee"), { mentee }, statusCode.OK))
            }

            if (step == 4) {
                const completeOnboardingQuery: any = {};
                if (isDraft === true) {
                    completeOnboardingQuery.status = statusType.DRAFT;
                    completeOnboardingQuery.preMatchStep = 1;
                } else {
                    completeOnboardingQuery.status = statusType.MATCHING;
                    completeOnboardingQuery.preMatchStep = 4;
                }
                // }

                const mentee = await findOneAndUpdate({
                    collection: 'User',
                    query: {
                        _id: request.user._id,
                        status: { $in: [statusType.COMPLETED, statusType.DRAFT] },
                        isDel: false,
                        role: userRoleConstant.MENTEE,
                        onboardingStep: 5,
                        preMatchStep: { $in: [1, 2, 3] }
                    },
                    update: {
                        $set: completeOnboardingQuery
                    },
                    options: { new: true }
                });

                if (isDraft === false) {
                    userObj.status = statusType.MATCHING;
                    await addToMatches({ menteeId: userObj._id?.toString(), jobId: uuidv4() });

                    await deleteOne({ collection: "Messages", query: { receiverId: request.user._id, msg_type: msg_Type.PRE_MATCH_ANNOUNCEMENT } });
                }
                res.status(statusCode.OK).send(success(successMessage.UPDATE_SUCCESS.replace(':attribute', "Mentee"), { mentee }, statusCode.OK))
            }

        } catch (err: any) {
            logger.error(`There was an issue into mentee pre-match to do list.: ${err}`)
            res.status(statusCode.FORBIDDEN).send(error("There was an issue into mentee pre-match to do list.", { err }, statusCode.FORBIDDEN))
        }
    },

    /* Mentee get their mentor function */
    getMentorList: async (req: Request, res: Response) => {
        try {
            let request = req as requestUser;
            let { search, sort, order, page, limit } = req.body;

            page = page || 1;
            limit = limit || 10;

            const mentorArray = await find({
                collection: "PairInfo",
                query: { menteeId: request.user._id, isDel: false, isConfirm: true, isArchive: false },
                project: { mentorId: 1 }
            });

            const mentor: any = [];
            mentorArray.map((ele: any) => {
                mentor.push(ele.mentorId);
            });

            const query: any = [];
            const countQuery: any = {};

            if (!countQuery["$and"]) {
                countQuery["$and"] = []
            }

            query.push(
                {
                    $match: {
                        _id: { $in: mentor },
                        isDel: false,
                        isDisabled: false
                    }
                }
            );

            countQuery["$and"].push({ _id: { $in: mentor }, isDel: false, isDisabled: false });

            if (search) {
                query.push(
                    {
                        $addFields: {
                            user_name: {
                                '$concat': ['$preferredFname', ' ', '$preferredLname']
                            },
                            reverseUsername: {
                                '$concat': ['$preferredLname', ' ', '$preferredFname']
                            },
                            withoutBlankName: {
                                '$concat': ['$preferredFname', '$preferredLname']
                            },
                            reverseWithoutBlankName: {
                                '$concat': ['$preferredLname', '$preferredFname']
                            },
                            legalFname: "$preferredFname",
                            legalLname: "$preferredLname",
                        }
                    },
                    {
                        $match: {
                            $or: [
                                { user_name: { $regex: '.*' + search + '.*', $options: 'i' } },
                                { reverseUsername: { $regex: '.*' + search + '.*', $options: 'i' } },
                                { withoutBlankName: { $regex: '.*' + search + '.*', $options: 'i' } },
                                { reverseWithoutBlankName: { $regex: '.*' + search + '.*', $options: 'i' } },
                                { legalFname: { $regex: '.*' + search + '.*', $options: 'i' } },
                                { legalLname: { $regex: '.*' + search + '.*', $options: 'i' } }
                            ]
                        }
                    }
                );

                countQuery["$and"].push({
                    $or: [
                        { user_name: { $regex: '.*' + search + '.*', $options: 'i' } },
                        { reverseUsername: { $regex: '.*' + search + '.*', $options: 'i' } },
                        { withoutBlankName: { $regex: '.*' + search + '.*', $options: 'i' } },
                        { reverseWithoutBlankName: { $regex: '.*' + search + '.*', $options: 'i' } },
                        { legalFname: { $regex: '.*' + search + '.*', $options: 'i' } },
                        { legalLname: { $regex: '.*' + search + '.*', $options: 'i' } }
                    ]
                })
            }

            if (!sort) {

                query.push(
                    { $skip: (page - 1) * limit },
                    { $limit: limit }
                );

            }

            if (sort == "mentee") {

                if (order == "desc") {
                    query.push(
                        {
                            $sort: {
                                legalFname: -1
                            }
                        }
                    )
                }

                if (order == "asc") {
                    query.push(
                        {
                            $sort: {
                                legalFname: 1
                            }
                        }
                    )
                }

                query.push(
                    { $skip: (page - 1) * limit },
                    { $limit: limit }
                );

            }

            query.push(
                {
                    $addFields: {
                        regStatus: {
                            $cond: {
                                if: {
                                    $and: [
                                        { $eq: ['$pairImported', true] },
                                        { $eq: [{ $ifNull: ['$password', ''] }, ""] }
                                    ]
                                },
                                then: '$status',
                                else: '$status'
                            }
                        }
                    }
                },
                {
                    $lookup: {
                        from: "achievedbadges",
                        let: { uId: "$_id" },
                        pipeline: [
                            {
                                $match: {
                                    $expr: {
                                        $or: [
                                            {
                                                $and: [
                                                    { $eq: ["$receiverId", "$$uId"] },
                                                    { $eq: ["$senderId", null] }
                                                ]
                                            }
                                        ]
                                    }
                                }
                            },
                            {
                                $project: { badgeName: 1, type: 1 }
                            }
                        ],
                        as: "badge"
                    }
                },
                {
                    $lookup: {
                        from: "pairinfos",
                        let: { mentor_id: "$_id" },
                        pipeline: [
                            {
                                $match: {
                                    $expr: {
                                        $and: [
                                            { $eq: ["$$mentor_id", "$mentorId"] },
                                            { $eq: [new mongoose.Types.ObjectId(request.user._id), "$menteeId"] }
                                        ]
                                    }
                                }
                            }
                        ],
                        as: "mentorData"
                    }
                },
                {
                    $unwind: "$mentorData"
                },
                {
                    $project: {
                        legalFname: "$preferredFname", legalLname: "$preferredLname", profilePic: 1, profilePicKey: 1, role: 1, address: 1, location: "$mentorData.location", joinDate: "$mentorData.createdAt",
                        badge: 1, regStatus: 1, userActivationDate: 1
                    }
                }
            );

            if (sort == "location") {

                if (order == "desc") {
                    query.push(
                        {
                            $sort: {
                                location: -1
                            }
                        }
                    )
                }

                if (order == "asc") {
                    query.push(
                        {
                            $sort: {
                                location: 1
                            }
                        }
                    )
                }

                query.push(
                    { $skip: (page - 1) * limit },
                    { $limit: limit }
                );

            }

            if (sort == "school") {

                if (order == "desc") {
                    query.push(
                        {
                            $sort: {
                                school: -1
                            }
                        }
                    )
                }

                if (order == "asc") {
                    query.push(
                        {
                            $sort: {
                                school: 1
                            }
                        }
                    )
                }

                query.push(
                    { $skip: (page - 1) * limit },
                    { $limit: limit }
                );

            }

            const totalDocs = await countDocuments({
                collection: "User",
                query: countQuery
            });

            const MentorList = await aggregate({
                collection: "User",
                pipeline: query
            });

            const pages = Math.ceil(totalDocs / limit);

            const response = {
                docs: MentorList,
                limit: limit,
                page: page,
                pages: pages,
                total: totalDocs
            };

            res.status(statusCode.OK).send(success(successMessage.FETCH_SUCCESS.replace(":attribute", "Mentor list"), response, statusCode.OK));

        } catch (err: any) {
            logger.error(`There was an issue into get mentor list.: ${err}`)
            res.status(statusCode.FORBIDDEN).send(error("There was an issue into get mentor list.", { err }, statusCode.FORBIDDEN))
        }
    },

    /* Mentee get mentor detail page function */
    getMentorUserDetail: async (req: Request, res: Response) => {
        try {
            let { userId } = req.body;

            let mentorObj = await findOne({ collection: 'User', query: { _id: userId, isDel: false } });

            if (!mentorObj) {
                res.status(statusCode.OK).send(error(errorMessage.NOT_EXISTS.replace(":attribute", "Mentor"), {}, statusCode.NOT_FOUND));
                return
            }

            // mentorObj.pronounciationName = mentorObj.pronounciationName ? mentorObj.pronounciationName : "--";

            let additionalInfo = await findOne({ collection: 'AdditionalInfo', query: { userId: mentorObj._id } });

            let matchingQuestions = await findOne({ collection: 'AnswerByMentors', query: { user: mentorObj._id }, populate: [{ path: 'queAns.question', select: "_id question alternateQuestion isAlternateQuestion category" }] });

            const categorySequence = [categoryOfQuestion.PERSONALITY_AND_INTERESTS, categoryOfQuestion.CREEAR_AND_EXPERIENCE, categoryOfQuestion.EDUCATION_INFORMATION];

            res.status(statusCode.OK).send(success(successMessage.FETCH_SUCCESS.replace(":attribute", "Mentor"), { mentorObj, additionalInfo, matchingQuestions, categorySequence }, statusCode.OK))

        } catch (err: any) {
            logger.error(`There was an issue into get mentor user.: ${err}`)
            res.status(statusCode.FORBIDDEN).send(error("There was an issue into get mentor user.", err.message, statusCode.FORBIDDEN))
        }
    },

};
