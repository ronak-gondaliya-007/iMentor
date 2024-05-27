import { Request, Response } from "express";
import { logger } from "../utils/helpers/logger";
import { error, success } from "../utils/helpers/resSender";
import {
    errorMessage,
    statusCode,
    successMessage,
    userRoleConstant,
    ContentConstants,
    statusType,
    figmaSuccessMessage,
    course_type,
    notificationMessage,
    User_Activity
} from "../utils/const";
import {
    createOrGetUser,
    enrollCourse,
} from '../services/thinkific/thinkific.service';
import {
    aggregate,
    countDocuments,
    deleteMany,
    deleteOne,
    find,
    findOne,
    findOneAndUpdate,
    insertOne,
    updateMany
} from "../utils/db";
import { requestUser } from "../Interfaces/schemaInterfaces/user";
import { sendMsg } from "./Web/message.controller";
import config from "../utils/config";
import axios from "axios";
import jwt from 'jsonwebtoken';
import { sendNotification, sendPushNotification } from "./Web/notification.controller";

export let contentController = {

    getAllContents: async function (req: Request, res: Response) {
        try {
            const { search, isArchived, sort, page, limit } = req.body;
            let totalPage: number = page ? Number(page) : 1;
            let totalLimit: number = limit ? Number(limit) : 10;

            let request = req as requestUser
            let query: any = { isArchived: false };
            let sortQuery: any = { createdAt: -1 };

            if (isArchived != undefined) {
                const isArchivedBoolean = Boolean(JSON.parse(isArchived));
                query['isArchived'] = isArchivedBoolean;
            }

            if (sort != undefined) {
                const key = String(Object.keys(sort)[0]);

                if (key) {
                    sortQuery = {};

                    if (key == 'createdBy') {
                        sortQuery['createdBy.legalFname'] = String(Object.values(sort)) == "desc" ? -1 : 1;
                        sortQuery['createdBy.legalLname'] = String(Object.values(sort)) == "desc" ? -1 : 1;
                    } else if (key == 'partnerId') {
                        sortQuery['partnerOrRegionName'] = String(Object.values(sort)) == "desc" ? -1 : 1;
                    } else {
                        sortQuery[key] = String(Object.values(sort)) == "desc" ? -1 : 1;
                    }
                }
            }

            if (request.user.region) {
                query['regionId'] = request.user.region
            } else if (request.user.partnerAdmin) {
                query['partnerId'] = request.user.partnerAdmin
            }

            if (search) {
                query["fileName"] = new RegExp(req.body.search, "i");
            }

            const totalContents = await countDocuments({
                collection: 'Contents',
                query: query
            });

            let pipeLine = [
                {
                    $match: query
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
                    $lookup: {
                        from: 'partners',
                        localField: 'partnerId',
                        foreignField: '_id',
                        as: 'partnerId'
                    }
                },
                {
                    $unwind: {
                        path: '$partnerId',
                        preserveNullAndEmptyArrays: true
                    }
                },
                {
                    $lookup: {
                        from: 'regions',
                        localField: 'regionId',
                        foreignField: '_id',
                        as: 'regionId'
                    }
                },
                {
                    $unwind: {
                        path: '$regionId',
                        preserveNullAndEmptyArrays: true
                    }
                },
                {
                    $project: {
                        fileName: 1,
                        type: 1,
                        category: 1,
                        isArchived: 1,
                        contentFile: 1,
                        contentLink: 1,
                        thumbnailFile: 1,
                        createdAt: 1,
                        createdBy: {
                            legalFname: '$createdBy.legalFname',
                            legalLname: '$createdBy.legalLname',
                            _id: '$createdBy._id',
                            role: '$createdBy.role',
                            profilePic: '$createdBy.profilePic',
                            partnerOrRegion: { $ifNull: ['$partnerId', '$regionId'] }
                        },
                        partnerOrRegionName: { $ifNull: ['$partnerId.partnerName', '$regionId.region'] }
                    }
                },
                {
                    $sort: sortQuery
                },
                {
                    $skip: ((totalPage - 1) * totalLimit)
                },
                {
                    $limit: totalLimit
                },
            ];

            // let contents = await paginate({
            //   collection: 'Contents',
            //   query: query,
            //   options: {
            //     page: req.body?.page || 1,
            //     limit: req.body?.limit || 10,
            //     populate: [
            //       { path: 'regionId', select: 'region' },
            //       { path: 'partnerId', select: 'partnerName' },
            //       { path: 'createdBy', select: 'legalFname legalLname' }
            //     ],
            //     select: { fileName: 1, type: 1, category: 1, isArchived: 1, contentFile: 1, thumbnailFile: 1 },
            //     sort: sortQuery,
            //   }
            // });

            let contents = await aggregate({ collection: 'Contents', pipeline: pipeLine })

            const responseData = {
                docs: contents,
                total: totalContents,
                pages: Math.ceil(totalContents / totalLimit),
                limit: totalLimit,
                page: totalPage
            }

            const successMsg = successMessage.FETCH_SUCCESS.replace(":attribute", "Contents");

            res.send(success(successMsg, responseData, statusCode.OK));
        } catch (err: any) {
            logger.error("contentController > getAllContents ", err);
            const errorMsg = "There is some issue to get all contents.";

            res.status(statusCode.FORBIDDEN).send(error(errorMsg, err.message, statusCode.FORBIDDEN));
        }
    },

    getCourseList: async function (req: Request, res: Response) {
        try {
            var request = req as requestUser;
            var userRole = request.user.role;
            var { search, courseType, page, limit, isArchived, sort } = req.body;
            var totalPage: number = page ? Number(page) : 1;
            var totalLimit: number = limit ? Number(limit) : 10;
            var userAssignedCourses: any = [];

            if (isArchived) {
                isArchived = Boolean(JSON.parse(isArchived));
            }

            let sortQuery: any = { createdAt: -1 };

            if (!ContentConstants.ALLOWED_ALL_COURSES_USERS.includes(userRole)) {
                if (sort != undefined) {
                    const key = String(Object.keys(sort)[0]);

                    if (key) {
                        sortQuery = {};

                        if (key == 'createdAt') {
                            sortQuery['Courses.createdAt'] = String(Object.values(sort)) == "desc" ? -1 : 1;
                        } else if (key == 'name') {
                            sortQuery['Courses.courseName'] = String(Object.values(sort)) == "desc" ? -1 : 1;
                        } else {
                            sortQuery[`Courses.payload.${key}`] = String(Object.values(sort)) == "desc" ? -1 : 1;
                        }
                    }
                }

                let matchQuery: any = {
                    courseType: courseType,
                    partnerIdOrRegionId: request.user.partnerAdmin ?? request.user.region,
                };

                let pipeline: any = [
                    {
                        $match: matchQuery
                    },
                    // {
                    //   $sort: {
                    //     createdAt: -1
                    //   }
                    // },
                    {
                        $skip: ((totalPage - 1) * totalLimit)
                    },
                    {
                        $limit: totalLimit
                    },
                    {
                        $lookup: {
                            from: "thinkificcourses",
                            localField: "thinkificCourseId",
                            foreignField: "_id",
                            as: "Courses",
                        }
                    },
                    {
                        $unwind: {
                            path: "$Courses",
                            preserveNullAndEmptyArrays: false,
                        },
                    },
                    {
                        $match: {
                            "Courses.courseStatus": ContentConstants.ASSIGNED_COURSE_STATUS.published,
                            "Courses.isArchived": isArchived || false
                        }
                    },
                    {
                        $sort: sortQuery
                    },
                ];

                if (search) {
                    pipeline.push({ $match: { "Courses.courseName": new RegExp(search, 'i') } })
                }

                userAssignedCourses = await aggregate({
                    collection: 'AssignedCourses',
                    pipeline: pipeline
                });

                const totalDocs = userAssignedCourses.length;

                const responseData = {
                    thinkificAssetAccessUrl: process.env.THINKIFIC_ASSET_ACCESS_URL || '',
                    course: userAssignedCourses,
                    total: totalDocs,
                    pages: Math.ceil(totalDocs / totalLimit),
                    limit: totalLimit,
                    page: totalPage
                };

                const successMsg = successMessage.FETCH_SUCCESS.replace(":attribute", "Course list");
                res.send(success(successMsg, responseData, statusCode.OK));
            } else {
                let matchQuery: any = {
                    courseType: courseType,
                    courseStatus: ContentConstants.ASSIGNED_COURSE_STATUS.published,
                    isArchived: isArchived || false
                };

                if (sort != undefined) {
                    const key = String(Object.keys(sort)[0]);

                    if (key) {
                        sortQuery = {};
                        sortQuery[key] = String(Object.values(sort)) == "desc" ? -1 : 1;
                    }
                }

                if (search) {
                    matchQuery = {
                        ...matchQuery,
                        courseName: new RegExp(search, 'i')
                    }
                    // pipeline.push({ $match: { "name": new RegExp(search, 'i') } })
                }

                let totalCourses = await countDocuments({
                    collection: 'ThinkificCourses',
                    query: matchQuery
                });

                let pipeline: any = [
                    {
                        $match: matchQuery
                    },
                    // {
                    //   $sort: {
                    //     createdAt: -1
                    //   }
                    // },
                    {
                        $skip: ((totalPage - 1) * totalLimit)
                    },
                    {
                        $limit: totalLimit
                    },
                    {
                        $lookup: {
                            from: "assignedcourses",
                            localField: "_id",
                            foreignField: "thinkificCourseId",
                            as: "result"
                        }
                    },
                    {
                        $unwind: {
                            path: "$result",
                            preserveNullAndEmptyArrays: true
                        }
                    },
                    {
                        $group: {
                            _id: "$_id",
                            totalPartner: { $sum: { $cond: [{ $eq: ["$result.assignedUserType", "Partner"] }, 1, 0] } },
                            totalRegion: { $sum: { $cond: [{ $eq: ["$result.assignedUserType", "Region"] }, 1, 0] } },
                            name: { $first: "$courseName" },
                            courseId: { $first: "$courseId" },
                            courseCardImageUrl: { $first: "$courseCardImageUrl" },
                            bannerImageUrl: { $first: "$payload.banner_image_url" },
                            description: { $first: "$payload.description" },
                            slug: { $first: "$payload.slug" },
                            createdAt: { $first: "$createdAt" },
                            updatedAt: { $first: "$updatedAt" }
                        }
                    },
                    {
                        $project: {
                            name: 1,
                            courseId: 1,
                            courseCardImageUrl: 1,
                            bannerImageUrl: 1,
                            assignedUserType: 1,
                            description: 1,
                            slug: 1,
                            assignedCounts: {
                                partner: "$totalPartner",
                                region: "$totalRegion",
                            },
                            createdAt: 1,
                            updatedAt: 1
                        }
                    },
                    {
                        $sort: sortQuery
                    },
                ];

                let Courses = await aggregate({
                    collection: 'ThinkificCourses',
                    pipeline: pipeline
                });

                const responseData = {
                    thinkificAssetAccessUrl: process.env.THINKIFIC_ASSET_ACCESS_URL || '',
                    course: Courses,
                    total: totalCourses,
                    pages: Math.ceil(totalCourses / totalLimit),
                    limit: totalLimit,
                    page: totalPage
                };

                const successMsg = successMessage.FETCH_SUCCESS.replace(":attribute", "Course list");
                res.send(success(successMsg, responseData, statusCode.OK));

            }
        } catch (err: any) {

            logger.error("contentController > getCourseList ", err);
            const errorMsg = "There is some issue to get getCourseList.";

            res.status(statusCode.FORBIDDEN).send(error(errorMsg, err.message, statusCode.FORBIDDEN));
        }
    },

    assignCourse: async function (req: Request, res: Response) {
        try {
            const { courseIds, userIds, assignedUserType, courseType } = req.body;

            const isAllUniqueUsers = await !userIds.some((v: string, i: number) => userIds.indexOf(v) < i);

            if (!isAllUniqueUsers) {
                const errMsg = errorMessage.NOT_SAME.replace(':attribute', 'userIds');
                res.status(statusCode.BAD_REQUEST).send(error(errMsg, {}, statusCode.BAD_REQUEST))
                return
            }

            let users;

            if (assignedUserType == ContentConstants.ASSIGNED_USER_TYPES.partner) {
                users = await countDocuments({ collection: 'Partner', query: { _id: { $in: userIds } }, });
            } else {
                users = await countDocuments({ collection: 'Region', query: { _id: { $in: userIds } } });
            }

            // check is all courses exists or not
            const thinkificCourses = await countDocuments({
                collection: 'ThinkificCourses',
                query: {
                    _id: { $in: courseIds },
                    courseStatus: ContentConstants.ASSIGNED_COURSE_STATUS.published,
                    courseType: courseType
                }
            });

            if (courseIds.length != thinkificCourses) {
                const errMsg = errorMessage.INVALID.replace(':attribute', 'courseIds');
                res.status(statusCode.BAD_REQUEST).send(error(errMsg, {}, statusCode.BAD_REQUEST))
                return
            }

            if (userIds.length != users) {
                const errMsg = errorMessage.INVALID.replace(':attribute', 'userIds');
                res.status(statusCode.BAD_REQUEST).send(error(errMsg, {}, statusCode.BAD_REQUEST))
                return
            }

            const responseData = [];

            let message = ":attribute has been successfully assigned."

            if (courseType == course_type.CONTENT) {
                message = message.replace(':attribute', 'Content')
            }

            if (courseType == course_type.PROJECT) {
                message = message.replace(':attribute', 'Project')
            }

            if (courseType == course_type.TRAINING) {
                message = message.replace(':attribute', 'Training')
            }


            for (let i = 0; i < courseIds.length; i++) {
                for (let j = 0; j < userIds.length; j++) {

                    const userId = userIds[j];

                    let isDefaultCourse = false;

                    if (courseType == ContentConstants.COURSES_TYPE.training) {

                        const isFirstTraining = await countDocuments({
                            collection: 'AssignedCourses',
                            query: {
                                partnerIdOrRegionId: userId,
                                courseType: ContentConstants.COURSES_TYPE.training,
                                isDefaultCourse: true
                            },
                            project: { _id: 1 }
                        });

                        isDefaultCourse = isFirstTraining ? false : true
                    }

                    let alreadyAssignCourse = await findOne({
                        collection: 'AssignedCourses',
                        query: { partnerIdOrRegionId: userId, thinkificCourseId: courseIds[i] },
                    });

                    if (alreadyAssignCourse) {
                        await responseData.push(alreadyAssignCourse);
                    } else {
                        const assignedCourse = await insertOne({
                            collection: 'AssignedCourses',
                            document: {
                                thinkificCourseId: courseIds[i],
                                assignedUserType: assignedUserType,
                                partnerId: assignedUserType === "Partner" ? userId : null,
                                regionId: assignedUserType === "Region" ? userId : null,
                                courseType: courseType,
                                partnerIdOrRegionId: userId,
                                isDefaultCourse: false
                            }
                        });

                        await responseData.push(assignedCourse);
                    }

                    // const alreadyAssignCourse = await findOneAndUpdate({
                    //   collection: 'AssignedCourses',
                    //   query: { partnerIdOrRegionId: userId, thinkificCourseId: courseIds[i] },
                    //   update: {
                    //     $set: {

                    //     }
                    //   },
                    //   options: {
                    //     upsert: true,
                    //     new: true
                    //   }
                    // });


                }
            }

            res.send(success(message, responseData, statusCode.OK))

        } catch (err: any) {
            logger.error("contentController > assignCourse ", err);
            const errorMsg = "There is some issue to assignCourse.";

            res.status(statusCode.FORBIDDEN).send(error(errorMsg, err.message, statusCode.FORBIDDEN));
        }
    },

    archivedContent: async function (req: Request, res: Response) {
        try {
            const { contentId, isArchived } = req.body;
            const request = req as requestUser;
            const isArchivedBoolean = Boolean(JSON.parse(isArchived));
            const user = request.user;
            let partnerIdOrRegionId = user.partnerAdmin;

            if (!user.partnerAdmin) {
                partnerIdOrRegionId = user.region;
            }

            const isContentExists = await findOne({
                collection: 'Contents',
                query: { _id: contentId, partnerIdOrRegionId: partnerIdOrRegionId },
                project: { _id: 1 }
            });

            if (!isContentExists) {
                const errMsg = errorMessage.NOT_EXISTS.replace(':attribute', 'content');
                res.status(statusCode.BAD_REQUEST).send(error(errMsg, {}, statusCode.BAD_REQUEST))
                return
            }

            // check is content recommended to users or not.
            // const isContentRecommended = await findOne({
            //   collection: 'RecommendedCourses',
            //   query: { contentId: contentId },
            //   project: { _id: 1 }
            // });

            // if (isContentRecommended && isArchivedBoolean) {
            //   const errMsg = errorMessage.UNABLE_ARCHIVE.replace(':attribute', 'content');
            //   res.status(statusCode.BAD_REQUEST).send(error(errMsg, {}, statusCode.BAD_REQUEST))
            //   return
            // }

            const updatedRecommended = await updateMany({
                collection: 'RecommendedCourses',
                query: { contentId: contentId },
                update: { isArchived: isArchivedBoolean },
                options: { new: true }
            });

            const updatedContent = await findOneAndUpdate({
                collection: 'Contents',
                query: { _id: contentId },
                update: { isArchived: isArchivedBoolean },
                options: { new: true }
            });

            let successMsg = successMessage.ARCHIVE_SUCCESS.replace(':attribute', 'Content');

            if (!isArchivedBoolean) {
                successMsg = successMessage.UNARCHIVE_SUCCESS.replace(':attribute', 'Content');
            }

            res.send(success(successMsg, { ...updatedContent, contentId, isAuditLog: true, audit: isArchivedBoolean ? User_Activity.CONTENT_ARCHIVED : User_Activity.CONTENT_UNARCHIVED }, statusCode.OK))
        } catch (err: any) {
            logger.error("contentController > archivedContent ", err);
            const errorMsg = "There is some issue to archived content.";

            res.status(statusCode.FORBIDDEN).send(error(errorMsg, err.message, statusCode.FORBIDDEN));
        }
    },

    removeContent: async function (req: Request, res: Response) {
        try {
            const { contentId } = req.body;
            const request = req as requestUser;
            const user = request.user;
            let partnerIdOrRegionId = user.partnerAdmin;

            if (!user.partnerAdmin) {
                partnerIdOrRegionId = user.region;
            }

            const isContentExists = await findOne({
                collection: 'Contents',
                query: { _id: contentId, partnerIdOrRegionId: partnerIdOrRegionId },
                project: { _id: 1 }
            });

            if (!isContentExists) {
                const errMsg = errorMessage.NOT_EXISTS.replace(':attribute', 'content');
                res.status(statusCode.BAD_REQUEST).send(error(errMsg, {}, statusCode.BAD_REQUEST))
                return
            }

            // check is content recommended to users or not.
            // const isContentRecommended = await findOne({
            //   collection: 'RecommendedCourses',
            //   query: { contentId: contentId },
            //   project: { _id: 1 }
            // });

            // if (isContentRecommended) {
            //   const errMsg = errorMessage.UNABLE_REMOVE.replace(':attribute', 'content');
            //   res.status(statusCode.BAD_REQUEST).send(error(errMsg, {}, statusCode.BAD_REQUEST))
            //   return
            // }

            // Delete recommended records
            const deleteRecommended = await deleteMany({
                collection: 'RecommendedCourses',
                query: { contentId: contentId }
            });

            // Delete messages records
            const deleteMessages = await deleteMany({
                collection: 'Messages',
                query: { contentId: contentId }
            });


            const deleteContent = await deleteOne({
                collection: 'Contents',
                query: { _id: contentId }
            });

            let successMsg = figmaSuccessMessage.REMOVE_SUCCESS.replace(':attribute', 'Content');
            res.send(success(successMsg, { ...isContentExists, contentId, isAuditLog: true, audit: User_Activity.CONTENT_REMOVED }, statusCode.OK))
        } catch (err: any) {
            logger.error("contentController > deleteContent ", err);
            const errorMsg = "There is some issue to delete content.";

            res.status(statusCode.FORBIDDEN).send(error(errorMsg, err.message, statusCode.FORBIDDEN));
        }
    },

    archivedCourse: async function (req: Request, res: Response) {
        try {
            const { thinkificCourseId, isArchived } = req.body;
            const isArchivedBoolean = Boolean(JSON.parse(isArchived));

            const isCourseExists = await findOne({
                collection: 'ThinkificCourses',
                query: { _id: thinkificCourseId },
                project: { _id: 1 }
            });

            if (!isCourseExists) {
                const errMsg = errorMessage.NOT_EXISTS.replace(':attribute', 'course');
                res.status(statusCode.BAD_REQUEST).send(error(errMsg, {}, statusCode.BAD_REQUEST))
                return
            }

            // check is course assigned to users or not.
            const isContentAssigned = await findOne({
                collection: 'AssignedCourses',
                query: { thinkificCourseId: thinkificCourseId },
                project: { _id: 1 }
            });

            if (isContentAssigned && isArchivedBoolean) {
                const errMsg = errorMessage.UNABLE_ARCHIVE.replace(':attribute', 'course');
                res.status(statusCode.BAD_REQUEST).send(error(errMsg, {}, statusCode.BAD_REQUEST))
                return
            }

            const updatedContent = await findOneAndUpdate({
                collection: 'ThinkificCourses',
                query: { _id: thinkificCourseId },
                update: { isArchived: isArchivedBoolean },
                options: { new: true }
            });

            let successMsg = successMessage.ARCHIVE_SUCCESS.replace(':attribute', 'Course');

            if (!isArchivedBoolean) {
                successMsg = successMessage.UNARCHIVE_SUCCESS.replace(':attribute', 'Course');
            }

            res.send(success(successMsg, { ...updatedContent, courseId: thinkificCourseId, isAuditLog: true, audit: isArchivedBoolean ? User_Activity.COURSE_ARCHIVED : User_Activity.COURSE_UNARCHIVED }, statusCode.OK))
        } catch (err: any) {
            logger.error("contentController > archivedCourse ", err);
            const errorMsg = "There is some issue to archived course.";

            res.status(statusCode.FORBIDDEN).send(error(errorMsg, err.message, statusCode.FORBIDDEN));
        }
    },

    getAssignedCourseUsers: async function (req: Request, res: Response) {
        try {
            const { thinkificCourseId, courseType } = req.body;
            let { assignedUserType } = req.body;

            let assignedPartners: any = [];
            let assignedRegions: any = [];

            const PARTNER = ContentConstants.ASSIGNED_USER_TYPES.partner;
            const REGION = ContentConstants.ASSIGNED_USER_TYPES.region;

            if (assignedUserType == undefined) {
                assignedPartners = await find({
                    collection: 'AssignedCourses',
                    query: {
                        thinkificCourseId: thinkificCourseId, assignedUserType: PARTNER, courseType: courseType
                    },
                    populate: { path: 'partnerId', select: 'partnerName logo isDel' }
                });

                assignedRegions = await find({
                    collection: 'AssignedCourses',
                    query: { thinkificCourseId: thinkificCourseId, assignedUserType: REGION, courseType: courseType },
                    populate: { path: 'regionId', select: 'region city isDel' }
                });

            } else if (assignedUserType == PARTNER) {
                assignedPartners = await find({
                    collection: 'AssignedCourses',
                    query: { thinkificCourseId: thinkificCourseId, assignedUserType: PARTNER, courseType: courseType },
                    populate: { path: 'partnerId', select: 'partnerName logo isDel' }
                });
            } else if (assignedUserType == REGION) {
                assignedRegions = await find({
                    collection: 'AssignedCourses',
                    query: { thinkificCourseId: thinkificCourseId, assignedUserType: REGION, courseType: courseType },
                    populate: { path: 'regionId', select: 'region city isDel' }
                });
            }

            const responseData = {
                assignedPartners: assignedPartners,
                assignedRegions: assignedRegions
            };

            const successMsg = successMessage.FETCH_SUCCESS.replace(":attribute", "Assigned users");
            res.send(success(successMsg, responseData, statusCode.OK));
        } catch (err: any) {
            logger.error("contentController > getAssignedCourseUsers ", err);
            const errorMsg = "There is some issue to get getAssignedCourseUsers.";

            res.status(statusCode.FORBIDDEN).send(error(errorMsg, err.message, statusCode.FORBIDDEN));
        }
    },

    recommendedCourse: async function (req: Request, res: Response) {
        try {
            const { mentorMenteesIds, courseIds, courseType, message, groupIds, pairIds } = req.body;
            const request = req as requestUser;
            const user = request.user;
            let partnerIdOrRegionId: any = user.partnerAdmin;

            let queryOwnUsers: any = {
                partnerAdmin: user.partnerAdmin
            };

            if (!user.partnerAdmin) {
                partnerIdOrRegionId = user.region;

                queryOwnUsers = {
                    region: user.region
                }
            }

            let usersList: any = [];

            let totalArrayLength = 0;

            if (pairIds && pairIds.length > 0) {
                totalArrayLength = totalArrayLength + pairIds.length;
            }

            if (groupIds && groupIds.length > 0) {
                totalArrayLength = totalArrayLength + groupIds.length;
            }

            if (mentorMenteesIds && mentorMenteesIds.length > 0) {
                totalArrayLength = totalArrayLength + mentorMenteesIds.length;
            }

            // check is one user recommended or not
            if (totalArrayLength <= 0) {
                const errMsg = errorMessage.ATLEAST_VALUE.replace(':value', 'one user')
                    .replace(':action', 'assigned this course');
                res.status(statusCode.BAD_REQUEST).send(error(errMsg, {}, statusCode.BAD_REQUEST))
                return
            }

            // check course id exists or not
            if (
                courseType == ContentConstants.COURSES_TYPE.training ||
                courseType == ContentConstants.COURSES_TYPE.project
            ) {
                // check is course assigned to requested user.
                const assignedCourses = await find({
                    collection: 'AssignedCourses',
                    query: {
                        thinkificCourseId: { $in: courseIds },
                        courseType,
                        partnerIdOrRegionId: partnerIdOrRegionId,
                    },
                    project: { _id: 1, courseId: 1 }
                });


                if (assignedCourses.length != courseIds.length) {
                    const errMsg = errorMessage.NOT_PERFOME_ACTION.replace(':attribute', 'You')
                        .replace(':action', 'assigned this course');
                    res.status(statusCode.BAD_REQUEST).send(error(errMsg, {}, statusCode.BAD_REQUEST))
                    return
                }
            } else { //  this parts run when course type = content for check all course exists
                const contents = await find({
                    collection: 'Contents',
                    query: {
                        _id: { $in: courseIds },
                        partnerIdOrRegionId: partnerIdOrRegionId
                    },
                    project: { _id: 1 }
                });

                if (contents.length != courseIds.length) {
                    const errMsg = errorMessage.NOT_PERFOME_ACTION.replace(':attribute', 'You')
                        .replace(':action', 'assigned this contents');
                    res.status(statusCode.BAD_REQUEST).send(error(errMsg, {}, statusCode.BAD_REQUEST))
                    return
                }
            }

            // check mentor mentees ids exist or not
            if (mentorMenteesIds && mentorMenteesIds.length > 0) {
                const getMentorMenteesQuery = {
                    ...queryOwnUsers,
                    _id: { $in: mentorMenteesIds },
                    role: { $in: [userRoleConstant.MENTOR, userRoleConstant.MENTEE] },
                    isDel: false,
                    status: { $in: [statusType.COMPLETED, statusType.MATCHING, statusType.MATCHED] }
                }

                // check all users exists into database
                const mentorsMentees = await find({
                    collection: 'User',
                    query: getMentorMenteesQuery,
                    project: {
                        _id: 1,
                        email: 1,
                        thinkificUserId: 1,
                        legalFname: 1,
                        legalLname: 1,
                        region: 1,
                        partnerAdmin: 1,
                        preferredFname: 1,
                        preferredLname: 1
                    }
                });

                if (mentorMenteesIds.length != mentorsMentees.length) {
                    const errMsg = errorMessage.INVALID.replace(':attribute', 'mentorMenteesIds');
                    res.status(statusCode.BAD_REQUEST).send(error(errMsg, {}, statusCode.BAD_REQUEST))
                    return
                } else {
                    usersList = mentorsMentees;
                }
            }

            // check is pairs is valid
            if (pairIds && pairIds.length > 0) {
                let pairQuery: any = {
                    _id: { $in: pairIds },
                    isDel: false,
                    isArchive: false,
                    partnerIdOrRegionId: partnerIdOrRegionId
                };

                const pairs = await find({
                    collection: 'PairInfo',
                    query: pairQuery,
                    project: { _id: 1, menteeId: 1, mentorId: 1 },
                    populate: [
                        {
                            path: 'menteeId',
                            select: '_id email thinkificUserId legalFname legalLname partnerAdmin region preferredFname preferredLname'
                        },
                        {
                            path: 'mentorId',
                            select: '_id email thinkificUserId legalFname legalLname partnerAdmin region preferredFname preferredLname'
                        }
                    ]
                });

                if (pairs.length != pairIds.length) {
                    const errMsg = errorMessage.NOT_PERFOME_ACTION.replace(':attribute', 'You')
                        .replace(':action', 'assigned this pair');
                    res.status(statusCode.BAD_REQUEST).send(error(errMsg, {}, statusCode.BAD_REQUEST))
                    return
                } else {
                    for (let x = 0; x < pairs.length; x++) {
                        const mentee = pairs[x].menteeId;
                        const mentor = pairs[x].mentorId;

                        if (mentee) {
                            const foundMentee = await usersList.some((user: any) => user._id.toString() == mentee._id.toString());

                            if (!foundMentee) {
                                await usersList.push(mentee);
                            }
                        }

                        if (mentor) {
                            const foundMentor = await usersList.some((user: any) => user._id.toString() == mentor._id.toString());

                            if (!foundMentor) {
                                await usersList.push(mentor);
                            }
                        }
                    }
                }
            }

            // check is valid group ids or not
            if (groupIds && groupIds.length > 0) {
                let groupQuery: any = {
                    _id: { $in: groupIds },
                    isDel: false,
                    isArchived: false,
                };

                if (user.partnerAdmin) {
                    groupQuery['partner'] = partnerIdOrRegionId;
                } else if (request.user.region) {
                    groupQuery['region'] = partnerIdOrRegionId;
                }

                const groups = await find({
                    collection: 'Group',
                    query: groupQuery,
                    project: { _id: 1, groupMember: 1 },
                    populate: {
                        path: 'groupMember',
                        select: '_id email thinkificUserId legalFname legalLname partnerAdmin, region preferredFname preferredLname'
                    }
                });

                if (groups.length != groupIds.length) {
                    const errMsg = errorMessage.NOT_PERFOME_ACTION.replace(':attribute', 'You')
                        .replace(':action', 'assigned this group');
                    res.status(statusCode.BAD_REQUEST).send(error(errMsg, {}, statusCode.BAD_REQUEST))
                    return
                } else {
                    for (let y = 0; y < groups.length; y++) {
                        const groupMember = groups[y].groupMember;

                        if (groupMember && groupMember.length > 0) {
                            for (let z = 0; z < groupMember.length; z++) {
                                const member = groupMember[z];

                                if (member) {
                                    const foundMember = await usersList.some((user: any) => user._id.toString() == member._id.toString());

                                    if (!foundMember) {
                                        await usersList.push(member);
                                    }
                                }
                            }
                        }
                    }
                }
            }

            const invalidCourseIds: any = [];
            const enrolls: any = [];
            let enrollData: any = [];

            for (let i = 0; i < courseIds.length; i++) {
                const courseId = courseIds[i];

                if (
                    courseType == ContentConstants.COURSES_TYPE.training ||
                    courseType == ContentConstants.COURSES_TYPE.project
                ) {
                    // check is course exists
                    const course = await findOne({
                        collection: "ThinkificCourses",
                        query: { _id: courseId }
                    });

                    if (!course) {
                        invalidCourseIds.push(courseId);
                        continue;
                    }

                    // const getCourseType = await getCourseTypeFromKeywords(course.keywords);

                    // if (courseType != getCourseType) {
                    //   invalidCourseIds.push(courseId);
                    //   continue;
                    // }

                    // enroll user
                    // As of now I create thinkific userId in this api but its create into create mentor or mentee.
                    const enrollMentorMenteesData = {
                        courseId,
                        users: usersList,
                        courseType,
                        requestedUserId: user._id,
                        requestedUserRole: user.role,
                        course: course,
                        message,
                        thinkificCourseId: course._id,
                        course_name: course.courseName
                    };

                    enrollData = await enrollUserToThinkific(enrollMentorMenteesData);
                } else { // this parts exucute when course type = content
                    const contentId = courseId;

                    const enrollMentorMenteesData = {
                        contentId,
                        users: usersList,
                        courseType,
                        requestedUserId: user._id,
                        message
                    };

                    enrollData = await enrollUserToContent(enrollMentorMenteesData);
                }

                const obj = {
                    courseId: courseId,
                    enrollData: enrollData
                };

                enrolls.push(obj);
            }

            const responseData = {
                enrolls,
                invalidCourseIds
            }

            const successMsg = figmaSuccessMessage.RECOMMENDED_SUCCESS;

            res.send(success(successMsg, responseData, statusCode.OK));
        } catch (err: any) {
            logger.error("contentController > recommendedCourse ", err);
            const errorMsg = "There is some issue to recommendedCourse.";

            res.status(statusCode.FORBIDDEN).send(error(errorMsg, err.message, statusCode.FORBIDDEN));
        }
    },

    createContent: async function (req: Request, res: Response) {
        try {
            const { fileName, category, type, contentFile, thumbnailFile, contentLink } = req.body;
            const request = req as requestUser;
            const user = request.user;

            const partnerId = user.partnerAdmin;
            const regionId = user.region;
            const createdBy = user._id;

            let partnerIdOrRegionId: any = partnerId;

            if (!partnerId) {
                partnerIdOrRegionId = regionId;
            }

            const insertData = {
                fileName,
                category,
                type,
                contentFile,
                regionId,
                partnerId,
                partnerIdOrRegionId,
                createdBy,
                thumbnailFile,
                contentLink
            };

            const content = await insertOne({
                collection: 'Contents',
                document: insertData
            });

            const successMsg = figmaSuccessMessage.CREATE_SUCCESS.replace(":attribute", "Content");

            res.send(success(successMsg, { ...content, contentId: content._id, isAuditLog: true, audit: User_Activity.CREATE_NEW_CONTENT }, statusCode.OK));
        } catch (err: any) {
            logger.error("contentController > createContent ", err);
            const errorMsg = "There is some issue to createContent.";

            res.status(statusCode.FORBIDDEN).send(error(errorMsg, err.message, statusCode.FORBIDDEN));
        }
    },

    setDefaultCourse: async function (req: Request, res: Response) {
        try {
            const { thinkificCourseId } = req.body;
            const request = req as requestUser;
            const user = request.user;

            let partnerIdOrRegionId: any = user.partnerAdmin;

            if (!user.partnerAdmin) {
                partnerIdOrRegionId = user.region;
            }

            const trainingType = ContentConstants.COURSES_TYPE.training;

            // check is course assigned
            const assignedCourse = await findOne({
                collection: 'AssignedCourses',
                query: {
                    partnerIdOrRegionId: partnerIdOrRegionId,
                    thinkificCourseId: thinkificCourseId,
                    courseType: trainingType,
                    isDefaultCourse: { $ne: true }
                },
                project: { _id: 1 }
            });

            if (!assignedCourse) {
                const errMsg = errorMessage.INVALID.replace(':attribute', 'thinkificCourseId');
                res.status(statusCode.BAD_REQUEST).send(error(errMsg, {}, statusCode.BAD_REQUEST))
                return
            }

            // check if any mentor in completed existing course
            const currentDefaultCourse = await findOne({
                collection: 'AssignedCourses',
                query: {
                    partnerIdOrRegionId: partnerIdOrRegionId,
                    courseType: trainingType,
                    isDefaultCourse: true
                },
                project: { _id: 1, thinkificCourseId: 1 }
            });

            if (currentDefaultCourse) {
                // check is any recomended course is un complete
                const checkCompletedData = {
                    partnerIdOrRegionId: partnerIdOrRegionId,
                    thinkificCourseId: currentDefaultCourse.thinkificCourseId,
                }

                const isCompletedByMentors = await checkIsCourseCompletedByMentor(checkCompletedData);

                if (!isCompletedByMentors) {
                    const errMsg = errorMessage.UNABLE_SET_DEFAULT_TRAINING;
                    res.status(statusCode.BAD_REQUEST).send(error(errMsg, {}, statusCode.BAD_REQUEST))
                    return
                }

                // update current default course to false
                const oldCourse = await findOneAndUpdate({
                    collection: 'AssignedCourses',
                    query: { _id: currentDefaultCourse._id },
                    update: { isDefaultCourse: false },
                    options: { new: true }
                });
            }

            // update current default course to true
            const newCourse = await findOneAndUpdate({
                collection: 'AssignedCourses',
                query: {
                    partnerIdOrRegionId: partnerIdOrRegionId,
                    thinkificCourseId: thinkificCourseId,
                    courseType: trainingType,
                    isDefaultCourse: { $ne: true }
                },
                update: { isDefaultCourse: true },
                options: { new: true }
            });

            const successMsg = successMessage.UPDATE_SUCCESS.replace(":attribute", "Default training");
            res.send(success(successMsg, { ...newCourse, courseId: thinkificCourseId, isAuditLog: true, audit: User_Activity.SET_DEFAULT_COURSE }, statusCode.OK));
        } catch (err: any) {
            logger.error("contentController > setDefaultCourse ", err);
            const errorMsg = "There is some issue to setDefaultCourse.";

            res.status(statusCode.FORBIDDEN).send(error(errorMsg, err.message, statusCode.FORBIDDEN));
        }
    },

    updateContent: async function (req: Request, res: Response) {
        try {
            const { contentId, fileName, category, type, contentFile, thumbnailFile, contentLink } = req.body;
            const request = req as requestUser;
            const user = request.user;

            let partnerIdOrRegionId: any = user.partnerAdmin;

            if (!user.partnerAdmin) {
                partnerIdOrRegionId = user.region;
            }

            const content = await findOne({
                collection: 'Contents',
                query: { _id: contentId, partnerIdOrRegionId: partnerIdOrRegionId },
                project: { _id: 1 }
            });

            if (!content) {
                const errMsg = errorMessage.NOT_EXISTS.replace(':attribute', 'content');
                res.status(statusCode.BAD_REQUEST).send(error(errMsg, {}, statusCode.BAD_REQUEST))
                return
            }

            const partnerId = user.partnerAdmin;
            const regionId = user.region;

            const updateData = {
                fileName,
                category,
                type,
                contentFile,
                regionId,
                partnerId,
                partnerIdOrRegionId,
                thumbnailFile,
                contentLink
            };

            const updatedContent = await findOneAndUpdate({
                collection: 'Contents',
                query: { _id: contentId, partnerIdOrRegionId: partnerIdOrRegionId },
                update: { $set: updateData },
                options: { new: true }
            });

            const successMsg = successMessage.UPDATE_SUCCESS.replace(":attribute", "Content");

            res.send(success(successMsg, { ...updatedContent, contentId, isAuditLog: true, audit: User_Activity.CONTENT_UPDATED }, statusCode.OK));
        } catch (err: any) {
            logger.error("contentController > updateContent ", err);
            const errorMsg = "There is some issue to update content.";

            res.status(statusCode.FORBIDDEN).send(error(errorMsg, err.message, statusCode.FORBIDDEN));
        }
    },

    // enrollUser: async function (req: Request, res: Response) {
    //   try {
    //     const { userId, courseId } = req.body;

    //     const activatedAt = new Date().toISOString();

    //     const enrollData = {
    //       userId: userId.toString(),
    //       courseId: courseId.toString() ,
    //       activatedAt
    //     };

    //     const enroll = await enrollCourse(enrollData);

    //     res.send(success("create Success", enroll, statusCode.OK));
    //   } catch (err: any) {
    //     // console.log('err : ', err);
    //     // logger.error("contentController > createUser ", err);
    //     const errorMsg = "There is some issue to enroll. : " + err.message;

    //     res.status(statusCode.FORBIDDEN).send(error(errorMsg, err, statusCode.FORBIDDEN));
    //   }
    // },
    recommandUserList: async (req: Request, res: Response) => {
        try {
            let request = req as requestUser;
            const { contentType, contentId } = req.body;

            let query: any = {
                isDel: false,
                status: { $nin: [statusType.DRAFT, statusType.IN_PROGRESS, statusType.INVITED, statusType.MATCHED_NOT_REGISTERED, statusType.NOT_STARTED] },
                role: { $in: [userRoleConstant.MENTEE, userRoleConstant.MENTOR] }
            }

            let groupQuery: any = {
                isDel: false,
                isArchived: false
            };

            let pairQuery: any = {
                isDel: false,
                isArchive: false,
                isConfirm: true
            }

            if (request.user.partnerAdmin) {
                query['partnerAdmin'] = request.user.partnerAdmin;
                groupQuery['partner'] = request.user.partnerAdmin;
                pairQuery['partnerIdOrRegionId'] = request.user.partnerAdmin;
            } else if (request.user.region) {
                query['region'] = request.user.region;
                groupQuery['region'] = request.user.region;
                pairQuery['partnerIdOrRegionId'] = request.user.region;
            }

            if (req.body.search) {
                query['$or'] = [
                    { legalFname: new RegExp(req.body.search, 'i') },
                    { legalLname: new RegExp(req.body.search, 'i') }
                ]
            }

            let userList = await find({
                collection: 'User',
                query: query,
                project: {
                    'legalFname': 1,
                    'legalLname': 1,
                    'profilePic': 1,
                    'role': 1,
                    'preferredFname': 1,
                    'preferredLname': 1,
                    'status': 1,
                    'onboardingStep': 1
                }
            });

            const groupList = await find({
                collection: 'Group',
                query: groupQuery,
                project: { groupName: 1, groupMember: 1 }
            });

            const pairList = await find({
                collection: 'PairInfo',
                query: pairQuery,
                project: { partner: 1, menteeId: 1, mentorId: 1 },
                sort: { updatedAt: -1 },
                populate: [
                    { path: 'menteeId', select: 'legalFname legalLname preferredFname preferredLname profilePic role' },
                    { path: 'mentorId', select: 'legalFname legalLname preferredFname preferredLname profilePic role' }
                ]
            });

            let isRecommendedQuery = {};

            // check is is content recommeded or not
            if (contentType && contentId) {
                if (contentType == ContentConstants.COURSES_TYPE.content) {
                    isRecommendedQuery = {
                        ...isRecommendedQuery,
                        contentId: contentId
                    }
                } else {
                    isRecommendedQuery = {
                        ...isRecommendedQuery,
                        thinkificCourseId: contentId
                    }
                }
            }

            const roleGroupList: any = [];
            const rolePairList: any = [];
            const roleUserList: any = [];

            for (let i = 0; i < groupList.length; i++) {
                const group = groupList[i];
                let isRecommeded = false;

                if (contentType && contentId && group) {
                    isRecommendedQuery = {
                        ...isRecommendedQuery,
                        userId: { $in: group.groupMember },
                    };

                    const recommeded = await find({
                        collection: 'RecommendedCourses',
                        query: isRecommendedQuery,
                    });

                    if (recommeded.length >= group.groupMember.length) {
                        isRecommeded = true;
                    }
                }

                group['role'] = 'Group';
                group['isRecommeded'] = isRecommeded;
                await roleGroupList.push(group);
            }

            for (let j = 0; j < pairList.length; j++) {
                const pair = pairList[j];
                let isRecommeded = false;

                if (contentType && contentId && pair && pair.menteeId && pair.mentorId) {
                    isRecommendedQuery = {
                        ...isRecommendedQuery,
                        userId: { $in: [pair.menteeId._id, pair.mentorId._id] },
                    };

                    const recommeded = await find({
                        collection: 'RecommendedCourses',
                        query: isRecommendedQuery,
                    });

                    if (recommeded.length >= 2) {
                        isRecommeded = true;
                    }
                }

                pair['role'] = 'Pair';
                pair['isRecommeded'] = isRecommeded;
                await rolePairList.push(pair);
            }

            for (let k = 0; k < userList.length; k++) {
                const user = userList[k];
                let isRecommeded = false;

                if (contentType && contentId) {
                    isRecommendedQuery = {
                        ...isRecommendedQuery,
                        userId: user._id
                    };

                    const recommeded = await findOne({
                        collection: 'RecommendedCourses',
                        query: isRecommendedQuery,
                    });

                    if (recommeded) {
                        isRecommeded = true;
                    }
                }

                user['isRecommeded'] = isRecommeded;
                await roleUserList.push(user);
            }

            const responseData = {
                userList: roleUserList,
                groupList: roleGroupList,
                pairList: rolePairList
            }

            res.send(success(successMessage.FETCH_SUCCESS.replace(":attribute", "RecommandedUserList"), responseData, statusCode.OK))
        } catch (err: any) {
            res.status(statusCode.FORBIDDEN).send(error("There is some issue at during fetching recommanded user list.", err.message, statusCode.FORBIDDEN))
        }
    },

    unAssignCourse: async function (req: Request, res: Response) {
        try {
            const { thinkificCourseId, assignedUserType, partnerIdOrRegionId } = req.body;

            const assignedCourse = await findOne({
                collection: 'AssignedCourses',
                query: {
                    thinkificCourseId: thinkificCourseId,
                    partnerIdOrRegionId: partnerIdOrRegionId,
                    assignedUserType: assignedUserType
                },
                project: { _id: 1, isDefaultCourse: 1, courseType: 1 }
            });

            if (!assignedCourse) {
                const errMsg = errorMessage.NOT_EXISTS.replace(':attribute', 'course');
                res.status(statusCode.BAD_REQUEST).send(error(errMsg, {}, statusCode.BAD_REQUEST))
                return
            }

            let isMakeNewDefaultCourse = false;
            let newDefaultTrainings;

            // check is course type is training and default course
            if (assignedCourse.isDefaultCourse && assignedCourse.courseType == ContentConstants.COURSES_TYPE.training) {
                // check is another training exists
                isMakeNewDefaultCourse = true;

                newDefaultTrainings = await findOne({
                    collection: 'AssignedCourses',
                    query: {
                        thinkificCourseId: { $ne: thinkificCourseId },
                        partnerIdOrRegionId: partnerIdOrRegionId,
                        assignedUserType: assignedUserType
                    },
                    project: { _id: 1 },
                    sort: { createdAt: 1 }
                });

                if (!newDefaultTrainings) {
                    const errMsg = errorMessage.UNABLE_UNASSIGN_TRAINING;
                    res.status(statusCode.BAD_REQUEST).send(error(errMsg, {}, statusCode.BAD_REQUEST))
                    return
                }
            }

            // check is any recomended course is un complete
            const checkCompletedData = {
                partnerIdOrRegionId: partnerIdOrRegionId,
                thinkificCourseId: thinkificCourseId,
            }

            const isCompletedByMentors = await checkIsCourseCompletedByMentor(checkCompletedData);

            if (!isCompletedByMentors) {
                const errMsg = errorMessage.UNABLE_SET_DEFAULT_TRAINING;
                res.status(statusCode.BAD_REQUEST).send(error(errMsg, {}, statusCode.BAD_REQUEST))
                return
            }

            // check is isMakeNewDefaultCourse
            if (isMakeNewDefaultCourse && newDefaultTrainings) {
                const newDefaultCourse = await findOneAndUpdate({
                    collection: 'AssignedCourses',
                    query: {
                        _id: newDefaultTrainings._id
                    },
                    update: { isDefaultCourse: true },
                    options: { new: true }
                });
            }

            const deletedResult = await deleteOne({
                collection: 'AssignedCourses',
                query: {
                    thinkificCourseId: thinkificCourseId,
                    partnerIdOrRegionId: partnerIdOrRegionId,
                    assignedUserType: assignedUserType
                }
            });

            const responseData = {
                unAssignedCourse: assignedCourse,
                isMakeNewDefaultCourse,
                newDefaultTrainings
            }

            let successMsg = successMessage.UNASSIGN_SUCCESS.replace(':attribute', 'Course');

            res.send(success(successMsg, responseData, statusCode.OK))
        } catch (err: any) {
            logger.error("contentController > unAssignCourse ", err);
            const errorMsg = "There is some issue to unAssign course.";

            res.status(statusCode.FORBIDDEN).send(error(errorMsg, err.message, statusCode.FORBIDDEN));
        }
    },

    getThinkificCoursesForDropdown: async function (req: Request, res: Response) {
        try {
            let { courseType, isArchived } = req.body;

            let matchQuery: any = {
                courseType: courseType,
                courseStatus: ContentConstants.ASSIGNED_COURSE_STATUS.published
            };

            if (isArchived) {
                isArchived = Boolean(JSON.parse(isArchived));

                matchQuery = {
                    ...matchQuery,
                    isArchived: isArchived
                }
            }

            let courses = await find({
                collection: 'ThinkificCourses',
                query: matchQuery,
                project: { courseName: 1, isArchived: 1 }
            });

            // courses.map((course: any) => {
            //   course.label = course.courseName;
            //   course.value = course._id;

            //   return course;
            // });


            const responseData = {
                course: courses
            };

            const successMsg = successMessage.FETCH_SUCCESS.replace(":attribute", "Courses");
            res.send(success(successMsg, responseData, statusCode.OK));
        } catch (err: any) {

            logger.error("contentController > getThinkificCoursesForDropdown ", err);
            const errorMsg = "There is some issue to get getThinkificCoursesForDropdown.";

            res.status(statusCode.FORBIDDEN).send(error(errorMsg, err.message, statusCode.FORBIDDEN));
        }
    },

    getContentURL: async (req: Request, res: Response) => {
        try {
            let request = req as requestUser;

            const { courseId } = req.body;

            let userObj = await findOne({
                collection: "User",
                query: { _id: request.user._id, role: request.user.role }
            });

            if (!userObj) {
                res.status(statusCode.BAD_REQUEST).send(success(errorMessage.NOT_EXISTS.replace(":attribute", "User"), {}, statusCode.BAD_REQUEST));
                return
            }

            if (userObj.thinkificUserId == undefined) {

                // Create new user in thinkific third party api and tht user id set in user collection
                const userDetail: any = {
                    email: userObj.email,
                    firstName: userObj.preferredFname,
                    lastName: userObj.preferredLname
                };

                const thinkificUser = await createOrGetUser(userDetail);

                userObj = await findOneAndUpdate({
                    collection: "User",
                    query: { _id: request.user._id, role: request.user.role },
                    update: { $set: { thinkificUserId: thinkificUser.id } },
                    options: { new: true }
                });

            }

            let getCourse = await findOne({
                collection: "ThinkificCourses",
                query: { courseId: courseId, courseStatus: "published" }
            });

            if (!getCourse && getCourse == null) {
                res.status(statusCode.BAD_REQUEST).send(success(errorMessage.NOT_EXISTS.replace(":attribute", "Assign course"), {}, statusCode.BAD_REQUEST));
                return
            }

            // Check login user already enroll or not in default course
            let recommendedCourse = await findOne({
                collection: "RecommendedCourses",
                query: { thinkificCourseId: getCourse._id, userId: request.user._id },
                populate: [
                    {
                        path: "thinkificCourseId"
                    }
                ]
            });

            if (!recommendedCourse && recommendedCourse == null) {

                // Enroll in course thinkific third party api
                const enrollDetail: any = {
                    userId: userObj.thinkificUserId,
                    courseId: getCourse.courseId,
                    activatedAt: new Date().toISOString()
                };

                const enrollCourseDetail = await enrollCourse(enrollDetail);

                recommendedCourse = await insertOne({
                    collection: "RecommendedCourses",
                    document: {
                        thinkificCourseId: getCourse._id,
                        courseId: getCourse.courseId,
                        userId: request.user._id,
                        courseType: getCourse.courseType,
                        enrollId: enrollCourseDetail.id,
                        bannerImageUrl: getCourse.bannerImageUrl,
                        courseCardImageUrl: getCourse.courseCardImageUrl,
                        isDefaultCourse: false,
                        partnerIdOrRegionId: request.user.partnerAdmin ? request.user.partnerAdmin : request.user.region
                    }
                });

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
                    first_name: userObj.legalFname,
                    last_name: userObj.legalLname,
                    iat: Math.floor(Date.now() / 1000) - 30,
                    locale: "en-US"
                }, config.THINKIFIC.KEY);

                const courseURL = config.THINKIFIC.COURSE_URL + response.data.slug;

                const redirectURL = config.THINKIFIC.BASE_URL + token + '&return_to=' + courseURL + '&error_url=' + config.THINKIFIC.CMS_SSO_ERROR;

                return res.send(success(successMessage.FETCH_SUCCESS.replace(':attribute', "URL"), { redirectURL }, statusCode.OK))

            }).catch(function (error: any) {
                // handle error
                res.status(statusCode.FORBIDDEN).send(error("There was an issue into get content url.", error.message))
            });


        } catch (err: any) {
            logger.error(`There was an issue into get content url.: ${err}`)
            res.status(statusCode.FORBIDDEN).send(error("There was an issue into get content url.", err.message, statusCode.FORBIDDEN))
        }
    },

    incrementContentViewedCount: async (req: Request, res: Response) => {
        try {
            const { contentId } = req.body;
            const request = req as requestUser;
            const userId = request.user._id;

            // check is content recommended
            const isContentRecommended = await findOne({
                collection: "RecommendedCourses",
                query: { contentId: contentId, userId: userId },
                project: { _id: 1 }
            });

            let contentViewedCount = 1;

            if (isContentRecommended) {
                const updatedContent = await findOneAndUpdate({
                    collection: 'Contents',
                    query: { _id: contentId },
                    update: { $inc: { contentViewedCount: 1 } },
                    options: { new: true }
                });

                contentViewedCount = updatedContent.contentViewedCount;
            }

            const successMsg = successMessage.UPDATE_SUCCESS.replace(':attribute', "Content viewed count");
            return res.send(success(successMsg, { contentViewedCount }, statusCode.OK));
        } catch (err: any) {
            logger.error(`There was an issue into increment content viewed count.: ${err}`)
            res.status(statusCode.FORBIDDEN).send(error("There was an issue into increment content viewed count.", err.message, statusCode.FORBIDDEN))
        }
    },

    getContent: async (req: Request, res: Response) => {
        try {
            const { contentId } = req.body;
            let request = req as requestUser;
            const user = request.user;

            let partnerIdOrRegionId: any = user.partnerAdmin;

            if (!user.partnerAdmin) {
                partnerIdOrRegionId = user.region;
            }

            const content = await findOne({
                collection: 'Contents',
                query: { _id: contentId, partnerIdOrRegionId: partnerIdOrRegionId }
            });

            const successMsg = successMessage.FETCH_SUCCESS.replace(":attribute", "Content");

            res.send(success(successMsg, content, statusCode.OK));
        } catch (err: any) {
            logger.error("contentController > getContent ", err);
            const errorMsg = "There is some issue to get content.";

            res.status(statusCode.FORBIDDEN).send(error(errorMsg, err.message, statusCode.FORBIDDEN));
        }
    },

};

const enrollUserToContent = async function (data: any) {
    const { contentId, users, courseType, requestedUserId } = data;
    const newEnroll: any = [];
    const alreadyEnroll: any = [];

    for (let i = 0; i < users.length; i++) {
        const user = users[i];

        let partnerIdOrRegionId = user.partnerAdmin;

        if (!user.partnerAdmin) {
            partnerIdOrRegionId = user.region;
        }

        // check is already enrolled
        const isAlreadyEnroll = await findOne({
            collection: 'RecommendedCourses',
            query: { contentId: contentId, userId: user._id }
        });

        if (isAlreadyEnroll) {
            await alreadyEnroll.push(isAlreadyEnroll);
        } else {
            let insertData: any = {
                contentId: contentId,
                userId: user._id,
                courseType: courseType,
                message: data.message,
                courseStatus: ContentConstants.ASSIGNED_COURSE_STATUS.published,
                partnerIdOrRegionId: partnerIdOrRegionId,
                partnerAdmin: user.partnerAdmin,
                region: user.region
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
                receiverId: user._id,
                message: data.message || ContentConstants.RECOMMENDED_MESSAGE,
                msg_type: 'Content',
                contentId: contentId
            }
        });
    }

    const returnData = {
        newEnroll,
        alreadyEnroll
    };

    return returnData;

}

const enrollUserToThinkific = async function (data: any) {
    const { courseId, users, courseType, requestedUserId, course, requestedUserRole } = data;
    const newEnroll: any = [];
    const alreadyEnroll: any = [];
    const activatedAt = new Date().toISOString();

    for (let i = 0; i < users.length; i++) {
        const user = users[i];

        let partnerIdOrRegionId = user.partnerAdmin;

        if (!user.partnerAdmin) {
            partnerIdOrRegionId = user.region;
        }

        // check is already enrolled
        const isAlreadyEnroll = await findOne({
            collection: 'RecommendedCourses',
            query: { thinkificCourseId: courseId, userId: user._id }
        });

        if (isAlreadyEnroll) {
            await alreadyEnroll.push(isAlreadyEnroll);
        } else {
            // create or get user thinkific user id
            let thinkificUserId = user.thinkificUserId;

            // create thinkific user
            if (!thinkificUserId) {
                const userData = {
                    firstName: user.preferredFname,
                    lastName: user.preferredLname,
                    email: user.email
                };

                const thinkificUser = await createOrGetUser(userData);

                // enroll user
                if (thinkificUser) {
                    thinkificUserId = thinkificUser.id;
                    // update user thinkific id into user table.
                    const updatedUser = await findOneAndUpdate({
                        collection: 'User',
                        query: {
                            email: user.email.toLowerCase(),
                            legalLname: user.legalLname,
                            legalFname: user.legalFname
                        },
                        update: {
                            $set: {
                                thinkificUserId: thinkificUserId
                            }
                        },
                        options: { new: 1 }
                    });
                }
            }

            if (thinkificUserId) {
                // enroll user
                const enrollData = {
                    userId: thinkificUserId,
                    courseId: course.courseId,
                    activatedAt
                };

                const enroll = await enrollCourse(enrollData);

                if (enroll) {
                    let insertData: any = {
                        thinkificCourseId: data.thinkificCourseId,
                        userId: user._id,
                        courseType: courseType,
                        enrollId: enroll.id,
                        message: data.message,
                        partnerIdOrRegionId: partnerIdOrRegionId,
                        partnerAdmin: user.partnerAdmin,
                        region: user.region
                    };

                    const insertedRecommended = await insertOne({
                        collection: 'RecommendedCourses',
                        document: insertData
                    });

                    let dataObj: any = {};
                    dataObj.userId = requestedUserId;
                    dataObj.user_role = requestedUserRole;
                    dataObj.type = courseType == "Project" ? "AssignProject" : "AssignTraining";
                    dataObj.sendTo = [insertData.userId];
                    dataObj.dataId = data.thinkificCourseId;
                    dataObj.content = courseType == "Project" ? notificationMessage.project : notificationMessage.training;
                    sendNotification(dataObj);
                    const badgeCounts = await countDocuments({
                        collection: 'Notification',
                        query: { to: insertData.userId, read: false }
                    });
                    dataObj.badgeCounts = badgeCounts;
                    sendPushNotification(dataObj);

                    await newEnroll.push(insertedRecommended);
                }
            }
        }
    }

    const returnData = {
        newEnroll,
        alreadyEnroll
    };

    return returnData;

}

export const checkIsCourseCompletedByMentor = async function (data: any) {
    const thinkificCourseId = data.thinkificCourseId;
    const partnerIdOrRegionId = data.partnerIdOrRegionId;
    let isCompleted = true;

    const getMentorsQuery = {
        role: userRoleConstant.MENTOR,
        isDel: false,
        $or: [{ partnerAdmin: partnerIdOrRegionId }, { region: partnerIdOrRegionId }],
    };

    const mentors = await find({
        collection: 'User',
        query: getMentorsQuery,
        project: { _id: 1 }
    });

    const mentorIds = mentors.map((mentor: any) => mentor._id.toString());

    const isUnComplete = await findOne({
        collection: 'RecommendedCourses',
        query: {
            userId: { $in: mentorIds },
            thinkificCourseId: thinkificCourseId,
            // partnerIdOrRegionId: partnerIdOrRegionId,
            percentageCompleted: { $lt: 100 }
        },
        project: { _id: 1 }
    });

    if (isUnComplete) {
        isCompleted = false;
    }

    return isCompleted;
}