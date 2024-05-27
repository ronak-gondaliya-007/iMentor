import { Request, Response } from "express";
import { aggregate, find, findOne, findOneAndUpdate, updateOne, countDocuments, insertOne, deleteOne, updateMany } from "../../utils/db";
import {
    userRoleConstant, errorMessage, statusCode, questionState, successMessage, statusType, event_status, msg_Type, course_type,
    ContentConstants
} from "../../utils/const";
import { success, error } from "../../utils/helpers/resSender";
import { logger } from "../../utils/helpers/logger";
import { requestUser } from "../../Interfaces/schemaInterfaces/user";
import config from "../../utils/config";
import _ from "underscore"
import jwt from "jsonwebtoken";
import axios from "axios";
import { sendMsg } from "./message.controller";

export let contentController = {

    /* Mentor get content list function */
    getContentList: async (req: Request, res: Response) => {
        try {
            let request = req as requestUser;

            const { type } = req.body;

            let query: any = {};
            if (type == msg_Type.CONTENT) {
                query = {
                    userId: request.user._id,
                    isDefaultCourse: false,
                    courseType: msg_Type.CONTENT,
                    // courseStatus: ContentConstants.ASSIGNED_COURSE_STATUS.published
                }
            } else {
                query = {
                    userId: request.user._id,
                    isDefaultCourse: false,
                    courseType: { $in: [msg_Type.PROJECT, msg_Type.TRAINING] },
                    // courseStatus: ContentConstants.ASSIGNED_COURSE_STATUS.published
                }
            }

            let getCourse = await find({
                collection: "RecommendedCourses",
                query,
                populate: [
                    {
                        path: "thinkificCourseId",
                    },
                    {
                        path: "userId",
                        select: "thinkificUserId"
                    },
                    {
                        path: "contentId",
                        populate: {
                            path: 'createdBy',
                            model: "User", // Assuming the reference to user is in the User model
                        }
                    }
                ]
            });

            if (!getCourse.length) {
                res.status(statusCode.OK).send(success(successMessage.FETCH_SUCCESS.replace(':attribute', "Content"), { contentList: [] }, statusCode.NOT_FOUND))
                return
            }

            if (type !== msg_Type.CONTENT && getCourse.length > 0) {

                // // Get course detail using third party api call
                // let courseUrl = config.THINKIFIC.API_BASE_URL + "/enrollments?query[user_id]=" + getCourse[0].userId.thinkificUserId + "&page=1&limit=100";

                // let contentDetail = await axios({
                //     method: 'get',
                //     url: courseUrl,
                //     headers: { 'X-Auth-Subdomain': config.THINKIFIC.SUBDOMAIN, 'X-Auth-API-Key': config.THINKIFIC.KEY }
                // });

                // if (contentDetail.data && contentDetail.data.items) {

                //     // Filter the items based on targetIds
                const finalResponse = getCourse.map((ele: any) => {
                    return {
                        _id: ele._id,
                        THINKIFIC_ASSET_ACCESS_URL: process.env.THINKIFIC_ASSET_ACCESS_URL,
                        courseId: ele.thinkificCourseId.courseId,
                        courseType: ele.thinkificCourseId.courseType,
                        user_id: ele.userId.thinkificUserId,
                        isArchived: ele.isArchived,
                        isDefaultCourse: ele.isDefaultCourse,
                        enrollId: ele.enrollId,
                        message: ele.message,
                        course_name: ele.thinkificCourseId.courseName,
                        percentage_completed: ele.percentageCompleted,
                        completed: ele.percentageCompleted < 100 ? false : true,
                        createdAt: ele.createdAt,
                        updatedAt: ele.updatedAt,
                        thinkificCourseId: ele.thinkificCourseId
                    };

                });

                return res.status(statusCode.OK).send(success(successMessage.FETCH_SUCCESS.replace(':attribute', "Course"), { contentList: finalResponse }, statusCode.OK));

                //         const matchingThinkificItem = contentDetail.data.items.find((item: any) => {
                //             return ele.enrollId == String(item.id);
                //         });
                // } else {
                //     return res.status(statusCode.OK).send(error("No content data received", "", statusCode.INTERNAL_SERVER_ERROR));
                // }
            }

            return res.status(statusCode.OK).send(success(successMessage.FETCH_SUCCESS.replace(':attribute', "Content"), { contentList: getCourse }, statusCode.OK));

        } catch (err: any) {
            logger.error(`There was an issue into get content list.: ${err}`)
            res.status(statusCode.FORBIDDEN).send(error("There was an issue into get content list.", err.message, statusCode.FORBIDDEN))
        }
    },

    /* Mentor get content detail page url function */
    getContentURL: async (req: Request, res: Response) => {
        try {
            let request = req as requestUser;

            const { courseId } = req.body;

            let userObj = await findOne({
                collection: "User",
                query: { _id: request.user._id, role: request.user.role }
            });

            if (!userObj) {
                res.status(statusCode.OK).send(success(errorMessage.NOT_EXISTS.replace(":attribute", "User"), {}, statusCode.BAD_REQUEST));
                return
            }

            // Get course detail using third party api call
            let courseUrl = config.THINKIFIC.API_BASE_URL + "/courses/" + courseId;

            axios({
                method: 'get',
                url: courseUrl,
                headers: { 'X-Auth-Subdomain': config.THINKIFIC.SUBDOMAIN, 'X-Auth-API-Key': config.THINKIFIC.KEY }
            }).then(function (response: any) {
                // handle success

                const token = jwt.sign({
                    email: userObj.email,
                    first_name: userObj.preferredFname,
                    last_name: userObj.preferredLname,
                    iat: Math.floor(Date.now() / 1000) - 30,
                    // locale: "en-US"
                }, config.THINKIFIC.KEY);

                const courseURL = config.THINKIFIC.COURSE_URL + response.data.slug;

                const redirectURL = config.THINKIFIC.BASE_URL + token + '&return_to=' + courseURL + '&error_url=' + config.THINKIFIC.SSO_ERROR;

                return res.status(statusCode.OK).send(success(successMessage.FETCH_SUCCESS.replace(':attribute', "URL"), { redirectURL }, statusCode.OK))

            }).catch(function (error: any) {
                // handle error
                res.status(statusCode.OK).send(error("There was an issue into get content url.", error.message, statusCode.FORBIDDEN))
            });

        } catch (err: any) {
            logger.error(`There was an issue into get content url.: ${err}`)
            res.status(statusCode.FORBIDDEN).send(error("There was an issue into get content url.", err.message, statusCode.FORBIDDEN))
        }
    },

    /* Get content detail using id function */
    getContentDetail: async (req: Request, res: Response) => {
        try {

            const { contentId } = req.body;

            const getContent = await findOne({
                collection: "Contents",
                query: { _id: contentId }
            });

            if (!getContent) {
                res.status(statusCode.OK).send(success(successMessage.NOT_FOUND.replace(":attribute", "Content"), {}, statusCode.NOT_FOUND));
                return
            }

            return res.status(statusCode.OK).send(success(successMessage.FETCH_SUCCESS.replace(':attribute', "Content"), { getContent }, statusCode.OK))

        } catch (err: any) {
            logger.error(`There was an issue into get content detail.: ${err}`)
            res.status(statusCode.FORBIDDEN).send(error("There was an issue into get content detail.", err.message, statusCode.FORBIDDEN))
        }
    },

    /* Share content in message using id function */
    shareContent: async (req: Request, res: Response) => {
        try {
            const request = req as requestUser;

            const { contentId, user, message } = req.body;

            const getContent = await findOne({
                collection: "Contents",
                query: { _id: contentId }
            });

            if (!getContent) {
                res.status(statusCode.OK).send(success(successMessage.NOT_FOUND.replace(":attribute", "Content"), {}, statusCode.NOT_FOUND));
                return
            }

            let partnerIdOrRegionId: any = request.user.partnerAdmin;
            let usersList: any = [];
            let queryOwnUsers: any = {
                partnerAdmin: request.user.partnerAdmin
            };

            if (!request.user.partnerAdmin) {
                partnerIdOrRegionId = request.user.region;

                queryOwnUsers = {
                    region: request.user.region
                }
            }

            // Send message selected user using socket
            const getMentorMenteesQuery = {
                ...queryOwnUsers,
                _id: { $in: user },
                role: { $in: [userRoleConstant.MENTOR, userRoleConstant.MENTEE] },
                isDel: false,
                status: { $in: [statusType.COMPLETED, statusType.MATCHING, statusType.MATCHED] }
            }

            // check all users exists into database
            const mentorsMentees = await find({
                collection: 'User',
                query: getMentorMenteesQuery,
                project: { _id: 1, role: 1, email: 1, thinkificUserId: 1, legalFname: 1, legalLname: 1, region: 1, partnerAdmin: 1 }
            });

            if (user.length != mentorsMentees.length) {
                const errMsg = errorMessage.INVALID.replace(':attribute', 'user');
                res.status(statusCode.BAD_REQUEST).send(error(errMsg, {}, statusCode.BAD_REQUEST))
                return
            } else {
                usersList = mentorsMentees;
            }

            console.log(usersList);

            const data: any = {
                contentId,
                user: usersList,
                courseType: msg_Type.CONTENT,
                requestedUserId: request.user._id,
                message
            };

            await enrollUserToContent(data);

            return res.status(statusCode.OK).send(success(successMessage.SEND_SUCCESS.replace(':attribute', "Content shared"), { getContent }, statusCode.OK))

        } catch (err: any) {
            logger.error(`There was an issue into share content.: ${err}`)
            res.status(statusCode.FORBIDDEN).send(error("There was an issue into share content.", err.message, statusCode.FORBIDDEN))
        }
    },

    /* Increment Content View Count */
    incrementContentViewedCount: async (req: Request, res: Response) => {
        try {
            const { contentId } = req.body;
            const request = req as requestUser;
            const userId = request.user._id;

            // check is content recommended
            const isContentRecommended = await findOne({
                collection: "RecommendedCourses",
                query: { contentId: contentId, userId: userId, isRead: false },
                project: { _id: 1 }
            });

            let contentViewedCount = 1;

            if (isContentRecommended) {
                await updateMany({
                    collection: "RecommendedCourses",
                    query: { contentId: contentId, userId: userId, isRead: false },
                    update: { $set: { isRead: true } },
                    options: { new: true }
                });

                const updatedContent = await findOneAndUpdate({
                    collection: 'Contents',
                    query: { _id: contentId },
                    update: { $inc: { contentViewedCount: 1 } },
                    options: { new: true }
                });

                contentViewedCount = updatedContent.contentViewedCount;
            }

            const successMsg = successMessage.UPDATE_SUCCESS.replace(':attribute', "Content viewed count");
            return res.status(statusCode.OK).send(success(successMsg, { contentViewedCount }, statusCode.OK));
        } catch (err: any) {
            logger.error(`There was an issue into increment content viewed count.: ${err}`)
            res.status(statusCode.FORBIDDEN).send(error("There was an issue into increment content viewed count.", err.message, statusCode.FORBIDDEN))
        }
    }


};

const enrollUserToContent = async function (data: any) {
    const { contentId, user, courseType, requestedUserId } = data;
    const newEnroll: any = [];
    const alreadyEnroll: any = [];

    for (let index = 0; index < user?.length; index++) {
        const element = user[index];

        let partnerIdOrRegionId = element?.partnerAdmin;

        if (!element?.partnerAdmin) {
            partnerIdOrRegionId = element?.region;
        }

        // check is already enrolled
        const isAlreadyEnroll = await findOne({
            collection: 'RecommendedCourses',
            query: { contentId: contentId, userId: element._id }
        });

        if (isAlreadyEnroll) {
            await alreadyEnroll.push(isAlreadyEnroll);
        } else {
            let insertData: any = {
                contentId: contentId,
                userId: element._id,
                courseType: courseType,
                message: data.message,
                courseStatus: ContentConstants.ASSIGNED_COURSE_STATUS.published,
                partnerIdOrRegionId: partnerIdOrRegionId,
                partnerAdmin: element?.partnerAdmin,
                region: element?.region
            };

            const insertedRecommended = await insertOne({
                collection: 'RecommendedCourses',
                document: insertData
            });

            await newEnroll.push(insertedRecommended);
        }

        await sendMsg({
            data: {
                user_id: requestedUserId,
                receiverId: element._id,
                user_type: element.role,
                message: data.message || ContentConstants.RECOMMENDED_MESSAGE,
                msg_type: 'Content',
                contentId: contentId
            }
        });

        const returnData = {
            newEnroll,
            alreadyEnroll
        };

        return returnData;
    }
}
