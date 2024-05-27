import { Request, Response } from "express";
import { find, findOne, insertOne } from "../../utils/db";
import { errorMessage, statusCode, successMessage, msg_Type, badge_type, userRoleConstant, course_type } from "../../utils/const";
import { success, error } from "../../utils/helpers/resSender";
import { logger } from "../../utils/helpers/logger";
import { requestUser } from "../../Interfaces/schemaInterfaces/user";
import { sendMsg } from "./message.controller";
import axios from "axios";
import config from "../../utils/config";

export let progressController = {

    /* Get mentees detail with badge list detail function */
    getMenteeProgressDetail: async (req: Request, res: Response) => {
        try {
            const request = req as requestUser;
            console.log(request.user);

            const { userId } = req.body;

            const userObj = await findOne({
                collection: "User",
                query: { _id: userId, isDel: false }
            });

            if (!userObj) {
                res.status(statusCode.OK).send(error(errorMessage.NOT_EXISTS.replace(":attribute", "User"), {}, statusCode.NOT_FOUND));
                return
            }

            const badgeDetail = await find({
                collection: "AchievedBadges",
                query: {
                    $or: [
                        {
                            $and: [{ receiverId: userId }, { senderId: null }, { type: badge_type.SYSTEM }]
                        },
                        {
                            $and: [{ receiverId: request.user._id }, { senderId: userId }, { type: badge_type.CUSTOM }]
                        }
                    ]
                },
                project: { badgeName: 1, type: 1, achievedDate: 1 },
                sort: { type: -1, achievedDate: 1, }
            });

            res.status(statusCode.OK).send(success(successMessage.FETCH_SUCCESS.replace(":attribute", "pair detail"), { badgeDetail }, statusCode.OK))

        } catch (err: any) {
            logger.error(`There was an issue into get Mentee Progress Detail.: ${err}`)
            res.status(statusCode.FORBIDDEN).send(error("There was an issue into get Mentee Progress Detail.", err.message, statusCode.FORBIDDEN))
        }
    },

    /* Given badge list function */
    givenBadgeList: async (req: Request, res: Response) => {
        try {
            const request = req as requestUser;

            const { userId } = req.body;

            const badges = find({
                collection: "Badge",
                query: { isSystem: false, type: { $in: ["", request.user.role] } }
            });

            const givenBadge = find({
                collection: "AchievedBadges",
                query: { senderId: request.user._id, receiverId: userId, type: badge_type.CUSTOM }
            });

            const response: any = await Promise.allSettled([badges, givenBadge]);

            const givenBadgeNames = response[1].value.map((givenBadge: any) => givenBadge.badgeName);

            response[0].value.forEach((badge: any) => {
                if (givenBadgeNames.includes(badge.badgeName)) {
                    badge.isSend = true;
                } else {
                    badge.isSend = false;
                }
            });

            res.status(statusCode.OK).send(success("Badge List Successfully", { badge: response[0].value }, statusCode.OK));

        } catch (err: any) {
            logger.error(`There was an issue into given badge list.: ${err}`)
            res.status(statusCode.FORBIDDEN).send(error("There is some issue into given badge list.", err.message, statusCode.FORBIDDEN));
        }
    },

    /* Give badge */
    sendBadge: async (req: Request, res: Response) => {
        try {
            const request = req as requestUser;

            const { userId, badgeName, message } = req.body;

            const getUserInfo = await findOne({
                collection: "User",
                query: { _id: userId, isDel: false }
            });

            if (!getUserInfo) {
                res.status(statusCode.OK).send(error(errorMessage.NOT_EXISTS.replace(":attribute", "User"), {}, statusCode.BAD_REQUEST));
                return
            }

            const giveBadge = await insertOne({
                collection: "AchievedBadges",
                document: {
                    senderId: request.user._id,
                    receiverId: userId,
                    badgeName: badgeName,
                    type: badge_type.CUSTOM,
                    achievedDate: new Date(),
                    message: message
                }
            });

            // Send given badge message
            sendMsg({ data: { user_id: request.user._id, receiverId: userId, message, msg_type: msg_Type.BADGE, badge: badgeName } });

            res.status(statusCode.OK).send(success(successMessage.SEND_SUCCESS.replace(":attribute", "Badge"), { giveBadge }, statusCode.OK))

        } catch (err: any) {
            logger.error(`There was an issue into send badge.: ${err}`)
            res.status(statusCode.FORBIDDEN).send(error("There is some issue into send badge.", err.message, statusCode.FORBIDDEN));
        }
    },

    /* Get mentees project function */
    menteesAllProject: async (req: Request, res: Response) => {
        try {
            const request = req as requestUser;

            const menteesList = await find({
                collection: "PairInfo",
                query: { mentorId: request.user._id, isDel: false, isConfirm: true, isArchive: false },
                project: { menteeId: 1 }
            });

            const mentees: any = [];
            menteesList.map((ele: any) => {
                mentees.push(ele.menteeId);
            });

            const projectList = await find({
                collection: "RecommendedCourses",
                query: { userId: { $in: mentees }, courseType: { $in: [course_type.PROJECT, course_type.TRAINING] } },
                populate: [
                    {
                        path: "thinkificCourseId",
                    },
                    {
                        path: "userId",
                        select: "legalFname legalLname preferredLname preferredFname role profilePic profilePicKey thinkificUserId"
                    }
                ]
            });
            console.log(projectList);

            if (!projectList.length) {
                res.status(statusCode.OK).send(error(successMessage.NOT_FOUND.replace(":attribute", "Project"), { assignProjectList: [] }, statusCode.OK));
                return
            }

            // Create a map to store unique user_ids and their corresponding items
            const uniqueUsers = new Map();

            for (const item of projectList) {
                // If the user_id is not in the map, add it along with the item
                if (!uniqueUsers.has(item.userId._id) ||
                    new Date(item.updatedAt) > new Date(uniqueUsers.get(item.userId._id).updatedAt)) {
                    uniqueUsers.set(item.userId._id, item);
                }
            }

            // Create an empty array to store unique user IDs
            const finalResponse = Array.from(uniqueUsers.values());


            // const enrollments: any = [];
            // uniqueUsers.forEach(async (value, key) => {
            //     console.log("value", value);

            //     let trainingCompleted = await axios({
            //         method: 'get',
            //         url: config.THINKIFIC.API_BASE_URL + "/enrollments/" + value.enrollId,
            //         headers: { 'X-Auth-Subdomain': config.THINKIFIC.SUBDOMAIN, 'X-Auth-API-Key': config.THINKIFIC.KEY }
            //     });

            //     let items = trainingCompleted.data.items; // Your array of items
            // console.log(items);

            // [...enrollments, ...items]
            // });
            // console.log(enrollments);


            // // Convert the map values back into an array
            // const sortedAndUniqueItems = Array.from(uniqueUsers.values()).sort(
            //     (a: any, b: any) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
            // );
            // // console.log("sortedAndUniqueItems", sortedAndUniqueItems);

            // const finalResponse = projectList.map((item: any) => {

            //     const matchingThinkificItem = sortedAndUniqueItems.find((ele: any) => {
            //         if (item.enrollId === ele.id) {
            //             console.log("item.enrollId", item.enrollId);
            //             console.log("ele.id", ele.id);
            //             console.log("ele", ele);
            //             return ele
            //         }
            //     });
            //     console.log(matchingThinkificItem);

            //     if (matchingThinkificItem !== undefined) {
            //         return {
            //             ...item,
            //             course_name: matchingThinkificItem.course_name,
            //             percentage_completed: matchingThinkificItem.percentage_completed,
            //             completed: matchingThinkificItem.completed
            //         };
            //     } else {
            //         return null; // Return null for items without a match
            //     }
            // }).filter((item: any) => item !== null); // Filter out null items

            return res.status(statusCode.OK).send(success(successMessage.FETCH_SUCCESS.replace(':attribute', "Project"), { assignProjectList: finalResponse }, statusCode.OK));

        } catch (err: any) {
            logger.error(`There was an issue into mentees all project.: ${err}`)
            res.status(statusCode.FORBIDDEN).send(error("There is some issue into mentees all project.", err.message, statusCode.FORBIDDEN));
        }
    },

    /* Get user id wise projects function*/
    menteeWiseProject: async (req: Request, res: Response) => {
        try {
            const request = req as requestUser;

            const { userId } = req.body;

            let query: any = {};
            if (request.user.role == userRoleConstant.MENTOR) {
                query = { menteeId: userId, mentorId: request.user._id, isDel: false, isConfirm: true, isArchive: false }
            } else {
                query = { mentorId: userId, menteeId: request.user._id, isDel: false, isConfirm: true, isArchive: false }
            }

            const menteesObj = await findOne({
                collection: "PairInfo",
                query
            });

            if (!menteesObj) {
                res.status(statusCode.OK).send(error(successMessage.NOT_FOUND.replace(":attribute", "Mentee"), {}, statusCode.OK));
                return
            }

            const projectList = await find({
                collection: "RecommendedCourses",
                query: { userId: userId, courseType: { $nin: [msg_Type.CONTENT] } },
                populate: [
                    {
                        path: "thinkificCourseId",
                    },
                    {
                        path: "userId",
                        select: "legalFname legalLname preferredFname preferredLname role profilePic profilePicKey thinkificUserId"
                    }
                ]
            });

            if (!projectList.length) {
                res.status(statusCode.OK).send(error(successMessage.NOT_FOUND.replace(":attribute", "Project"), { assignProjectList: [] }, statusCode.OK));
                return
            }

            const finalResponse = projectList.map((ele: any) => {

                return {
                    ...ele,
                    course_name: ele?.thinkificCourseId?.courseName,
                    percentage_completed: ele?.percentageCompleted,
                    completed: ele?.percentageCompleted === 100 ? true : false
                }

            });
            console.log(JSON.stringify(finalResponse));


            return res.status(statusCode.OK).send(success(successMessage.FETCH_SUCCESS.replace(':attribute', "Project"), { assignProjectList: finalResponse }, statusCode.OK));

        } catch (err: any) {
            logger.error(`There was an issue into mentees wise project.: ${err}`)
            res.status(statusCode.FORBIDDEN).send(error("There is some issue into mentees wise project.", err.message, statusCode.FORBIDDEN));
        }
    }

};