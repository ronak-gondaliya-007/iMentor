import { Request, Response } from "express";
import { aggregate, find, findOne, findOneAndUpdate, updateOne, countDocuments, insertOne, deleteOne } from "../../utils/db";
import { userRoleConstant, errorMessage, statusCode, questionState, successMessage, statusType, event_status, msg_Type, course_type, userStatusConstant, categoryOfQuestion, eventTypeConstant } from "../../utils/const";
import { success, error } from "../../utils/helpers/resSender";
import { logger } from "../../utils/helpers/logger";
import { requestUser } from "../../Interfaces/schemaInterfaces/user";
import config from "../../utils/config";
import _ from "underscore"
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import axios from "axios";
import { createOrGetUser } from "../../services/thinkific/thinkific.service";
import { addToMatches } from "../../Bull/Queues/matches.queue";
import { v4 as uuidv4 } from 'uuid';

export let mentorController = {

    /* Mentor get pre match to do list detail function*/
    getPreMatchDetail: async (req: Request, res: Response) => {
        try {
            let request = req as requestUser;

            var userObj = findOne(
                {
                    collection: 'User',
                    query: {
                        _id: request.user._id,
                        isDel: false,
                        onboardingStep: 5,
                        $or: [{ preMatchStep: { $exists: false } }, { preMatchStep: { $lte: 4 } }]
                    },
                    project: { email: 1, legalFname: 1, legalLname: 1, status: 1, onboardingStep: 1, preMatchStep: 1, scheduleOrientation: 1, completeScreening: 1, partnerAdmin: 1, region: 1, thinkificUserId: 1, role: 1, preferredFname: 1, preferredLname: 1 },
                    populate: [
                        { path: "scheduleOrientation", select: "_id userId start_date end_date event_type event_name", populate: { path: "userId", select: "_id legalFname legalLname role" } },
                        { path: "completeScreening", select: "_id userId start_date end_date event_type event_name", populate: { path: "userId", select: "_id legalFname legalLname role" } },
                        { path: "partnerAdmin" }, { path: "region" }
                    ]
                });

            // Check login user already enroll or not in default course
            let recommendedCourse = findOne({
                collection: "RecommendedCourses",
                query: { userId: request.user._id, isDefaultCourse: true },
                populate: [{ path: "thinkificCourseId" }]
            });

            const mainResponse: any = await Promise.allSettled([userObj, recommendedCourse]);

            let adminId: any = {};
            if (mainResponse[0].value?.partnerAdmin) {
                adminId = { partnerId: mainResponse[0].value?.partnerAdmin?._id };
            } else if (mainResponse[0].value?.region) {
                adminId = { regionId: mainResponse[0].value?.region?._id };
            }

            let orientationTimeSlotList = find({
                collection: "Event",
                query: {
                    $and: [
                        {
                            ...adminId,
                            event_type: eventTypeConstant.ORIENTATION,
                            start_date: { $gte: new Date(Date.now()) },
                            approval: event_status.APPROVED,
                            isDel: false
                        }
                    ]
                }
            });

            let screeningTimeSlotList = find({
                collection: "Event",
                query: {
                    $and: [
                        {
                            ...adminId,
                            event_type: eventTypeConstant.SCREENING,
                            start_date: { $gte: new Date(Date.now()) },
                            approval: event_status.APPROVED,
                            isDel: false,
                            isScheduled: false
                        }
                    ]
                }
            });

            const response: any = await Promise.allSettled([orientationTimeSlotList, screeningTimeSlotList]);

            mainResponse[0].value.isOrientation = !response[0].value?.length && !mainResponse[0].value?.scheduleOrientation || mainResponse[0].value?.completeScreening && mainResponse[0].value?.preMatchStep === 3 && !mainResponse[0].value?.scheduleOrientation || mainResponse[1].value?.percentageCompleted == 100 && !mainResponse[0].value?.scheduleOrientation || mainResponse[0].value?.preMatchStep === 4 && !mainResponse[0].value?.scheduleOrientation ? false : true;
            mainResponse[0].value.isScreening = !response[1].value?.length && !mainResponse[0].value?.completeScreening || mainResponse[1].value?.percentageCompleted == 100 && !mainResponse[0].value?.completeScreening || mainResponse[0].value?.preMatchStep === 4 && !mainResponse[0].value?.completeScreening ? false : true;
            mainResponse[0].value.isAssignCourse = mainResponse[1].value || mainResponse[1].value && mainResponse[0].value?.preMatchStep !== 4 ? true : false;

            if (!mainResponse[0].value.isOrientation && !mainResponse[0].value.isScreening) {
                mainResponse[0].value.preMatchStep = mainResponse[0].value?.preMatchStep === 1 ? 3 : mainResponse[0].value?.preMatchStep;
            } else if (!mainResponse[0].value.isOrientation) {
                mainResponse[0].value.preMatchStep = mainResponse[0].value?.preMatchStep === 1 ? 2 : mainResponse[0].value?.preMatchStep;
            } else if (!mainResponse[0].value.isScreening) {
                mainResponse[0].value.preMatchStep = mainResponse[0].value?.preMatchStep === 2 ? 3 : mainResponse[0].value?.preMatchStep;
            }

            if (!mainResponse[0].value.scheduleOrientation) {
                mainResponse[0].value.scheduleOrientation = {}
            }
            if (!mainResponse[0].value.completeScreening) {
                mainResponse[0].value.completeScreening = {}
            }

            if (mainResponse[0].value.preMatchStep == 3 && mainResponse[1].value) {

                if (mainResponse[0].value.thinkificUserId == undefined) {

                    // Create new user in thinkific third party api and tht user id set in user collection
                    const userDetail: any = {
                        email: mainResponse[0].value.email,
                        firstName: mainResponse[0].value.preferredFname,
                        lastName: mainResponse[0].value.preferredLname
                    };

                    const thiknificUser = await createOrGetUser(userDetail);

                    await findOneAndUpdate({
                        collection: "User",
                        query: { _id: request.user._id, role: request.user.role },
                        update: { $set: { thinkificUserId: thiknificUser.id } },
                        options: { new: true }
                    });

                }

                if (mainResponse[1].value && mainResponse[1].value?.percentageCompleted == 100) {
                    console.log("Going To Add To Matches Mentor In First Condition");
                    addForPotentialMatches(request, mainResponse[0].value._id);

                    mainResponse[0].value.preMatchStep = 4;
                    mainResponse[0].value.status = statusType.COMPLETED;

                }
            }

            if (!mainResponse[1].value && mainResponse[0].value?.preMatchStep == 3) {
                console.log("Going To Add To Matches Mentor In Second Condition");
                addForPotentialMatches(request, mainResponse[0].value._id);

                mainResponse[0].value.preMatchStep = 4;
                mainResponse[0].value.status = statusType.COMPLETED;
            }

            res.status(statusCode.OK).send(success(successMessage.READ_SUCCESS.replace(':attribute', "Pre-Match List"), { userObj: mainResponse[0].value }, statusCode.OK))
            return

        } catch (err: any) {
            logger.error(`There was an issue into get preMatch detail.: ${err}`)
            res.status(statusCode.FORBIDDEN).send(error("There was an issue into get preMatch detail.", { err }, statusCode.FORBIDDEN))
        }
    },

    /* Mentor pre-match to do list complete function */
    mentorPreMatchToDoList: async (req: Request, res: Response) => {
        try {
            let request = req as requestUser;

            const { step, isDraft, reschedule, schedule_id } = req.body;

            const userObj = await findOne({ collection: 'User', query: { _id: request.user._id, role: userRoleConstant.MENTOR, isDel: false, status: { $in: [statusType.COMPLETED, statusType.DRAFT] } } });

            if (!userObj) {
                res.status(statusCode.OK).send(error(errorMessage.NOT_EXISTS.replace(":attribute", "User"), {}, statusCode.BAD_REQUEST));
                return
            }

            if (step == 2) {

                const scheduleOrientationQuery: any = {
                    scheduleOrientation: schedule_id
                };

                const verifyOrientation = await findOne({ collection: "Event", query: { _id: schedule_id, isDel: false, event_type: eventTypeConstant.ORIENTATION } });

                if (!verifyOrientation && !userObj?.scheduleOrientation) {
                    res.status(statusCode.OK).send(error(successMessage.NOT_FOUND.replace(':attribute', "Orientation Event"), {}, statusCode.NOT_FOUND))
                    return
                }

                if (!reschedule) {
                    if (isDraft === true) {
                        scheduleOrientationQuery.status = statusType.DRAFT;
                        scheduleOrientationQuery.preMatchStep = 1;
                    } else {
                        scheduleOrientationQuery.status = statusType.COMPLETED;
                        scheduleOrientationQuery.preMatchStep = 2;
                    }
                } else {
                    await findOneAndUpdate({
                        collection: 'Event',
                        query: { _id: userObj.scheduleOrientation },
                        update: { $set: { isScheduled: false } },
                        options: { new: true }
                    });
                }

                const mentor = await findOneAndUpdate({
                    collection: 'User',
                    query: {
                        _id: request.user._id,
                        isDel: false,
                        role: userRoleConstant.MENTOR,
                        onboardingStep: 5,
                        preMatchStep: { $lt: 4 }
                    },
                    update: {
                        $set: scheduleOrientationQuery
                    },
                    options: { new: true }
                });

                await findOneAndUpdate({
                    collection: 'Event',
                    query: { _id: schedule_id },
                    update: { $set: { isScheduled: true } },
                    options: { new: true }
                });

                res.status(statusCode.OK).send(success(successMessage.UPDATE_SUCCESS.replace(':attribute', "Mentor"), { mentor }, statusCode.OK))
            }

            if (step == 3) {

                const completeScreeningQuery: any = {
                    completeScreening: schedule_id
                };

                const verifyScreening = await findOne({ collection: "Event", query: { _id: schedule_id, isDel: false, isScheduled: false, event_type: eventTypeConstant.SCREENING } });

                if (!verifyScreening && !userObj?.completeScreening) {
                    res.status(statusCode.OK).send(error(successMessage.NOT_FOUND.replace(':attribute', "Screening Event"), {}, statusCode.NOT_FOUND))
                    return
                }

                if (!reschedule) {
                    if (isDraft === true) {
                        completeScreeningQuery.status = statusType.DRAFT;
                        completeScreeningQuery.preMatchStep = 2;
                    } else {
                        completeScreeningQuery.status = statusType.COMPLETED;
                        completeScreeningQuery.preMatchStep = 3;
                    }
                } else {
                    await findOneAndUpdate({
                        collection: 'Event',
                        query: { _id: userObj.completeScreening },
                        update: { $set: { isScheduled: false } },
                        options: { new: true }
                    });
                }

                const mentor = await findOneAndUpdate({
                    collection: 'User',
                    query: {
                        _id: request.user._id,
                        isDel: false,
                        role: userRoleConstant.MENTOR,
                        onboardingStep: 5,
                        preMatchStep: { $lt: 4 }
                    },
                    update: {
                        $set: completeScreeningQuery
                    },
                    options: { new: true }
                });

                await findOneAndUpdate({
                    collection: 'Event',
                    query: { _id: schedule_id },
                    update: { $set: { isScheduled: true } },
                    options: { new: true }
                });

                res.status(statusCode.OK).send(success(successMessage.UPDATE_SUCCESS.replace(':attribute', "Mentor"), { mentor }, statusCode.OK))
            }
            if (step == 5) {
                const completeScreeningQuery: any = {};
                if (isDraft === true) {
                    completeScreeningQuery.status = statusType.DRAFT;
                    completeScreeningQuery.preMatchStep = userObj.preMatchStep ? userObj.preMatchStep : step;
                } else {
                    completeScreeningQuery.status = statusType.MATCHING;
                    completeScreeningQuery.preMatchStep = 5;
                }

                const mentor = await findOneAndUpdate({
                    collection: 'User',
                    query: {
                        _id: request.user._id,
                        isDel: false,
                        role: userRoleConstant.MENTOR,
                        onboardingStep: 5,
                        preMatchStep: { $lte: 4 }
                    },
                    update: {
                        $set: completeScreeningQuery
                    },
                    options: { new: true }
                });

                await deleteOne({
                    collection: "Messages",
                    query: { receiverId: request.user._id?.toString(), msg_type: msg_Type.PRE_MATCH_ANNOUNCEMENT }
                });

                await addToMatches({ mentorId: request.user._id?.toString(), jobId: uuidv4() });
                res.status(statusCode.OK).send(success(successMessage.UPDATE_SUCCESS.replace(':attribute', "Mentor"), { mentor }, statusCode.OK))
            }

        } catch (err: any) {
            logger.error(`There was an issue into mentor pre-match to do list.: ${err}`)
            res.status(statusCode.FORBIDDEN).send(error("There was an issue into mentor pre-match to do list.", { err }, statusCode.FORBIDDEN))
        }
    },

    /* Mentor training project url send function */
    getMentorTraining: async (req: Request, res: Response) => {
        try {
            let request = req as requestUser;

            const mentorObj = await findOne({
                collection: "User",
                query: { _id: request.user._id, isDel: false, role: userRoleConstant.MENTOR, onboardingStep: 5, status: { $in: [statusType.COMPLETED, statusType.DRAFT] } }
            });

            if (!mentorObj) {
                res.status(statusCode.OK).send(success(errorMessage.NOT_EXISTS.replace(":attribute", "Mentor"), {}, statusCode.NOT_FOUND));
                return
            }

            const getCourse = await findOne({
                collection: "RecommendedCourses",
                query: { userId: request.user._id, isDefaultCourse: true },
                populate: [
                    {
                        path: 'thinkificCourseId',
                        select: 'courseId'
                    }
                ]
            });

            if (!getCourse) {
                res.status(statusCode.OK).send(success(errorMessage.NOT_EXISTS.replace(":attribute", "Assign course"), {}, statusCode.NOT_FOUND));
                return
            }

            // Get course detail using third party api call
            let courseUrl = config.THINKIFIC.API_BASE_URL + "/courses/" + getCourse?.thinkificCourseId?.courseId;

            axios({
                method: 'get',
                url: courseUrl,
                headers: { 'X-Auth-Subdomain': config.THINKIFIC.SUBDOMAIN, 'X-Auth-API-Key': config.THINKIFIC.KEY }
            }).then(function (response: any) {
                // handle success

                const token = jwt.sign({
                    email: mentorObj.email,
                    first_name: mentorObj.preferredFname,
                    last_name: mentorObj.preferredLname,
                    iat: Math.floor(Date.now() / 1000) - 30,
                    locale: "en-US"
                }, config.THINKIFIC.KEY);

                const courseURL = config.THINKIFIC.COURSE_URL + response.data.slug;

                const redirectURL = config.THINKIFIC.BASE_URL + token + '&return_to=' + courseURL + '&error_url=' + config.THINKIFIC.SSO_ERROR;

                return res.status(statusCode.OK).send(success(successMessage.FETCH_SUCCESS.replace(':attribute', "Mentor"), { redirectURL }, statusCode.OK));

            })
                .catch(function (error: any) {
                    // handle error
                    res.status(statusCode.OK).send(error("There was an issue into get mentor training.", error.message, statusCode.FORBIDDEN))
                })

        } catch (err: any) {
            logger.error(`There was an issue into get mentor training.: ${err}`)
            res.status(statusCode.FORBIDDEN).send(error("There was an issue into get mentor training.", { err }, statusCode.FORBIDDEN))
        }
    },

    /* Pre match event list date wise function */
    getPreMatchEventList: async (req: Request, res: Response) => {
        try {
            const request = req as requestUser;
            const { type } = req.body;

            const userObj = await findOne({
                collection: "User",
                query: { _id: request.user._id }
            });

            if (!userObj) {
                res.status(statusCode.OK).send(error("User not exists!", {}, statusCode.NOT_FOUND));
                return;
            }

            let query: any = [];
            if (userObj.partnerAdmin) {
                query = {
                    $and: [
                        {
                            partnerId: userObj.partnerAdmin,
                            event_type: type,
                            start_date: { $gte: new Date(Date.now()) },
                            approval: event_status.APPROVED,
                            isDel: false
                        },
                        type !== eventTypeConstant.ORIENTATION ? { isScheduled: false } : {}
                    ]
                }
            } else if (userObj.region) {
                query = {
                    $and: [
                        {
                            regionId: userObj.region,
                            event_type: type,
                            start_date: { $gte: new Date(Date.now()) },
                            approval: event_status.APPROVED,
                            isDel: false
                        },
                        type !== eventTypeConstant.ORIENTATION ? { isScheduled: false } : {}
                    ]
                }
            }

            let timeSlotList = await find({
                collection: "Event",
                query,
                project: { _id: 1, start_date: 1, event_type: 1, event_name: 1, isScheduled: 1, approval: 1 }
            });

            if (!timeSlotList) {
                res.status(statusCode.OK).send(success(successMessage.NOT_FOUND.replace(":attribute", "Time Slot List"), {}, statusCode.NOT_FOUND));
                return
            }

            res.status(statusCode.OK).send(success(successMessage.FETCH_SUCCESS.replace(":attribute", "TimeSlot"), timeSlotList, statusCode.OK));

        } catch (err: any) {
            logger.error(`There was an issue into get pre match event list.: ${err}`)
            res.status(statusCode.FORBIDDEN).send(error("There was an issue into get pre match event list.", { err }, statusCode.FORBIDDEN))
        }
    },

    /* Mentor get time slot for preMatch to do list function */
    getTimeSlot: async (req: Request, res: Response) => {
        try {
            const request = req as requestUser;

            let { startDate, endDate, type } = req.body;

            const userObj = await findOne({
                collection: "User",
                query: { _id: request.user._id }
            });

            let schedule_id = type === eventTypeConstant.ORIENTATION ? userObj.scheduleOrientation : userObj.completeScreening

            if (!userObj) {
                res.status(statusCode.OK).send(error("User not exists!", {}, statusCode.NOT_FOUND));
                return;
            }

            let query: any = [];
            if (userObj.partnerAdmin) {
                query.push(
                    {
                        $match: {
                            $and: [
                                {
                                    partnerId: userObj.partnerAdmin,
                                    event_type: type,
                                    start_date: { $gte: new Date(startDate), $lt: new Date(endDate) },
                                    approval: event_status.APPROVED,
                                    isDel: false
                                },
                                (type === eventTypeConstant.SCREENING ? {
                                    $or: [
                                        {
                                            $and: [
                                                { isScheduled: true },
                                                { _id: schedule_id }
                                            ]
                                        },
                                        { isScheduled: false }
                                    ]
                                }
                                    : {})
                            ]
                        },
                    }
                )
            } else if (userObj.region) {
                query.push(
                    {
                        $match: {
                            $and: [
                                {
                                    regionId: userObj.region,
                                    event_type: type,
                                    start_date: { $gte: new Date(startDate), $lt: new Date(endDate) },
                                    approval: event_status.APPROVED,
                                    isDel: false
                                },
                                (type === eventTypeConstant.SCREENING ? {
                                    $or: [
                                        {
                                            $and: [
                                                { isScheduled: true },
                                                { _id: schedule_id }
                                            ]
                                        },
                                        { isScheduled: false }
                                    ]
                                }
                                    : {})
                            ]
                        }
                    }
                )
            }

            query.push(
                { $project: { userId: 1, start_date: 1, end_date: 1, event_type: 1, isScheduled: 1 } },
                {
                    $lookup: {
                        from: "users",
                        let: { uId: "$userId" },
                        pipeline: [
                            {
                                $match: {
                                    $expr: {
                                        $eq: ["$$uId", "$_id"]
                                    }
                                }
                            },
                            {
                                $project: {
                                    _id: 1, legalFname: 1, legalLname: 1, role: 1,
                                }
                            }
                        ],
                        as: "userId"
                    }
                },
                {
                    $unwind: "$userId"
                }
            );

            let timeSlotList = aggregate({
                collection: "Event",
                pipeline: query
            });

            let adminId: any = {};
            if (userObj?.partnerAdmin) {
                adminId = { partnerId: userObj?.partnerAdmin };
            } else if (userObj?.region) {
                adminId = { regionId: userObj?.region };
            }
            let preMatchEvent = find({
                collection: "Event",
                query: {
                    $and: [
                        {
                            ...adminId,
                            event_type: type,
                            start_date: { $gte: new Date(Date.now()) },
                            approval: event_status.APPROVED,
                            isDel: false
                        },
                        type !== eventTypeConstant.ORIENTATION ? { isScheduled: false } : {}
                    ]
                }
            });

            const response: any = await Promise.allSettled([timeSlotList, preMatchEvent]);

            if (!response[1].value?.length) {
                res.status(statusCode.OK).send(error(`No future ${type} events are available!`, { isAvailable: false }, statusCode.NOT_FOUND));
                return;
            }

            res.status(statusCode.OK).send(success(successMessage.FETCH_SUCCESS.replace(":attribute", "TimeSlot"), response[0].value, statusCode.OK));

        } catch (err: any) {
            logger.error(`There was an issue into get time slot.: ${err}`)
            res.status(statusCode.FORBIDDEN).send(error("There was an issue into get time slot.", { err }, statusCode.FORBIDDEN))
        }
    },

    /* Mentor questions list function */
    questionList: async function (req: any, res: any) {
        try {
            let request = req as requestUser

            let query: any = {}
            if (request.user.region) {
                query['regionId'] = request.user.region
            } else if (request.user.partnerAdmin) {
                query['partnerId'] = request.user.partnerAdmin
            } else {
                res.status(statusCode.OK).send(error(errorMessage.ACTION.replace(":attribute", request.user.role), {}, statusCode.UNAUTHORIZED));
                return
            }

            if (request.user.role === userRoleConstant.MENTEE) {
                query['question'] = { $nin: ["At what schools (colleges and graduate schools) did you study?", "What was the highest level of education that you completed (mentors must have a 2-year or 4-year college degree, at minimum)?"] }
            }

            const getPersonalityQue = find({
                collection: 'Matches',
                query: { category: categoryOfQuestion.PERSONALITY_AND_INTERESTS, status: questionState.ACTIVE, ...query },
                project: {
                    _id: 1, category: 1, queType: 1, status: 1, weight: 1, orderNum: 1, option: 1, isDel: 1, createdBy: 1, partnerId: 1, answer: 1, createdAt: 1, updatedAt: 1,
                    question: { $cond: { if: { $and: [{ $eq: ["$isAlternateQuestion", true] }, { $eq: [request.user.role, userRoleConstant.MENTOR] }] }, then: "$alternateQuestion", else: "$question" } }
                }
            });

            const getCareerQue = find({
                collection: 'Matches',
                query: { category: categoryOfQuestion.CREEAR_AND_EXPERIENCE, status: questionState.ACTIVE, ...query },
                project: {
                    _id: 1, category: 1, queType: 1, status: 1, weight: 1, orderNum: 1, option: 1, isDel: 1, createdBy: 1, partnerId: 1, answer: 1, createdAt: 1, updatedAt: 1,
                    question: { $cond: { if: { $and: [{ $eq: ["$isAlternateQuestion", true] }, { $eq: [request.user.role, userRoleConstant.MENTOR] }] }, then: "$alternateQuestion", else: "$question" } }
                }
            });

            const getEducationQue = find({
                collection: 'Matches',
                query: { category: categoryOfQuestion.EDUCATION_INFORMATION, status: questionState.ACTIVE, ...query },
                sort: { orderNum: 1 },
                project: {
                    _id: 1, category: 1, queType: 1, status: 1, weight: 1, orderNum: 1, option: 1, isDel: 1, createdBy: 1, partnerId: 1, answer: 1, createdAt: 1, updatedAt: 1,
                    question: { $cond: { if: { $and: [{ $eq: ["$isAlternateQuestion", true] }, { $eq: [request.user.role, userRoleConstant.MENTOR] }] }, then: "$alternateQuestion", else: "$question" } }
                }
            });

            const responses: any = await Promise.allSettled([getPersonalityQue, getCareerQue, getEducationQue]);

            const finalResponse = [...responses[0].value, ...responses[1].value, ...responses[2].value];

            const categorySequence = [categoryOfQuestion.PERSONALITY_AND_INTERESTS, categoryOfQuestion.CREEAR_AND_EXPERIENCE, categoryOfQuestion.EDUCATION_INFORMATION];

            res.status(statusCode.OK).send(success(successMessage.UPLOAD_SUCCESS.replace(':attribute', "profile pic"), { data: finalResponse, categorySequence: categorySequence }, statusCode.OK))

        } catch (err: any) {
            res.status(statusCode.FORBIDDEN).send(error("There is some issue to get questionList.", err.message, statusCode.FORBIDDEN));
        }
    },

    /* Mentor get their mentee's function */
    getMenteesList: async (req: Request, res: Response) => {
        try {
            let request = req as requestUser;
            let { search, sort, order, page, limit } = req.body;

            page = page || 0;
            limit = limit || 10;

            const menteesArray = await find({
                collection: "PairInfo",
                query: { mentorId: request.user._id, isDel: false, isConfirm: true, isArchive: false },
                project: { menteeId: 1 }
            });

            const mentees: any = [];
            menteesArray.map((ele: any) => {
                mentees.push(ele.menteeId);
            });

            const query: any = [];
            const countQuery: any = {};

            if (!countQuery["$and"]) {
                countQuery["$and"] = []
            }

            query.push(
                {
                    $match: {
                        _id: { $in: mentees },
                        isDel: false,
                        isDisabled: false
                    }
                }
            );

            countQuery["$and"].push({ _id: { $in: mentees }, isDel: false, isDisabled: false });

            if (search) {
                query.push(
                    {
                        $addFields: {
                            user_name: {
                                '$concat': ["$preferredFname", ' ', "$preferredLname"]
                            },
                            reverseUsername: {
                                '$concat': ["$preferredLname", ' ', "$preferredFname"]
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
                                            },
                                            // {
                                            //     $and: [
                                            //         { $eq: ["$receiverId", new mongoose.Types.ObjectId(request.user._id)] },
                                            //         { $ne: ["$senderId", null] }
                                            //     ]
                                            // }
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
                        from: "additionalinfos",
                        let: { uId: "$_id" },
                        pipeline: [
                            {
                                $match: {
                                    $expr: {
                                        $and: [
                                            { $eq: ["$$uId", "$userId"] },
                                        ]
                                    }
                                }
                            }
                        ],
                        as: "userAdditional"
                    }
                },
                {
                    $unwind: {
                        path: "$userAdditional",
                        preserveNullAndEmptyArrays: true,
                    }
                },
                {
                    $lookup: {
                        from: "pairinfos",
                        let: { menteId: "$_id" },
                        pipeline: [
                            {
                                $match: {
                                    $expr: {
                                        $and: [
                                            { $eq: ["$$menteId", "$menteeId"] },
                                            { $eq: [new mongoose.Types.ObjectId(request.user._id), "$mentorId"] }
                                        ]
                                    }
                                }
                            }
                        ],
                        as: "menteeData"
                    }
                },
                {
                    $unwind: "$menteeData"
                },
                {
                    $project: {
                        legalFname: "$preferredFname", legalLname: "$preferredLname", profilePic: 1, profilePicKey: 1, role: 1, address: 1, location: "$menteeData.location", school: "$userAdditional.education_level.assignedSchoolOrInstitutions", joinDate: "$menteeData.createdAt",
                        badge: 1, regStatus: 1, userActivationDate: 1
                    }
                }
            );

            if (sort == "location") {

                query.push(
                    {
                        $addFields: {
                            locationCity: "$address.city",
                        },
                    },
                    {
                        $addFields: {
                            locationState: "$address.state",
                        },
                    }
                );

                if (order == "desc") {
                    query.push(
                        {
                            $sort: {
                                locationCity: -1
                            }
                        }
                    )
                }

                if (order == "asc") {
                    query.push(
                        {
                            $sort: {
                                locationCity: 1
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

            if (sort == "joinDate") {

                if (order == "desc") {
                    query.push(
                        {
                            $sort: {
                                joinDate: -1
                            }
                        }
                    )
                }

                if (order == "asc") {
                    query.push(
                        {
                            $sort: {
                                joinDate: 1
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

            const MenteesList = await aggregate({
                collection: "User",
                pipeline: query
            });

            const pages = Math.ceil(totalDocs / limit);

            const response = {
                docs: MenteesList,
                limit: limit,
                page: page,
                pages: pages,
                total: totalDocs
            };

            res.status(statusCode.OK).send(success(successMessage.FETCH_SUCCESS.replace(":attribute", "MenteesList"), response, statusCode.OK));

        } catch (err: any) {
            logger.error(`There was an issue into get mentees list.: ${err}`)
            res.status(statusCode.FORBIDDEN).send(error("There was an issue into get mentees list.", { err }, statusCode.FORBIDDEN))
        }
    },

    /* Mentor get mentee detail page function */
    getMenteeUserDetail: async (req: Request, res: Response) => {
        try {
            let { userId } = req.body;

            let menteeObj = await findOne({ collection: 'User', query: { _id: userId } });

            if (!menteeObj) {
                res.status(statusCode.OK).send(error(errorMessage.NOT_EXISTS.replace(":attribute", "Mentee"), {}, statusCode.NOT_FOUND));
                return
            }

            // menteeObj.pronounciationName = menteeObj.pronounciationName ? menteeObj.pronounciationName : "--";

            let additionalInfo = await findOne({ collection: 'AdditionalInfo', query: { userId: menteeObj._id } });

            let matchingQuestions = await findOne({ collection: 'AnswerByMentee', query: { user: menteeObj._id }, populate: [{ path: 'queAns.question', select: "_id question alternateQuestion isAlternateQuestion category" }] });

            const categorySequence = [categoryOfQuestion.PERSONALITY_AND_INTERESTS, categoryOfQuestion.CREEAR_AND_EXPERIENCE, categoryOfQuestion.EDUCATION_INFORMATION];

            res.status(statusCode.OK).send(success(successMessage.FETCH_SUCCESS.replace(":attribute", "Mentee"), { menteeObj, additionalInfo, matchingQuestions, categorySequence }, statusCode.OK))

        } catch (err: any) {
            logger.error(`There was an issue into get mentees user.: ${err}`)
            res.status(statusCode.FORBIDDEN).send(error("There was an issue into get mentees user.", err.message, statusCode.FORBIDDEN))
        }
    },

    /* Mentor delete mentee function */
    deleteMentee: async (req: Request, res: Response) => {
        try {
            let request = req as requestUser;

            const { menteeId } = req.body;

            let menteeObj = await findOne({ collection: "PairInfo", query: { menteeId: menteeId, mentorId: request.user._id } });

            if (!menteeObj) {
                res.status(statusCode.OK).send(error(errorMessage.NOT_EXISTS.replace(":attribute", 'Mentee'), {}, statusCode.NOT_FOUND))
                return
            }

            await updateOne({
                collection: 'PairInfo',
                query: { menteeId: menteeId, mentorId: request.user._id },
                update: {
                    isConfirm: false,
                    isDel: true,
                },
                options: {
                    new: true
                }
            });

            res.status(statusCode.OK).send(success(successMessage.UPDATE_SUCCESS.replace(":attribute", 'Mentee'), {}, statusCode.OK))

        } catch (err: any) {
            logger.error(`There was an issue into delete mentees.: ${err}`)
            res.status(statusCode.FORBIDDEN).send(error("There was an issue into delete mentees.", err.message, statusCode.FORBIDDEN))
        }
    }

};

const addForPotentialMatches = async (request: any, mentorId: any) => {
    try {

        await findOneAndUpdate({
            collection: 'User',
            query: {
                _id: request.user._id?.toString(), status: statusType.COMPLETED, isDel: false
            },
            update: {
                $set: { preMatchStep: 4, status: statusType.COMPLETED }
            },
            options: { new: true }
        });

        // await deleteOne({
        //     collection: "Messages",
        //     query: { receiverId: request.user._id?.toString(), msg_type: msg_Type.ANNOUNCEMENT }
        // });

        // await addToMatches({ mentorId: request.user._id?.toString(), jobId: uuidv4() });

    } catch (err: any) {
        logger.error(`There was an issue into add for potential matches.: ${err}`)
    }
}