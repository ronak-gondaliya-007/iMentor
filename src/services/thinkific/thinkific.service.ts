import axios from 'axios';
import { THINKIFIC_URLS } from './thinkific.constant';
import {
    CreateThinkificUserI,
    GetThinkificUserI,
    CreateThinkificEnrollmentsI,
    CreateThinkificEnrollmentsId,
    CreateThinkificWebhookI
} from './thinkific.interface';
import { Request, Response } from "express";
import crypto from 'crypto';
import { logger } from '../../utils/helpers/logger';
import {
    findOne,
    insertOne,
    find,
    findOneAndUpdate,
    deleteOne,
    findOneAndDelete,
    deleteMany,
    updateMany,
    countDocuments
} from '../../utils/db';
import {
    course_type,
    notificationMessage,
    notificationType,
    userRoleConstant,
    ContentConstants
} from '../../utils/const';
import { sendNotification, sendPushNotification } from '../../Controller/Web/notification.controller';
import { lessonCompleted, progressPercentage } from '../../Controller/Web/message.controller';

const THINKIFIC_AUTH_HEADERS = {
    'X-Auth-API-Key': process.env.THINKIFIC_API_KEY || '',
    'X-Auth-Subdomain': process.env.THINKIFIC_API_SUBDOMAIN || '',
    'Content-Type': 'application/json'
};

const V2_THINKIFIC_AUTH_HEADERS = {
    'Authorization': `Bearer ${process.env.THINKIFIC_API_KEY}` || 'Bearer',
    'Content-Type': 'application/json'
};

const callThinkificApi = async (options: any) => {
    const response = await axios({
        method: options.method,
        url: options.url,
        headers: THINKIFIC_AUTH_HEADERS,
        data: options.data,
        params: options.params
    }).then((res) => {
        return {
            isSuccess: true,
            data: res.data
        };
    }).catch((error) => {
        const errors = error.response.data.errors;
        let errorMessage = errors;
        let isMaintenance = false;

        if (error && error.response && error.response.status && error.response.status == 503) {
            isMaintenance = true;
        }

        if (!errors) {
            errorMessage = error.response.data
        }

        // console.log('cerror : ', error);
        console.log('callThinkificApi errors : ', errorMessage);

        return {
            isSuccess: false,
            data: errors,
            isMaintenance: isMaintenance,
            message: errorMessage
        };
    });

    return response;
}

const callThinkificV2Api = async (options: any) => {
    const response = await axios({
        method: options.method,
        url: options.url,
        headers: V2_THINKIFIC_AUTH_HEADERS,
        data: options.data,
        params: options.params
    }).then((res) => {
        return {
            isSuccess: true,
            data: res.data
        };
    }).catch((error) => {
        const errors = error.response.data.errors;

        console.log('callThinkificV2Api errors v2 : ', errors);

        return {
            isSuccess: false,
            data: errors
        };
    });

    return response;
}

const getThinkificApiUrl = (url: String) => {
    const baseUrl = process.env.THINKIFIC_API_BASE_URL || '';

    return `${baseUrl}${url}`;
}

const getThinkificV2ApiUrl = (url: String) => {
    const baseUrl = process.env.THINKIFIC_API_V2_BASE_URL || '';

    return `${baseUrl}${url}`;
}

const getPaginationDetails = async (meta: any) => {
    let totalDocs = 0;

    if (meta && meta.pagination) {
        totalDocs = meta.pagination.total_items;
    }

    return totalDocs;
}

const getCourses = async () => {
    let url = await getThinkificApiUrl(THINKIFIC_URLS.getAllCourses);

    const options = {
        method: 'get',
        url: url
    };

    const result: any = await callThinkificApi(options);

    if (result.isMaintenance) {
        throw new Error('There was an issue into thinkific service.')
    }

    if (result.isSuccess) {
        return result.data;
    } else {
        return {
            items: []
        }
    }
};

const getCourse = async (courseId: String) => {
    let url = await getThinkificApiUrl(THINKIFIC_URLS.getAllCourses);
    url = `${url}/${courseId}`;

    const options = {
        method: 'get',
        url: url
    };

    const result: any = await callThinkificApi(options);

    if (result.isMaintenance) {
        throw new Error('There was an issue into thinkific service.')
    }

    if (result.isSuccess) {
        return result.data;
    } else {
        return {
            items: []
        }
    }
};

const getProduct = async (productId: String) => {
    let url = await getThinkificApiUrl(THINKIFIC_URLS.products);
    url = `${url}/${productId}`;

    const options = {
        method: 'get',
        url: url
    };

    const result: any = await callThinkificApi(options);

    if (result.isMaintenance) {
        throw new Error('There was an issue into thinkific service.')
    }

    if (result.isSuccess) {
        return result.data;
    } else {
        return {
            items: []
        }
    }
};

const getQueryParams = async (queryData: any) => {
    let params = new URLSearchParams(queryData).toString();
    const queryKeys = Object.keys(queryData);

    for (let i = 0; i < queryKeys.length; i++) {
        const key = queryKeys[i];
        params = params.replace(key, `query[${key}]`);
    }

    return params;
}

const getUsers = async (data: GetThinkificUserI) => {
    let url = await getThinkificApiUrl(THINKIFIC_URLS.users);
    let params = '';

    if (data.query) {
        params = await getQueryParams(data.query);
    }

    const options = {
        method: 'get',
        url: `${url}?${params}`,
    };

    const result: any = await callThinkificApi(options);

    if (result.isMaintenance) {
        throw new Error('There was an issue into thinkific service.')
    }

    return result;
}

const createOrGetUser = async (data: CreateThinkificUserI) => {
    let url = await getThinkificApiUrl(THINKIFIC_URLS.users);

    const options = {
        method: 'post',
        url: url,
        data: {
            email: data.email,
            first_name: data.firstName,
            last_name: data.lastName,
            send_welcome_email: false
        }
    };

    const result: any = await callThinkificApi(options);

    if (result.isMaintenance) {
        throw new Error('There was an issue into thinkific service.')
    }

    if (result.isSuccess) {
        return result.data;
    } else {
        const errors = result.data;
        const errorKeys = Object.keys(errors);

        if (errorKeys.includes('email') && errors.email.includes('has already been taken')) {
            // call api for already taken eamil to get user id of thinkific user.
            const getUsersData = {
                query: {
                    email: data.email
                }
            }

            const getUsersResult = await getUsers(getUsersData);

            if (getUsersResult.isSuccess) {
                return getUsersResult.data.items[0];
            } else {
                throw new Error('There was an issue inti get thinkific user via email.')
            }
        } else {
            throw new Error(result.message)
        }
    }
};

const enrollCourse = async (data: CreateThinkificEnrollmentsI) => {
    let url = await getThinkificApiUrl(THINKIFIC_URLS.enrollments);

    const options = {
        method: 'post',
        url: url,
        data: {
            course_id: Number(data.courseId),
            user_id: Number(data.userId),
            activated_at: data.activatedAt
        }
    };

    const result: any = await callThinkificApi(options);

    if (result.isMaintenance) {
        throw new Error('There was an issue into thinkific service.')
    }

    if (result.isSuccess) {
        return result.data;
    } else {
        throw new Error(result.message)
    }

};

const getEnrollment = async (enrollmentId: String) => {
    let url = await getThinkificApiUrl(THINKIFIC_URLS.enrollments);
    url = `${url}/${enrollmentId}`;

    const options = {
        method: 'get',
        url: url
    };

    const result: any = await callThinkificApi(options);

    if (result.isMaintenance) {
        throw new Error('There was an issue into thinkific service.')
    }

    if (result.isSuccess) {
        return result.data;
    } else {
        return {
            items: []
        }
    }
};

const lessonCompletedWebhook = async (req: Request, res: Response) => {
    try {
        const { resource, action, payload } = req.body;
        const hashValue = req.headers['x-thinkific-hmac-sha256'];

        const isValidReq = await validateHmacThinkificWebHook(req.body, hashValue);

        if (isValidReq) { // isValidReq = true means api called from thinkific not outsider
            // console.log('data: ', req.body);

            if (resource == 'lesson' && action == 'completed') {

                // Enrollment id must be required
                if (payload && payload.enrollment && payload.enrollment.id) {

                    const enrollmentId = payload.enrollment.id.toString();

                    // check is enrollment exists
                    const enroll = await getEnrollment(enrollmentId);
                    console.log('.......... enroll ..........', enroll);

                    if (enroll) {

                        const percentageCompleted = enroll.percentage_completed;
                        const progressInPercentage = (percentageCompleted * 100).toFixed(2);

                        // update percentageCompleted into recommended courses collection
                        const updatedRecommended = await findOneAndUpdate({
                            collection: 'RecommendedCourses',
                            query: { enrollId: enrollmentId },
                            update: {
                                $set: { percentageCompleted: progressInPercentage }
                            },
                            options: { new: true }
                        });

                        console.log('.......... percentageCompleted..........', percentageCompleted);

                        if (percentageCompleted <= 1) {
                            progressPercentage({
                                data: {
                                    userId: updatedRecommended?.userId,
                                    progressInPercentage: progressInPercentage,
                                    enrollId: enrollmentId
                                }
                            });
                        }

                        const courseId = enroll.course_id;
                        const course = await getCourse(courseId);
                        if (course) {

                            const courseType = await getCourseTypeFromKeywords(course.keywords);

                            if (percentageCompleted >= 1) {

                                const user = await findOne({
                                    collection: 'User',
                                    query: { thinkificUserId: enroll.user_id },
                                    project: {
                                        _id: 1,
                                        partnerAdmin: 1,
                                        region: 1,
                                        role: 1,
                                        legalLname: 1,
                                        legalFname: 1,
                                        preferredFname: 1,
                                        preferredLname: 1,
                                        profilePic: 1
                                    }
                                });

                                if (user) {

                                    let userQuery: any = {
                                        isDel: false
                                    };

                                    let notifyUsers: any = [];

                                    if (user.partnerAdmin) { // partner user
                                        userQuery['partnerAdmin'] = user.partnerAdmin;
                                    } else { // region user
                                        userQuery['region'] = user.region
                                    }

                                    if (user.role == userRoleConstant.MENTEE) {

                                        const pair = await findOne({
                                            collection: 'PairInfo',
                                            query: { menteeId: user._id, isConfirm: true, isDel: false },
                                            populate: { path: 'mentorId', select: 'partnerAdmin region role' },
                                        });

                                        if (pair && pair.mentorId) {
                                            notifyUsers.push(pair.mentorId._id.toString());
                                        }

                                    } else if (user.role == userRoleConstant.MENTOR) {

                                        let roleArray: any = [userRoleConstant.P_SUPER_ADMIN, userRoleConstant.P_LOCAL_ADMIN];

                                        if (user.region) {
                                            roleArray = [userRoleConstant.I_LOCAL_ADMIN];
                                        }

                                        userQuery = {
                                            ...userQuery,
                                            role: { $in: roleArray }
                                        };

                                        const admins = await find({
                                            collection: 'User',
                                            query: userQuery,
                                            project: { partnerAdmin: 1, region: 1, role: 1 }
                                        });
                                        console.log(admins);

                                        admins.map((ele: any) => {
                                            notifyUsers.push(ele._id.toString())
                                        });
                                    }
                                    console.log(JSON.stringify(notifyUsers));


                                    const userName = `${user.preferredFname} ${user.preferredLname}`;
                                    const from = user._id;
                                    const fromType = user.role;
                                    const type = notificationType.COURSE_COMPLETED;
                                    const content = notificationMessage.completedProject;

                                    // for (let i = 0; i < notifyUsers.length; i++) {
                                    //   const notifyUser = notifyUsers[i];
                                    //   const to = notifyUser._id;
                                    //   const toType = notifyUser.role;

                                    // check is notification already sent
                                    // const isNotificationAlreadySent = await findOne({
                                    //   collection: "Notification",
                                    //   query: { from, to, type, courseId, courseType },
                                    //   project: { _id: 1 }
                                    // });

                                    // if (!isNotificationAlreadySent) {
                                    // }
                                    // }

                                    lessonCompleted({ data: { userId: from, role: fromType, enroll } });

                                    sendNotification({
                                        userId: from,
                                        user_role: fromType,
                                        sendTo: notifyUsers,
                                        type,
                                        dataId: updatedRecommended?.thinkificCourseId?.toString(),
                                        content,
                                        courseId,
                                        courseType
                                    });

                                    for (let i = 0; i < notifyUsers.length; i++) {

                                        const badgeCounts = await countDocuments({
                                            collection: 'Notification',
                                            query: { to: notifyUsers[i], read: false }
                                        });

                                        sendPushNotification({
                                            userId: from,
                                            user_role: fromType,
                                            profileImage: user?.profilePic ?? "",
                                            sendTo: [notifyUsers[i]],
                                            type,
                                            badgeCounts,
                                            dataId: updatedRecommended?.thinkificCourseId?.toString(),
                                            content: userName + " " + notificationMessage.completedProject + " " + "(" + course.name + ").",
                                            courseId,
                                            courseType
                                        })
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }

        res.send('Ok');
    } catch (err: any) {
        console.log('error catch block : ', err);
    }
}

const validateHmacThinkificWebHook = async (payload: any, hash: any) => {
    const SECRET = process.env.THINKIFIC_API_KEY || ''  // site's api key or app client secret
    const payloadStr = JSON.stringify(payload);
    const hmac = await crypto.createHmac('sha256', SECRET).update(payloadStr).digest('hex');

    return hmac === hash;
}

const enrollCourseUsingId = async (data: CreateThinkificEnrollmentsId) => {
    let url = await getThinkificApiUrl(THINKIFIC_URLS.enrollmentsId);

    const options = {
        method: 'get',
        url: url + data.enrollId
    };

    const result: any = await callThinkificApi(options);

    if (result.isMaintenance) {
        throw new Error('There was an issue into thinkific service.')
    }

    return result.data;
};

const getDefaultCourse = async (data: any) => {
    try {

        let getCourse = await findOne({
            collection: "AssignedCourses",
            query: {
                $or: [{ partnerIdOrRegionId: data.partnerId }, { partnerIdOrRegionId: data.regionId }],
                courseType: course_type.TRAINING,
                isDefaultCourse: true
            },
            populate: [
                {
                    path: 'thinkificCourseId'
                }
            ]
        });

        return getCourse

    } catch (error: any) {
        logger.error(`There was an issue into get default course.: ${error}`)
    }
}

const getCourseTypeFromKeywords = async function (keywords: any) {
    let courseType = ContentConstants.COURSES_TYPE.project;

    if (keywords) {
        const keywordsArray = keywords.split(",");

        if (keywordsArray.includes(ContentConstants.TRAINING_KEYWORD)) {
            courseType = ContentConstants.COURSES_TYPE.training;
        }
    }

    return courseType;
}

const createWebhook = async (data: CreateThinkificWebhookI) => {
    let url = await getThinkificV2ApiUrl(THINKIFIC_URLS.webhooks);

    const options = {
        method: 'post',
        url: url,
        data: {
            topic: data.topic,
            target_url: data.targetUrl
        }
    };

    const result = await callThinkificV2Api(options);

    if (result.isSuccess) {
        return result.data;
    } else {
        const errors = result.data;
        const errorKeys = Object.keys(errors);
        throw new Error(`There was an issue into create thinkific webhook. : ${errorKeys[0]} : ${errors[errorKeys[0]]}`);
    }
};

const courseUpdatedWebhook = async (req: Request, res: Response) => {
    try {
        const { resource, action, payload } = req.body;
        const hashValue = req.headers['x-thinkific-hmac-sha256'];
        const isValidReq = await validateHmacThinkificWebHook(req.body, hashValue);

        if (isValidReq) { // isValidReq = true means api called from thinkific not outsider
            console.log("courseUpdatedWebhook", payload)
            console.log("resource", resource)
            console.log("action", action)
            if (action == 'updated' || action == 'created') {
                if (resource == 'course' && payload) {
                    const courseId = payload.id;
                    const courseName = payload.name;
                    const courseSlug = payload.slug;
                    let keywords = payload.keywords;
                    const productId = payload.product.id;
                    const courseProduct = await getProduct(productId);
                    let chapterIds = [];
                    let courseStatus = '';

                    const course = await getCourse(courseId);

                    if (course) {
                        chapterIds = course.chapter_ids;
                        keywords = course.keywords;
                    }

                    const product = await getProduct(productId);

                    if (product) {
                        courseStatus = product.status;
                    }

                    const courseType = await getCourseTypeFromKeywords(keywords);

                    const isCourseAlreadyExists = await findOne({
                        collection: 'ThinkificCourses',
                        query: { courseId: courseId },
                        project: { _id: 1, courseId: 1 }
                    });

                    let ThinkificCourse = null;

                    let thinkificCourseData: any = {
                        courseId,
                        courseName,
                        courseSlug,
                        courseStatus,
                        chapterIds,
                        courseType,
                        courseCardImageUrl: courseProduct?.card_image_url,
                        productId,
                        payload
                    }

                    if (isCourseAlreadyExists) {
                        // update existing course details
                        ThinkificCourse = await findOneAndUpdate({
                            collection: 'ThinkificCourses',
                            query: { courseId: courseId },
                            update: { $set: thinkificCourseData },
                            options: { new: true }
                        });

                        // update course type and course status into recomended and assigned course
                        const updatedRecommended = await updateMany({
                            collection: 'RecommendedCourses',
                            query: { thinkificCourseId: isCourseAlreadyExists._id },
                            update: { $set: { courseStatus: courseStatus, courseType: courseType } },
                            options: { new: true }
                        });

                        const updatedAssigned = await updateMany({
                            collection: 'AssignedCourses',
                            query: { thinkificCourseId: isCourseAlreadyExists._id },
                            update: { $set: { courseType: courseType } },
                            options: { new: true }
                        });
                    } else {
                        thinkificCourseData = {
                            ...thinkificCourseData,
                            isArchived: false
                        }

                        // create new course
                        ThinkificCourse = await insertOne({
                            collection: 'ThinkificCourses',
                            document: thinkificCourseData
                        });
                    }
                }
            }

        }

        res.send('Ok');
    } catch (err: any) {
        console.log('error catch block : ', err);
    }
}

const productUpdatedWebhook = async (req: Request, res: Response) => {
    try {
        const { resource, action, payload } = req.body;
        const hashValue = req.headers['x-thinkific-hmac-sha256'];

        const isValidReq = await validateHmacThinkificWebHook(req.body, hashValue);

        if (isValidReq) { // isValidReq = true means api called from thinkific not outsider
            console.log("productUpdatedWebhook", payload)

            if (resource == 'product' && action == 'updated') {
                if (payload && payload.productable_id) {
                    const productableType = payload.productable_type;

                    if (productableType == 'Course') {
                        const courseId = payload.productable_id;
                        const status = payload.status;
                        const card_image_url = payload.card_image_url;

                        await findOneAndUpdate({
                            collection: 'ThinkificCourses',
                            query: { courseId: courseId },
                            update: { $set: { courseStatus: status, courseCardImageUrl: card_image_url } },
                            options: { new: true }
                        });
                    }
                }
            }
        }

        res.send('Ok');
    } catch (err: any) {
        console.log('error catch block : ', err);
    }
}

const productDeletedWebhook = async (req: Request, res: Response) => {
    try {
        const { resource, action, payload } = req.body;
        const hashValue = req.headers['x-thinkific-hmac-sha256'];

        const isValidReq = await validateHmacThinkificWebHook(req.body, hashValue);

        if (isValidReq) { // isValidReq = true means api called from thinkific not outsider
            if (action == 'deleted' && resource == 'product' && payload && payload.productable_type == 'Course') {
                const courseId = payload.productable_id;

                const deletedCourse = await findOneAndDelete({
                    collection: 'ThinkificCourses',
                    query: { courseId: courseId },
                });

                if (deletedCourse) {
                    const thinkificCourseId = deletedCourse._id;

                    // delete recommended courses
                    const deletedRecommendedCourses = await deleteMany({
                        collection: 'RecommendedCourses',
                        query: { thinkificCourseId: thinkificCourseId },
                    });

                    // delete assigned courses
                    const deletedAssignedCourses = await deleteMany({
                        collection: 'AssignedCourses',
                        query: { thinkificCourseId: thinkificCourseId },
                    });

                    console.log('deletedRecommendedCourses : ', deletedRecommendedCourses);
                    console.log('deletedAssignedCourses : ', deletedAssignedCourses);
                }
            }
        }

        res.send('Ok');
    } catch (err: any) {
        console.log('error catch block : ', err);
    }
}

export {
    getCourses,
    getPaginationDetails,
    createOrGetUser,
    getUsers,
    enrollCourse,
    getCourse,
    lessonCompletedWebhook,
    getEnrollment,
    enrollCourseUsingId,
    getDefaultCourse,
    getCourseTypeFromKeywords,
    createWebhook,
    courseUpdatedWebhook,
    productUpdatedWebhook,
    getProduct,
    productDeletedWebhook
};