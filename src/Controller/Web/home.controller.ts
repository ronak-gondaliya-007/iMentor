import { Request, Response } from "express";
import moment from 'moment';
import { distinct, find, findOne, findOneAndUpdate, insertMany, insertOne, updateMany, paginate, aggregate, ObjectId, deleteMany } from "../../utils/db";
import { categoryOfQuestion, course_type, errorMessage, event_status, messageConstant, msg_Type, notificationType, reminder_status, statusCode, successMessage, uploadConstant, userRoleConstant, userStatusConstant } from "../../utils/const";
import { success, error } from "../../utils/helpers/resSender";
import { logger } from "../../utils/helpers/logger";
import { requestUser } from "../../Interfaces/schemaInterfaces/user";
import mongoose from "mongoose";
import { Reminder } from "../../Bull/Queues/reminder.queue";
import { reminderUpdateOrCancel } from "../../Bull/Processors/reminder.processor";

export let homeController = {

    /* Get all announcement list function */
    getAnnouncementMessage: async (req: Request, res: Response) => {
        try {
            const request = req as requestUser;

            const getBroadCastMessage = await find({
                collection: "Messages",
                query: {
                    receiverId: request.user._id,
                    msg_type: { $in: [msg_Type.ANNOUNCEMENT, msg_Type.PRE_MATCH_ANNOUNCEMENT] },
                    isDel: false
                },
                sort: { createdAt: -1 }
            });

            // const query: any = [];

            // query.push(
            //     {
            //         $match: {
            //             receiverId: new mongoose.Types.ObjectId(request.user._id),
            //             msg_type: msg_Type.ANNOUNCEMENT
            //         }
            //     },
            //     {
            //         $lookup: {
            //             from: "reminders",
            //             let: { mId: "$_id" },
            //             pipeline: [
            //                 {
            //                     $match: {
            //                         $expr: {
            //                             $eq: ["$$mId", "$messageId"]
            //                         },
            //                         status: { $nin: [reminder_status.DELETED] }
            //                     }
            //                 }
            //             ],
            //             as: "reminderStatus"
            //         }
            //     },
            //     {
            //         $addFields: {
            //             isReminder: { $cond: { if: { $gte: [{ $size: "$reminderStatus" }, 1] }, then: true, else: false } },
            //             status: { $arrayElemAt: ['$reminderStatus.status', 0] }
            //         }
            //     },
            //     {
            //         $sort: {
            //             createdAt: -1
            //         }
            //     },
            //     {
            //         $project: { reminderStatus: 0 }
            //     }
            // )

            // const getBroadCastMessage = await aggregate({
            //     collection: "Messages",
            //     pipeline: query
            // });

            res.status(statusCode.OK).send(success(successMessage.FETCH_SUCCESS.replace(':attribute', "Broadcast message"), getBroadCastMessage, statusCode.OK))

        } catch (err: any) {
            logger.error(`There was an issue into get broadcast message.: ${err} `)
            res.status(statusCode.FORBIDDEN).send(error("There was an issue into get announcement message.", err.message, statusCode.FORBIDDEN))
        }
    },

    /* Set reminder function */
    setNewReminder: async (req: Request, res: Response) => {
        try {
            const request = req as requestUser;

            const { title, note, remind_time, type, messageId } = req.body;

            if (type === msg_Type.ANNOUNCEMENT || type === msg_Type.PRE_MATCH_ANNOUNCEMENT) {
                const verifyReminder = await findOne({
                    collection: "Reminder",
                    query: { userId: request.user._id, messageId: messageId, status: reminder_status.PROCESS }
                });

                if (verifyReminder) {
                    res.status(statusCode.OK).send(success("Reminder already exists!", { verifyReminder }, statusCode.OK));
                    return;
                }
            }

            if (type == msg_Type.ANNOUNCEMENT || type === msg_Type.PRE_MATCH_ANNOUNCEMENT) {
                await findOneAndUpdate({
                    collection: "Messages",
                    query: { _id: messageId, receiverId: request.user._id },
                    update: { $set: { isReminder: true } },
                    options: { new: true }
                });
            }

            const addReminder = await insertOne({
                collection: "Reminder",
                document: {
                    userId: request.user._id,
                    user_role: request.user.role,
                    title,
                    note,
                    remind_time,
                    messageId,
                    type
                }
            });

            var options = { delay: new Date(new Date(remind_time).getTime() - new Date().getTime()).getTime(), attempts: 1, jobId: addReminder._id };

            Reminder.add({ status: addReminder.status, title, note, remind_time, userId: request.user._id }, options);

            res.status(statusCode.OK).send(success(successMessage.CREATE_SUCCESS.replace(':attribute', "queue"), addReminder, statusCode.OK));

        } catch (err: any) {
            logger.error(`There was an issue into set new reminder.: ${err} `)
            res.status(statusCode.FORBIDDEN).send(error("There was an issue into set new reminder", { err }, statusCode.FORBIDDEN))
        }
    },

    /* Edit reminder function */
    editReminder: async (req: Request, res: Response) => {
        try {
            const request = req as requestUser;

            const { reminderId, type } = req.body;

            let query: any = {};
            if (type == msg_Type.ANNOUNCEMENT || type === msg_Type.PRE_MATCH_ANNOUNCEMENT) {
                query = { userId: request.user._id, messageId: reminderId, status: { $eq: reminder_status.PROCESS } }
            } else {
                query = { userId: request.user._id, _id: reminderId, status: { $eq: reminder_status.PROCESS } }
            }

            const Reminder = await findOne({
                collection: "Reminder",
                query
            });

            res.status(statusCode.OK).send(success(successMessage.FETCH_SUCCESS.replace(':attribute', "queue"), Reminder, statusCode.OK))

        } catch (err: any) {
            logger.error(`There was an issue into edit reminder.: ${err} `)
            res.status(statusCode.FORBIDDEN).send(error("There was an issue into edit reminder", { err }, statusCode.FORBIDDEN))
        }
    },

    /* Update reminder function */
    updateReminder: async (req: Request, res: Response) => {
        try {
            const request = req as requestUser;

            const { reminderId, messageId, title, note, remind_time, type } = req.body;

            let query: any = {};
            if (type == msg_Type.ANNOUNCEMENT || type === msg_Type.PRE_MATCH_ANNOUNCEMENT) {
                query = { _id: reminderId, messageId: messageId, userId: request.user._id, status: { $eq: reminder_status.PROCESS } }
            } else {
                query = { userId: request.user._id, _id: reminderId, status: { $eq: reminder_status.PROCESS } }
            }

            await reminderUpdateOrCancel(reminderId);

            const reminder = await findOneAndUpdate({
                collection: "Reminder",
                query,
                update: {
                    $set: {
                        title,
                        note,
                        remind_time
                    }
                },
                options: { new: true }
            });

            var options = { delay: new Date(new Date(remind_time).getTime() - new Date().getTime()).getTime(), attempts: 1, jobId: reminderId };

            Reminder.add({ status: reminder_status.PROCESS, title: title, note: note, remind_time: remind_time, userId: request.user._id }, options);

            res.status(statusCode.OK).send(success(successMessage.UPDATE_SUCCESS.replace(':attribute', "queue"), reminder, statusCode.OK))

        } catch (err: any) {
            logger.error(`There was an issue into update reminder.: ${err} `)
            res.status(statusCode.FORBIDDEN).send(error("There was an issue into update reminder", { err }, statusCode.FORBIDDEN))
        }
    },

    /* Delete reminder function */
    deleteReminder: async (req: Request, res: Response) => {
        try {
            const request = req as requestUser;

            const { reminderId, type } = req.body;

            let query: any = {};
            if (type == msg_Type.ANNOUNCEMENT || type === msg_Type.PRE_MATCH_ANNOUNCEMENT) {
                query = { userId: request.user._id, messageId: reminderId, status: { $eq: reminder_status.PROCESS } }
            } else {
                query = { userId: request.user._id, _id: reminderId, status: { $eq: reminder_status.PROCESS } }
            }


            const Reminder = await findOneAndUpdate({
                collection: "Reminder",
                query,
                update: {
                    $set: {
                        status: reminder_status.DELETED
                    }
                },
                options: { new: true }
            });

            await reminderUpdateOrCancel(Reminder?._id?.toString());

            if (Reminder.type == msg_Type.ANNOUNCEMENT || Reminder.type === msg_Type.PRE_MATCH_ANNOUNCEMENT) {
                await findOneAndUpdate({
                    collection: "Messages",
                    query: { _id: Reminder.messageId, receiverId: request.user._id },
                    update: { $set: { isReminder: false } },
                    options: { new: true }
                });
            }

            res.status(statusCode.OK).send(success(successMessage.DELETE_SUCCESS.replace(':attribute', "Reminder"), Reminder, statusCode.OK))

        } catch (err: any) {
            logger.error(`There was an issue into delete reminder.: ${err} `)
            res.status(statusCode.FORBIDDEN).send(error("There was an issue into delete reminder", { err }, statusCode.FORBIDDEN))
        }
    },

    /* Get reminder function */
    getReminders: async (req: Request, res: Response) => {
        try {
            const request = req as requestUser;

            const userId = request.user._id;

            const Reminders = await find({
                collection: "Reminder",
                query: { userId }
            });

            if (Reminders.length == 0) {
                res.status(statusCode.OK).send(error(errorMessage.NOT_EXISTS.replace(':attribute', 'reminder'), Reminders, statusCode.NOT_FOUND))
                return
            }

            res.status(statusCode.OK).send(success(successMessage.FETCH_SUCCESS.replace(':attribute', "reminder"), Reminders, statusCode.OK))

        } catch (err: any) {
            logger.error(`There was an issue into get reminder.: ${err} `)
            res.status(statusCode.FORBIDDEN).send(error("There was an issue into get reminder", err, statusCode.FORBIDDEN))
        }
    },

    /* Calender view function */
    getCalenderEventList: async (req: Request, res: Response) => {
        try {
            const request = req as requestUser;

            const query: any = [];

            query.push(
                {
                    $match: {
                        $expr: {
                            $or: [
                                {
                                    $and: [
                                        { $eq: ["$userId", new mongoose.Types.ObjectId(request.user._id)] },
                                        { $eq: ["$isDel", false] },
                                    ]
                                },
                                {
                                    $and: [
                                        {
                                            $in: [new mongoose.Types.ObjectId(request.user._id), "$guest"]
                                        },
                                        { $eq: ["$approval", event_status.APPROVED] },
                                        { $eq: ["$isDel", false] },
                                    ]
                                }
                            ]
                        }
                    }
                },
                { $match: { end_date: { $gte: new Date() } } },
                {
                    $project: {
                        id: "$_id",
                        title: "$event_name",
                        start: "$start_date",
                        type: msg_Type.EVENT
                    }
                }
            );

            const getCalendarList = aggregate({
                collection: "Event",
                pipeline: query
            });

            const getReminderList = find({
                collection: "Reminder",
                query: {
                    userId: request.user._id, remind_time: { $gte: new Date() }, status: { $nin: [reminder_status.DELETED, reminder_status.FAILED] }
                },
                project: { id: "$_id", title: "$title", start: "$remind_time", type: notificationType.REMINDER }
            });

            const response: any = await Promise.allSettled([getCalendarList, getReminderList]);

            const concatenatedArray = response[0].value?.concat(response[1].value);

            if (!concatenatedArray) {
                return res.status(statusCode.OK).send(success(successMessage.FETCH_SUCCESS.replace(':attribute', "calendar list"), { getCalendarList: [] }, statusCode.OK))
            }

            res.status(statusCode.OK).send(success(successMessage.FETCH_SUCCESS.replace(':attribute', "calendar list"), { getCalendarList: concatenatedArray }, statusCode.OK))

        } catch (err: any) {
            logger.error(`There was an issue into get calendar event list.: ${err} `)
            res.status(statusCode.FORBIDDEN).send(error("There was an issue into get calendar event list", { err }, statusCode.FORBIDDEN))
        }
    },

    /* Date wise event view bottom of calender function */
    getDateWiseCalenderEventList: async (req: Request, res: Response) => {
        try {
            const request = req as requestUser;

            const { startDate, endDate } = req.body;

            // Calculate the time difference in milliseconds
            const timeDifference: number = Math.abs(new Date(endDate).getTime() - new Date(startDate).getTime());

            // Calculate the number of days
            const daysDifference: number = Math.ceil(timeDifference / (1000 * 3600 * 24));

            console.log("Difference in days:", daysDifference);

            const query: any = [];
            let reminderQuery: any = {};

            reminderQuery = { userId: request.user._id, remind_time: { $gte: new Date(startDate), $lt: new Date(endDate) }, status: { $nin: [reminder_status.DELETED, reminder_status.FAILED] } };

            query.push(
                {
                    $match: {
                        $or: [
                            {
                                start_date: {
                                    $gte: new Date(startDate),
                                    $lt: new Date(endDate),
                                }
                            },
                            {
                                end_date: {
                                    $gt: new Date(startDate),
                                    $lt: new Date(endDate),
                                }
                            }
                        ]
                    }
                },
            )

            if (daysDifference > 1) {
                query.push({ $match: { end_date: { $gte: new Date() } } });
                // reminderQuery = ({ ...query, remind_time: { $gte: new Date() } })
            }

            query.push(
                {
                    $match: {
                        $expr: {
                            $or: [
                                {
                                    $and: [
                                        { $eq: ["$userId", new mongoose.Types.ObjectId(request.user._id)] },
                                        { $eq: ["$isDel", false] },
                                    ]
                                },
                                {
                                    $and: [
                                        {
                                            $in: [new mongoose.Types.ObjectId(request.user._id), { $ifNull: ["$guest", []] }]
                                        },
                                        { $eq: ["$isDel", false] },
                                        { $eq: ["$approval", event_status.APPROVED] },
                                    ]
                                }
                            ]
                        }
                    }
                },
                {
                    $lookup: {
                        from: "eventguests",
                        let: { eId: "$_id", uId: new mongoose.Types.ObjectId(request.user._id) },
                        pipeline: [
                            {
                                $match: {
                                    $expr: {
                                        $and: [
                                            { $eq: ["$$eId", "$eventId"] },
                                            { $eq: ["$$uId", "$userId"] }
                                        ]
                                    },
                                    isActive: { $eq: true },
                                    isDel: { $eq: false }
                                }
                            }
                        ],
                        as: "guestRequest"
                    }
                },
                { $unwind: { path: "$guestRequest", preserveNullAndEmptyArrays: true } },
                {
                    $project: {
                        event_name: 1,
                        isVirtual: 1,
                        start_date: 1,
                        end_date: 1,
                        guestRequest: "$guestRequest.status",
                        type: msg_Type.EVENT,
                        status: {
                            $cond: {
                                if: { $lte: ["$end_date", new Date()] }, // Check if endDate is less than or equal to current date
                                then: "Ended", // Set approval to "Ended"
                                else: "$approval" // Keep the existing value of approval if condition is false
                            }
                        }
                    }
                },
                { $sort: { start_date: 1 } }
            );
            console.log(JSON.stringify(query));
            console.log(JSON.stringify(reminderQuery));




            const getCalendarList = aggregate({
                collection: "Event",
                pipeline: query
            });

            const getReminderList = find({
                collection: "Reminder",
                query: reminderQuery
            });

            const response: any = await Promise.allSettled([getCalendarList, getReminderList]);
            console.log("Response===============>   ", JSON.stringify(response));


            let concatenatedArray: any = response[0].value;
            if (response[1].value?.length) {
                concatenatedArray = response[0].value?.concat(response[1].value?.map((item: any) => ({
                    _id: item._id,
                    reminder_name: item.title,
                    note: item.note,
                    remind_date: item.remind_time,
                    status: item.status,
                    type: notificationType.REMINDER
                })));

                concatenatedArray?.sort((a: any, b: any) => {
                    const dateA: any = a.type === "Event" ? new Date(a.start_date) : new Date(a.remind_date);
                    const dateB: any = b.type === "Event" ? new Date(b.start_date) : new Date(b.remind_date);
                    return dateA - dateB;
                });
            }

            // const groupedData = concatenatedArray.reduce((acc: any, cur: any) => {
            //     const utcDate = new Date(cur.start_date || cur.remind_date);
            //     console.log(cur.start_date); // Output: "Sunday 01 October, 2023"
            //     // const utcDate = cur.start_date || cur.remind_date;
            //     const date = moment(utcDate);
            //     const formattedDate = date.format('dddd DD MMMM, YYYY');
            //     console.log(formattedDate); // Output: "Sunday 01 October, 2023"

            //     if (!acc[formattedDate]) {
            //         acc[formattedDate] = [];
            //     }

            //     acc[formattedDate].push(cur);
            //     return acc;
            // }, {});

            // const result = Object.entries(groupedData).map(([date, data]) => ({
            //     date,
            //     data,
            // }));

            res.status(statusCode.OK).send(success(successMessage.FETCH_SUCCESS.replace(':attribute', "calendar list"), { getCalendarList: concatenatedArray }, statusCode.OK))

        } catch (err: any) {
            logger.error(`There was an issue into get calendar event list.: ${err} `)
            res.status(statusCode.FORBIDDEN).send(error("There was an issue into get calendar event list", { err }, statusCode.FORBIDDEN))
        }
    },

    /* Project assigned list function */
    projectAssignedList: async (req: Request, res: Response) => {
        try {
            const request = req as requestUser;

            const mentees: any = [];

            if (request.user.role == userRoleConstant.MENTOR) {

                const menteesList = await find({
                    collection: "PairInfo",
                    query: { mentorId: request.user._id, isDel: false, isConfirm: true, isArchive: false },
                    project: { menteeId: 1 }
                });

                menteesList.map((ele: any) => {
                    mentees.push(ele.menteeId);
                });

            } else {
                mentees.push(request.user._id);
            }


            const projectList = await find({
                collection: "RecommendedCourses",
                query: { userId: { $in: mentees }, courseType: { $in: [course_type.PROJECT, course_type.TRAINING] } },
                populate: [
                    {
                        path: "thinkificCourseId",
                    },
                    {
                        path: "userId",
                        select: "legalFname legalLname preferredFname preferredLname role profilePic profilePicKey"
                    }
                ]
            });

            if (!projectList.length) {
                res.status(statusCode.OK).send(error(successMessage.NOT_FOUND.replace(":attribute", "Project"), { assignProjectList: [] }, statusCode.OK));
                return
            }

            // let trainingCompleted = await axios({
            //     method: 'get',
            //     url: config.THINKIFIC.API_BASE_URL + "/enrollments/?page=1&limit=9999",
            //     headers: { 'X-Auth-Subdomain': config.THINKIFIC.SUBDOMAIN, 'X-Auth-API-Key': config.THINKIFIC.KEY }
            // });

            // const modifiedProjectList = projectList.map((ele: any) => {
            //     const matchingThinkificItem = trainingCompleted.data.items.find((item: any) => {
            //         return ele.enrollId == String(item.id);
            //     });

            //     return {
            //         ...ele,
            //         course_name: matchingThinkificItem ? matchingThinkificItem.course_name : "",
            //         percentage_completed: matchingThinkificItem ? matchingThinkificItem.percentage_completed : "",
            //         completed: matchingThinkificItem ? matchingThinkificItem.completed : ""
            //     };
            // });

            return res.status(statusCode.OK).send(success(successMessage.FETCH_SUCCESS.replace(':attribute', "Project"), { assignProjectList: projectList }, statusCode.OK));

        } catch (err: any) {
            logger.error(`There was an issue into project assigned list.: ${err}`)
            res.status(statusCode.FORBIDDEN).send(error("There is some issue into project assigned list.", err.message, statusCode.FORBIDDEN));
        }
    }

}
