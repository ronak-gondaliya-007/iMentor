import { Request, Response } from "express";
import { findOne, findOneAndUpdate, insertOne, find, countDocuments, ObjectId, updateOne, aggregate, distinct } from "../../utils/db";
import { userRoleConstant, errorMessage, statusCode, successMessage, uploadConstant, statusType, userStatusConstant, msg_Type, announcement_msg, categoryOfQuestion, quentionType, questionState, ContentConstants } from "../../utils/const";
import { decrypt, encrypt, generateToken, uniqueIdGenerator } from "../../utils/helpers/functions";
import { success, error } from "../../utils/helpers/resSender";
import { logger } from "../../utils/helpers/logger";
import { requestUser } from "../../Interfaces/schemaInterfaces/user";
import config from "../../utils/config";
import { sendEmail } from "../../utils/email/email";
import _ from "underscore"
import { uploadToS3, validateFile } from "../../middleware/multer";
import jwt from "jsonwebtoken";
import { stateList } from "../../utils/state";
import bcrypt from "bcrypt";
import { sendMsg } from "./message.controller";
// import { updateApplicationCompleteSystemBadge } from "../../utils/helpers/common";
import { createOrGetUser, enrollCourse } from "../../services/thinkific/thinkific.service";
import { deleteUploadedS3URL } from "../../middleware/multer";


export let authController = {

    /* User id throw get user email */
    getUserEmail: async (req: Request, res: Response) => {
        try {

            let { userId } = req.body;

            let user = await findOne({ collection: "User", query: { _id: userId, isDel: false, role: { $in: [userRoleConstant.MENTEE, userRoleConstant.MENTOR] } } });

            if (!user) {
                res.status(statusCode.OK).send(error("User not exists!", {}, statusCode.NOT_FOUND));
                return;
            }

            if (user?.pairImported === true && user.password === undefined) {
                res.status(statusCode.OK).send(success("Success", { email: user.email, role: user.role }, statusCode.OK));
                return
            }

            if (user.onboardingStep > 0 && user.status != statusType.INVITED) {
                res.status(statusCode.OK).send(error("User is already registered, please login", {}, statusCode.BAD_REQUEST))
                return
            }

            res.status(statusCode.OK).send(success("User Created Successfully", { email: user.email, role: user.role }, statusCode.OK));

        } catch (err) {
            logger.error(`There was an issue into get user email.: ${err}`)
            res.status(statusCode.FORBIDDEN).send(error("There was an issue into get user email.", { err }, statusCode.FORBIDDEN));
        }
    },

    /* User register function */
    registration: async (req: Request, res: Response) => {
        try {

            let { email, password, confirmPassword } = req.body;

            let userObj = await findOne({
                collection: "User",
                query: {
                    email: email.toLowerCase(),
                    isDel: false,
                    role: { $in: [userRoleConstant.MENTEE, userRoleConstant.MENTOR] }
                }
            });

            if (!userObj) {
                res.status(statusCode.OK).send(error("User not exists!", {}, statusCode.NOT_FOUND));
                return;
            }

            if (!userObj?.pairImported && userObj.onboardingStep > 0 && userObj.status != statusType.INVITED) {
                res.status(statusCode.OK).send(error("User is already registered, please login", {}, statusCode.BAD_REQUEST))
                return
            }

            if (password !== confirmPassword) {
                res.status(statusCode.OK).send(error("password and confirmPassword must be same", {}, statusCode.BAD_REQUEST))
                return
            }

            let updateJson: any;
            if (userObj?.pairImported) {
                updateJson = { password: await encrypt(password), status: statusType.MATCHED };
            } else {
                updateJson = { password: await encrypt(password), status: statusType.NOT_STARTED };
            }

            updateJson.userActivationDate = new Date();

            await findOneAndUpdate({
                collection: 'User',
                query: { _id: userObj._id },
                update: { $set: updateJson },
                options: { new: true }
            })

            let token = await generateToken(userObj);

            if (!token) {
                res.send(error("Token Expired"));
                return;
            }

            let uniqueId: string = ""
            if (req.body.uniqueId) {
                uniqueId = req.body.uniqueId
            } else {
                uniqueId = uniqueIdGenerator()
            }

            await insertOne({
                collection: "Session",
                document: {
                    uniqueId: uniqueId,
                    account: [
                        {
                            email: userObj.email,
                            token: token,
                            default: true,
                            role: userObj.role,
                        },
                    ],
                },
            });

            if (!userObj?.thinkificUserId && userObj.role == userRoleConstant.MENTOR) {
                let partnerOrRegionObj: any = {}
                if (userObj.region) {
                    partnerOrRegionObj = await findOne({ collection: "AssignedCourses", query: { partnerIdOrRegionId: userObj.region, courseType: ContentConstants.COURSES_TYPE.training, isDefaultCourse: true }, populate: [{ path: 'thinkificCourseId', select: 'courseId' }] });
                } else if (userObj.partnerAdmin) {
                    partnerOrRegionObj = await findOne({ collection: "AssignedCourses", query: { partnerIdOrRegionId: userObj.partnerAdmin, courseType: ContentConstants.COURSES_TYPE.training, isDefaultCourse: true }, populate: [{ path: 'thinkificCourseId', select: 'courseId' }] });
                }

                if (partnerOrRegionObj) {

                    let thinkificUser = await createOrGetUser({
                        email: userObj.email,
                        firstName: userObj.preferredFname,
                        lastName: userObj.preferredLname
                    })

                    await findOneAndUpdate({
                        collection: 'User',
                        query: { _id: userObj._id },
                        update: { $set: { thinkificUserId: thinkificUser.id } },
                        options: { new: true }
                    })

                    const getCourse = await findOne({
                        collection: "RecommendedCourses",
                        query: { userId: userObj?._id.toString(), isDefaultCourse: true }
                    });

                    if (!getCourse && getCourse === null) {
                        let enrollUserAtThinkific = await enrollCourse({ courseId: partnerOrRegionObj.thinkificCourseId.courseId, userId: thinkificUser.id, activatedAt: new Date().toISOString() })

                        if (enrollUserAtThinkific) {
                            await insertOne({
                                collection: 'RecommendedCourses', document: {
                                    courseId: partnerOrRegionObj.courseId,
                                    userId: userObj._id,
                                    courseType: "Training",
                                    isDefaultCourse: true,
                                    thinkificCourseId: partnerOrRegionObj.thinkificCourseId._id,
                                    enrollId: enrollUserAtThinkific.id,
                                    bannerImageUrl: partnerOrRegionObj?.bannerImageUrl || '',
                                    courseCardImageUrl: partnerOrRegionObj?.courseCardImageUrl || '',
                                    partnerIdOrRegionId: partnerOrRegionObj?.partnerIdOrRegionId
                                }
                            })
                        }
                    }
                }
            }

            res.status(statusCode.OK).send(success("User Registered Successfully", { userObj, token }, statusCode.OK));

        } catch (err) {
            logger.error(`There was an issue into registration.: ${err}`)
            res.status(statusCode.FORBIDDEN).send(error("There was an issue into registration.", { err }, statusCode.FORBIDDEN));
        }
    },

    /* User register function */
    completeRegistration: async (req: Request, res: Response) => {
        try {
            const request = req as requestUser;

            let userObj = await findOne({ collection: "User", query: { _id: request.user._id, isDel: false, role: { $in: [userRoleConstant.MENTEE, userRoleConstant.MENTOR] } } });

            if (!userObj) {
                res.status(statusCode.OK).send(error("User not exists!", {}, statusCode.NOT_FOUND));
                return;
            }

            if (userObj.onboardingStep == 0) {
                await findOneAndUpdate({
                    collection: 'User',
                    query: { _id: userObj._id },
                    update: { $set: { onboardingStep: 1 } },
                    options: { new: true }
                });
            }

            res.status(statusCode.OK).send(success("User Created Successfully", { userObj }, statusCode.OK));

        } catch (err) {
            logger.error(`There was an issue into complete registration.: ${err}`)
            res.status(statusCode.FORBIDDEN).send(error("There was an issue into complete registration.", { err }, statusCode.FORBIDDEN));
        }
    },

    /* User login function */
    login: async (req: Request, res: Response) => {
        try {

            let userObj = await findOne({
                collection: "User",
                query: { email: req.body.email.toLowerCase(), isDel: false, role: { $in: [userRoleConstant.MENTEE, userRoleConstant.MENTOR] } },
                populate: [
                    { path: "partnerAdmin" },
                    { path: "region" }
                ]
            });

            if (!userObj || userObj?.isDel == true) {
                res.status(statusCode.OK).send(error("No account found, please contact your admin.", {}, statusCode.NOT_FOUND));
                return;
            }

            if (!userObj?.password) {
                res.status(statusCode.OK).send(error("The registration is not completed.", {}, statusCode.NOT_FOUND));
                return;
            }

            if (userObj.onboardingStep == 0) {
                res.status(statusCode.OK).send(success("User registration is incomplete.", {}, statusCode.BAD_REQUEST));
                return;
            }

            if (userObj.isDisabled == true) {
                res.status(statusCode.OK).send(success(`The ${userObj?.role?.toLowerCase()} account you're attempting to log into is currently disabled by your partner/region. Please reach out to your partner or regional administrator to reactivate it..`, {}, statusCode.BAD_REQUEST));
                return;
            }

            let fullName = userObj?.preferredFname + " " + userObj?.preferredLname

            let decryptedPassword = await decrypt(req.body.password, userObj.password);
            if (!decryptedPassword) {
                res.status(statusCode.OK).send(error("This email and password combination do not match. Please try again or click Forgot Password to reset.", {}, statusCode.BAD_REQUEST));
                return;
            }

            let token = await generateToken(userObj);

            if (!token) {
                res.status(statusCode.OK).send(error("Token Expired", {}, statusCode.UNAUTHORIZED));
                return;
            }

            await findOneAndUpdate({
                collection: 'User',
                query: { _id: userObj?._id },
                update: { $inc: { totalLogin: 1 } },
                options: { new: true }
            });


            let sessionObj = await findOne({ collection: 'Session', query: { userId: userObj._id } })
            if (sessionObj) {

                let findCurrentUserSession = (sessionObj.account).find((x: any) => x.user.toString() == userObj._id.toString());

                if (findCurrentUserSession) {
                    await findOneAndUpdate({
                        collection: 'Session',
                        query: {
                            userId: userObj._id,/*  'account.email': userObj.email.toLowerCase() */
                        },
                        update: {
                            $set: {
                                'account.$[i].token': token,
                                'account.$[i].user': userObj._id,
                                'account.$[i].role': userObj.role,
                                'account.$[i].email': userObj.email,
                            }
                        },
                        options: {
                            arrayFilters: [{ 'i.email': req.body.email.toLowerCase() }],
                            upsert: true
                        }
                    })
                } else {
                    await findOneAndUpdate({
                        collection: 'Session',
                        query: {
                            userId: userObj._id,
                        },
                        update: {
                            $push: {
                                account: {
                                    'token': token,
                                    'user': userObj._id,
                                    'role': userObj.role,
                                    'email': userObj.email,
                                    default: true
                                }

                            }
                        },
                        options: {
                            upsert: true
                        }
                    })
                }


            } else {

                await insertOne({
                    collection: "Session",
                    document: {
                        userId: userObj._id,
                        account: [
                            {
                                email: userObj.email,
                                user: userObj._id,
                                token: token,
                                default: true,
                                role: userObj.role,
                            }
                        ],
                    },
                });

            }

            if (userObj?.role === userRoleConstant.MENTOR) {
                const answerByMentors = await findOne({
                    collection: "AnswerByMentors",
                    query: { user: userObj?._id },
                    populate: [{ path: "queAns.question" }]
                });

                userObj.assignedSchoolOrInstitutions = answerByMentors?.queAns?.map((ele: any) => {
                    return ele?.question?.question === "At what schools (colleges and graduate schools) did you study?" ? ele?.answer : []
                }).filter((item: any) => item.length > 0).flat();
            } else if (userObj?.role === userRoleConstant.MENTEE) {
                const additionalInfo = await findOne({
                    collection: 'AdditionalInfo',
                    query: {
                        userId: userObj._id,
                    }
                });

                userObj.assignedSchoolOrInstitutions = additionalInfo?.education_level?.assignedSchoolOrInstitutions ?? [];
            }

            res.send(success("Logged In Successfully.", {
                userId: userObj._id, role: userObj.role, token, onboardingStep: userObj.onboardingStep, fullName,
                email: userObj.email, profilePic: userObj.profilePic, profilePicKey: userObj.profilePicKey,
                legalFname: userObj.legalFname, legalLname: userObj.legalLname, primaryPhoneNo: userObj.primaryPhoneNo,
                assignedSchoolOrInstitutions: userObj?.assignedSchoolOrInstitutions ?? [], partnerAdmin: userObj?.partnerAdmin, region: userObj?.region,
                preferredFname: userObj?.preferredFname, preferredLname: userObj?.preferredLname,
                isCookieAccepted: userObj.isCookieAccepted ? userObj.isCookieAccepted : false
            }));

        } catch (err: any) {
            logger.error(`There was an issue into login.: ${err}`)
            res.status(statusCode.FORBIDDEN).send(error("There is some issue during login.", err.message, statusCode.FORBIDDEN));
        }
    },

    /* User ghost login function */
    loginViaToken: async (req: Request, res: Response) => {
        try {
            const { token }: any = req.query;

            let decodeToken = jwt.verify(token, config.PRIVATE_KEY);

            const user: any = decodeToken;

            let userObj = await findOne({
                collection: "User",
                query: { _id: user._id, isDel: false, role: { $in: [userRoleConstant.MENTEE, userRoleConstant.MENTOR] } },
                populate: [
                    { path: "partnerAdmin" },
                    { path: "region" }
                ]
            });

            if (userObj?.pairImported === true && userObj?.password === undefined) {
                res.status(statusCode.OK).send(success("User registration is incomplete.", { userId: userObj?._id, email: userObj?.email, role: userObj?.role, pairImported: userObj?.pairImported }, statusCode.OK));
                return
            }

            if (!userObj) {
                res.status(statusCode.OK).send(error("User not found.", {}, statusCode.NOT_FOUND));
                return;
            }

            if (userObj?.role === userRoleConstant.MENTOR) {
                const answerByMentors = await findOne({
                    collection: "AnswerByMentors",
                    query: { user: user._id },
                    populate: [{ path: "queAns.question" }]
                });

                userObj.assignedSchoolOrInstitutions = answerByMentors?.queAns?.map((ele: any) => {
                    return ele?.question?.question === "At what schools (colleges and graduate schools) did you study?" ? ele?.answer : []
                }).filter((item: any) => item.length > 0).flat();
            } else if (userObj?.role === userRoleConstant.MENTEE) {
                const additionalInfo = await findOne({
                    collection: 'AdditionalInfo',
                    query: {
                        userId: userObj._id,
                    }
                });

                userObj.assignedSchoolOrInstitutions = additionalInfo?.education_level?.assignedSchoolOrInstitutions ?? [];
            }

            let fullName = userObj.preferredFname + " " + userObj.preferredLname

            res.send(success("Logged In Successfully.", {
                userId: userObj._id, role: userObj.role, token, fullName, email: userObj.email, region: userObj?.region,
                onboardingStep: userObj.onboardingStep, profilePic: userObj.profilePic, profilePicKey: userObj.profilePicKey,
                legalFname: userObj.legalFname, legalLname: userObj.legalLname, primaryPhoneNo: userObj.primaryPhoneNo,
                assignedSchoolOrInstitutions: userObj.assignedSchoolOrInstitutions, partnerAdmin: userObj?.partnerAdmin,
                preferredFname: userObj?.preferredFname, preferredLname: userObj?.preferredLname,
                isCookieAccepted: userObj.isCookieAccepted ? userObj.isCookieAccepted : false
            }));

        } catch (err: any) {
            logger.error(`There was an issue into login.: ${err}`)
            res.status(statusCode.FORBIDDEN).send(error("There is some issue during login.", err.message, statusCode.FORBIDDEN));
        }
    },

    /* User log out function */
    logout: async (req: Request, res: Response) => {
        try {
            let request = req as requestUser;

            let userObj = await findOne({ collection: 'User', query: { _id: request.user._id, isDel: false } });

            if (!userObj) {
                res.status(statusCode.OK).send(error(errorMessage.NOT_EXISTS.replace(":attribute", "user"), {}, statusCode.BAD_REQUEST));
                return
            }

            let sessionObj = await findOne({ collection: 'Session', query: { "account.email": userObj.email, "account.token": request.headers['x-auth-token'] } });

            if (sessionObj) {
                await findOneAndUpdate({
                    collection: 'Session',
                    query: { "account.email": userObj.email, "account.token": request.headers['x-auth-token'] },
                    update: {
                        $pull: {
                            account: {
                                email: userObj.email.toLowerCase()
                            }
                        }
                    },
                    options: { new: true }
                });
            }

            if (req.body.deviceId) {
                await findOneAndUpdate({
                    collection: "NotificationManage",
                    query: { user_id: userObj?._id, deviceId: req.body.deviceId, deviceType: req.body.deviceType },
                    update: { $set: { deviceId: "", deviceType: "" } },
                    options: { new: true }
                });
            }

            res.status(statusCode.OK).send(success("User logged out successfully.", {}, statusCode.OK))

        } catch (err: any) {
            logger.error("There was an issue into log out.", err);
            res.status(statusCode.FORBIDDEN).send(error("There was an issue into log out.", err.message, statusCode.FORBIDDEN))
        }
    },

    /* Request send for forgot password */
    requestResetPassword: async (req: Request, res: Response) => {
        try {

            let checkUser = await findOne({
                collection: 'User',
                query: {
                    email: req.body.email.toLowerCase(),
                    isDel: false,
                    role: { $in: [userRoleConstant.MENTEE, userRoleConstant.MENTOR] }
                }
            })

            if (!checkUser) {
                res.status(statusCode.OK).send(error("Please enter valid email address.", {}, statusCode.NOT_FOUND))
                return
            }

            checkUser = _.pick(checkUser, "legalFname", "legalLname", "email", "role", "_id")

            let url = config.WEB.HOST + "change-password/?id=" + checkUser._id;

            const templateData = {
                name: checkUser.preferredFname,
                url: url
            }

            sendEmail(checkUser.email, "Password Reset", './template/requestResetPassword.pug', templateData)

            res.status(statusCode.OK).send(success(successMessage.FETCH_SUCCESS.replace(':attribute', "User"), { checkUser, url }, statusCode.OK))
        } catch (err: any) {
            res.status(statusCode.FORBIDDEN).send(error("There is some issue in checking user.", err.message, statusCode.FORBIDDEN))
        }
    },

    /* User request forgot password function */
    forgotPassword: async (req: Request, res: Response) => {
        try {
            let { userId, password, confirmPassword } = req.body

            let userObj = await findOne({ collection: 'User', query: { _id: userId, isDel: false, role: { $in: [userRoleConstant.MENTEE, userRoleConstant.MENTOR] } } })

            if (!userObj) {
                res.status(statusCode.OK).send(error(errorMessage.NOT_EXISTS.replace(":attribute", 'user'), {}, statusCode.BAD_REQUEST));
                return
            }

            if (password == confirmPassword) {
                await findOneAndUpdate({
                    collection: 'User',
                    query: { _id: userId },
                    update: { $set: { password: await encrypt(password) } },
                    options: { new: true }
                })

                res.status(statusCode.OK).send(success(successMessage.UPDATE_SUCCESS.replace(":attribute", 'user'), {}, statusCode.OK))
                return
            } else {
                res.status(statusCode.OK).send(error("password and confirmPassword must be same", {}, statusCode.BAD_REQUEST))
                return
            }

        } catch (err: any) {
            logger.error("There was an issue into forgot password. ", err);
            res.status(statusCode.FORBIDDEN).send(error("There is some issue into forgot password.", { err }, statusCode.FORBIDDEN))
        }
    },

    /* Change password function */
    changePassword: async (req: Request, res: Response) => {
        try {
            const request = req as requestUser;

            // Init Variables
            const { currentPassword, newPassword } = req.body;

            if (newPassword) {
                const userObj = await findOne({
                    collection: "User",
                    query: { _id: request.user._id, isDel: false }
                });

                if (userObj) {
                    if (await bcrypt.compare(currentPassword, userObj.password)) {
                        if (currentPassword === newPassword) {
                            res.status(statusCode.OK).send(error('New password can not be the same as old password.', {}, statusCode.BAD_REQUEST));
                        } else {
                            const updateUser = await findOneAndUpdate({
                                collection: "User",
                                query: { _id: request.user._id },
                                update: { $set: { password: await encrypt(newPassword) } },
                                options: { new: true }
                            });

                            res.status(statusCode.OK).send(success(successMessage.UPDATE_SUCCESS.replace(':attribute', 'Password'), {}, statusCode.OK));

                        }
                    } else {
                        res.status(statusCode.OK).send(error('Current password is incorrect.', {}, statusCode.BAD_REQUEST));
                    }
                } else {
                    res.status(statusCode.OK).send(error(successMessage.NOT_FOUND.replace(":attribute", 'User'), {}, statusCode.NOT_FOUND));
                }
            } else {
                res.status(statusCode.OK).send(error('Please provide a new password.', {}, statusCode.BAD_REQUEST));
            }
        } catch (err: any) {
            logger.error(`There was an issue into change password.: ${err}`)
            res.status(statusCode.FORBIDDEN).send(error("There was an issue into change password.", { err }, statusCode.FORBIDDEN));
        }
    },

    /* User onboarding basic info screen function */
    updateUserBasicInfo: async (req: Request, res: Response) => {
        try {
            const { mentorId, legalFname, legalLname, pronounciationName, dob, preferredFname, preferredLname, email, recoveryEmail, primaryPhoneNo, secondaryPhoneNo, address,
                isSharedThisNumber, guardianFname, guardianLname, guardianEmail, guardianPhone, guardianSecondaryPhoneNo, education_level, guardianAddress, isSameAddress, isParentBornInUnitedStates,
                profilePic, profilePicKey, programInformation, isDraft } = req.body;

            const userObj = await findOne({
                collection: 'User', query: {
                    _id: mentorId,
                    status: { $in: [statusType.NOT_STARTED, statusType.DRAFT, statusType.IN_PROGRESS] },
                    isDel: false,
                    role: { $in: [userRoleConstant.MENTEE, userRoleConstant.MENTOR] }
                }
            });

            if (!userObj) {
                res.status(statusCode.OK).send(error(errorMessage.NOT_EXISTS.replace(':attribute', 'Mentor'), {}, statusCode.NOT_FOUND))
            }

            if (profilePic == "" && profilePicKey == "" && userObj.profilePic !== "") {
                deleteUploadedS3URL({ objectKey: userObj.profilePicKey !== "" ? userObj.profilePicKey : userObj.profilePic });
            }

            /* Onboarding First Screen */
            const basicInfoQuery: any = {
                legalFname: legalFname,
                legalLname: legalLname,
                preferredFname: preferredFname,
                preferredLname: preferredLname,
                pronounciationName: pronounciationName,
                pronounceName: pronounciationName,
                dob: dob,
                email: email,
                recoveryEmail: recoveryEmail,
                primaryPhoneNo: primaryPhoneNo,
                secondaryPhoneNo: secondaryPhoneNo,
                address: address,
                isSharedThisNumber: isSharedThisNumber,
                guardianFname: guardianFname,
                guardianLname: guardianLname,
                guardianEmail: guardianEmail,
                guardianPhone: guardianPhone,
                guardianSecondaryPhoneNo: guardianSecondaryPhoneNo,
                guardianAddress: guardianAddress,
                isSameAddress: isSameAddress,
                isParentBornInUnitedStates: isParentBornInUnitedStates
            }

            if (profilePic == "" && profilePicKey == "") {
                basicInfoQuery.profilePic = profilePic;
                basicInfoQuery.profilePicKey = profilePicKey;
            }

            if (userObj.onboardingStep == 1) {
                if (isDraft === true) {
                    basicInfoQuery.status = statusType.DRAFT;
                    basicInfoQuery.onboardingStep = 1;
                } else {
                    basicInfoQuery.status = statusType.IN_PROGRESS;
                    basicInfoQuery.onboardingStep = 2;
                }
            }

            const mentor = await findOneAndUpdate({
                collection: 'User',
                query: {
                    _id: mentorId
                },
                update: {
                    $set: basicInfoQuery
                },
                options: { new: true }
            });

            if (userObj.role == userRoleConstant.MENTEE) {
                await findOneAndUpdate({
                    collection: 'AdditionalInfo', query: {
                        userId: mentorId
                    },
                    update: {
                        $set: { education_level: education_level, programInformation }
                    },
                    options: { new: true }
                });
            }

            res.status(statusCode.OK).send(success(successMessage.UPDATE_SUCCESS.replace(':attribute', "Mentor"), { mentor }, statusCode.OK))

        } catch (err: any) {
            logger.error(`There was an issue into update mentor basic info.: ${err}`)
            res.status(statusCode.FORBIDDEN).send(error("There was an issue into update mentor basic info.", { err }, statusCode.FORBIDDEN))
        }
    },

    /* User onboarding additional info and matching questions screen function */
    updateOnboardingDetails: async (req: Request, res: Response) => {
        try {
            const request = req as requestUser;

            const { mentorId, step, isDraft, demographicInformation, employerInformation, programInformation, preloadMentees, references, legalStatus, physicalAndEmotionalCondition, education_levels, queAns } = req.body;

            const isMentorExists = await findOne({
                collection: 'User', query: {
                    _id: mentorId,
                    status: { $in: [statusType.IN_PROGRESS, statusType.DRAFT] },
                    isDel: false,
                    role: { $in: [userRoleConstant.MENTEE, userRoleConstant.MENTOR] }
                }
            })

            if (!isMentorExists) {
                res.status(statusCode.OK).send(error(errorMessage.NOT_EXISTS.replace(':attribute', 'mentor'), {}, statusCode.NOT_FOUND))
            }

            if (step == 2) {

                /* Onboarding Second Screen */
                const additionalInfoQuery: any = {
                    programInformation: programInformation,
                    employerInformation: employerInformation,
                    demographicInformation: demographicInformation,
                    preloadMentees: preloadMentees,
                    references: references,
                    legalStatus: legalStatus,
                    physicalAndEmotionalCondition: physicalAndEmotionalCondition,
                    education_level: education_levels
                }

                const mentorUpdateField: any = {};
                if (isMentorExists.onboardingStep == 2) {
                    if (isDraft == true) {
                        mentorUpdateField.status = statusType.DRAFT;
                        mentorUpdateField.onboardingStep = 2;
                    } else {
                        mentorUpdateField.status = statusType.IN_PROGRESS;
                        mentorUpdateField.onboardingStep = 3;
                    }
                }

                const verify = await findOne({
                    collection: 'AdditionalInfo',
                    query: { userId: mentorId }
                });

                let additionalInfo;
                if (verify) {
                    additionalInfo = await findOneAndUpdate({
                        collection: 'AdditionalInfo', query: {
                            userId: mentorId,
                        },
                        update: {
                            $set: additionalInfoQuery
                        },
                        options: { new: true }
                    });
                } else {
                    additionalInfoQuery.userId = mentorId;

                    additionalInfo = await insertOne({
                        collection: 'AdditionalInfo',
                        document: additionalInfoQuery
                    });
                }

                await findOneAndUpdate({
                    collection: 'User', query: {
                        _id: mentorId
                    },
                    update: {
                        $set: mentorUpdateField
                    },
                    options: { new: true, upsert: true }
                });

                res.status(statusCode.OK).send(success(successMessage.UPDATE_SUCCESS.replace(':attribute', "Mentor"), { additionalInfo }, statusCode.OK));
            }

            if (step == 3) {

                let collection!: string;
                if (request.user.role == userRoleConstant.MENTOR) {
                    collection = 'AnswerByMentors';
                } else if (request.user.role == userRoleConstant.MENTEE) {
                    collection = 'AnswerByMentee';
                }

                /* Onboarding Third Screen */
                const matchingQuestionsQuery: any = {
                    queAns: queAns,
                    status: userStatusConstant.ACTIVE,
                    createdBy: isMentorExists.partnerAdmin ? isMentorExists.partnerAdmin : isMentorExists.region
                }

                const mentorUpdateField: any = {};
                if (isMentorExists.onboardingStep == 3) {
                    if (isDraft == true) {
                        mentorUpdateField.status = statusType.DRAFT;
                        mentorUpdateField.onboardingStep = 3;
                    } else {
                        mentorUpdateField.status = statusType.IN_PROGRESS;
                        mentorUpdateField.onboardingStep = 4;
                        mentorUpdateField.preMatchStep = 0;
                    }
                }

                const verify = await findOne({
                    collection,
                    query: { user: mentorId }
                });

                let matchingQuestions;
                if (verify) {
                    matchingQuestions = await findOneAndUpdate({
                        collection,
                        query: {
                            user: mentorId,
                        },
                        update: {
                            $set: matchingQuestionsQuery
                        },
                        options: { new: true, upsert: true }
                    });

                } else {
                    matchingQuestionsQuery.user = mentorId;

                    matchingQuestions = await insertOne({
                        collection,
                        document: matchingQuestionsQuery
                    });
                }

                const additionalInfo = await findOneAndUpdate({
                    collection: 'AdditionalInfo', query: {
                        userId: mentorId,
                    },
                    update: {
                        $set: { programInformation: programInformation }
                    },
                    options: { new: true }
                });

                await findOneAndUpdate({
                    collection: 'User',
                    query: {
                        _id: mentorId
                    },
                    update: {
                        $set: mentorUpdateField
                    },
                    options: { new: true }
                });

                res.status(statusCode.OK).send(success(successMessage.UPDATE_SUCCESS.replace(':attribute', "Mentor"), { matchingQuestions }, statusCode.OK));
            }

        } catch (err: any) {
            logger.error(`There was an issue into update onboarding details.: ${err}`)
            res.status(statusCode.FORBIDDEN).send(error("There was an issue into update onboarding details.", { err }, statusCode.FORBIDDEN))
        }
    },

    /* User register function */
    applicationComplete: async (req: Request, res: Response) => {
        try {
            let request = req as requestUser;

            let userObj = await findOne({ collection: "User", query: { _id: request.user._id, isDel: false, role: { $in: [userRoleConstant.MENTEE, userRoleConstant.MENTOR] } } });

            if (!userObj) {
                res.status(statusCode.OK).send(error("User not exists!", {}, statusCode.NOT_FOUND));
                return;
            }

            let preMatchStep: any = 1, status: any = statusType.COMPLETED;
            if (userObj && userObj?.pairImported == true) {
                preMatchStep = 4;
                status = statusType.MATCHED
            }

            await findOneAndUpdate({
                collection: 'User',
                query: { _id: userObj._id },
                update: { $set: { onboardingStep: 5, preMatchStep: preMatchStep, status: status, userActivationDate: new Date() } },
                options: { new: true }
            });

            const isAnnouncement = await findOne({
                collection: 'Messages',
                query: { receiverId: userObj._id, msg_type: msg_Type.PRE_MATCH_ANNOUNCEMENT }
            });

            if (userObj && userObj?.pairImported == false) {
                await insertOne({
                    collection: "Messages",
                    document: {
                        receiverId: userObj._id,
                        message: announcement_msg.PRE_MATCH_ANNOUNCE,
                        msg_type: msg_Type.PRE_MATCH_ANNOUNCEMENT
                    }
                });
            }

            // Send application complete system badge when mentor or mentee complete their application 
            // updateApplicationCompleteSystemBadge({ data: { userId: request.user._id } });

            let query: any = {};
            let populate: any = {};
            if (request.user.partnerAdmin) {
                query = { partnerAdmin: request.user.partnerAdmin, role: userRoleConstant.P_SUPER_ADMIN, isDel: false, isDisabled: false };
                populate = { path: "partnerAdmin" };
            } else if (request.user.region) {
                query = { region: request.user.region, role: userRoleConstant.I_LOCAL_ADMIN, isDel: false, isDisabled: false }
                populate = { path: "region" }
            }

            let partner = await findOne({
                collection: "User",
                query,
                populate: [populate]
            });

            if (partner.partnerAdmin?.isIntroductoryMessage == true || partner.region?.isIntroductoryMessage == true) {
                sendMsg({
                    data: {
                        user_id: partner._id.toString(),
                        receiverId: request.user._id.toString(),
                        msg_type: msg_Type.INTRO_MESSAGE,
                        message: partner.partnerAdmin.introductoryMessage ? partner.partnerAdmin.introductoryMessage : partner.region.introductoryMessage
                    }
                });
            }

            res.status(statusCode.OK).send(success("User Created Successfully", { userObj }, statusCode.OK));

        } catch (err) {
            logger.error(`There was an issue into application complete.: ${err}`)
            res.status(statusCode.FORBIDDEN).send(error("There was an issue into application complete.", { err }, statusCode.FORBIDDEN));
        }
    },

    /* User profile pic upload function */
    uploadUserProfilePic: async (req: Request, res: Response) => {
        try {
            const { mentorId } = req.body;

            const isMentorExists = await findOne({ collection: 'User', query: { _id: mentorId, role: { $in: [userRoleConstant.MENTEE, userRoleConstant.MENTOR] } } });

            if (!isMentorExists) {
                res.status(statusCode.OK).send(error(errorMessage.NOT_EXISTS.replace(':attribute', 'Mentor'), {}, statusCode.NOT_FOUND))
                return
            }

            const file = req.file;
            const maxSize = uploadConstant.PROFILE_PIC_FILE_SIZE;
            const extArr = uploadConstant.PROFILE_PIC_EXT_ARRAY;

            // validate file
            const isValidFile = await validateFile(res, file, 'mentorProfilePic', extArr, maxSize, mentorId);

            if (isValidFile?.isEmpty) {
                res.status(statusCode.OK).send(success(successMessage.UPDATE_SUCCESS.replace(':attribute', "Profile picture"), isValidFile.data, statusCode.OK))
                return
            }

            if (isValidFile !== undefined && isValidFile) {
                res.status(statusCode.OK).send(error(isValidFile, {}, statusCode.BAD_REQUEST))
                return
            }

            const uploadFile: any = await uploadToS3(file, 'mentorProfilePic');

            let profilePic = '';
            let profilePicKey = '';

            if (uploadFile) {
                profilePic = uploadFile.Location;
                profilePicKey = uploadFile.key;
            }

            if (profilePic && profilePicKey && isMentorExists.profilePic !== "") {
                await deleteUploadedS3URL({ objectKey: isMentorExists.profilePicKey !== "" ? isMentorExists.profilePicKey : isMentorExists.profilePic });
            }

            const updateMentor = await findOneAndUpdate({
                collection: 'User',
                query: { _id: mentorId },
                update: {
                    $set: {
                        profilePic: profilePic,
                        profilePicKey: profilePicKey
                    }
                },
                options: { new: true }
            });

            res.status(statusCode.OK).send(success(successMessage.UPDATE_SUCCESS.replace(':attribute', "Profile picture"), updateMentor, statusCode.OK))

        } catch (err: any) {
            logger.error(`There was an issue into upload mentor profile pic.: ${err} `)
            res.status(statusCode.FORBIDDEN).send(error("There was an issue into upload mentor profile pic", { err }, statusCode.FORBIDDEN))
        }
    },

    /* User profile update function */
    userProfileUpdate: async (req: Request, res: Response) => {
        try {
            const request = req as requestUser;

            const { first_name, last_name, phone_no } = req.body;

            const userObj = await findOne({ collection: "User", query: { _id: request.user._id, isDel: false, role: { $in: [userRoleConstant.MENTEE, userRoleConstant.MENTOR] } } });

            if (!userObj) {
                res.status(statusCode.OK).send(error("User not exists!", {}, statusCode.NOT_FOUND));
                return;
            }

            const updateUser = await findOneAndUpdate({
                collection: 'User',
                query: { _id: userObj._id },
                update: { $set: { preferredFname: first_name, preferredLname: last_name, primaryPhoneNo: phone_no } },
                options: { new: true }
            });

            res.status(statusCode.OK).send(success(successMessage.UPDATE_SUCCESS.replace(':attribute', `${userObj.role}`), { updateUser }, statusCode.OK))

        } catch (err: any) {
            logger.error(`There was an issue into user profile update.: ${err} `)
            res.status(statusCode.FORBIDDEN).send(error("There was an issue into user profile update", { err }, statusCode.FORBIDDEN))
        }
    },

    /* Get all state list */
    getStateList: async (req: Request, res: Response) => {
        try {
            const statesList = stateList;

            res.status(statusCode.OK).send(success(successMessage.FETCH_SUCCESS.replace(':attribute', "state list"), statesList, statusCode.OK))
        } catch (err) {
            logger.error(`There was an issue into get state list.: ${err} `)
            res.status(statusCode.FORBIDDEN).send(error("There was an issue into get state list.", { err }, statusCode.FORBIDDEN))
        }
    },

    /* User detail function */
    getUserDetail: async (req: Request, res: Response) => {
        try {
            let request = req as requestUser;

            const userObj = await findOne(
                {
                    collection: 'User',
                    query: {
                        _id: request.user._id,
                        isDel: false,
                        $or: [{ onboardingStep: { $exists: false } }, { onboardingStep: { $lte: 5 } }]
                    },
                    populate: [
                        { path: "partnerAdmin" },
                        { path: "region" }
                    ]
                });

            if (!userObj) {
                res.status(statusCode.OK).send(success(successMessage.READ_SUCCESS.replace(":attribute", "User"), { onboardingStep: userObj.onboardingStep, userObj }, statusCode.OK));
                return
            }

            const additionalInfo = await findOne({
                collection: 'AdditionalInfo',
                query: {
                    userId: request.user._id,
                }
            });

            userObj.assignedSchoolOrInstitutions = additionalInfo?.education_level?.assignedSchoolOrInstitutions ?? [];

            // if (!additionalInfo) {
            //     res.status(statusCode.OK).send(
            //         success(successMessage.READ_SUCCESS.replace(":attribute", "User additional info"),
            //             { onboardingStep: userObj.onboardingStep, userObj, additionalInfo: additionalInfo ?? {} },
            //             statusCode.OK)
            //     );
            //     return
            // }

            let collection!: string;
            if (request.user.role == userRoleConstant.MENTOR) {
                collection = 'AnswerByMentors';
            } else if (request.user.role == userRoleConstant.MENTEE) {
                collection = 'AnswerByMentee';
            }

            const answerByMentors = await findOne({
                collection,
                query: {
                    user: request.user._id,
                }
            });

            if (!answerByMentors) {
                res.status(statusCode.OK).send(success(successMessage.READ_SUCCESS.replace(":attribute", "User answer by mentors"), { onboardingStep: userObj.onboardingStep, userObj, additionalInfo, answerByMentors }, statusCode.OK));
                return
            }

            if (request.user.role === userRoleConstant.MENTOR) {
                const answerByMentors = await findOne({
                    collection,
                    query: {
                        user: request.user._id,
                    },
                    populate: [{ path: "queAns.question" }]
                });

                userObj.assignedSchoolOrInstitutions = answerByMentors?.queAns?.map((ele: any) => {
                    return ele?.question?.question === "At what schools (colleges and graduate schools) did you study?" ? ele?.answer : []
                }).filter((item: any) => item.length > 0).flat();
            }

            res.status(statusCode.OK).send(success(successMessage.READ_SUCCESS.replace(':attribute', "Onboarding ist"), { userObj, additionalInfo: additionalInfo ?? {}, answerByMentors }, statusCode.OK))

        } catch (err: any) {
            logger.error(`There was an issue into update mentor basic info.: ${err}`)
            res.status(statusCode.FORBIDDEN).send(error("There was an issue into update mentor basic info.", { err }, statusCode.FORBIDDEN))
        }
    },

    /* School or institute list */
    schoolOrInstituteList: async (req: Request, res: Response) => {
        try {
            const { search } = req.body;

            // const SchoolOrInstitute = await findOne({
            //     collection: "AppSetting",
            //     query: { key: "SchoolOrInstitute" }
            // });

            let request = req as requestUser;

            let query: any = {
                isDel: false,
            }, list: any;
            if (request.user.region) {
                query['_id'] = request.user.region;
                list = await distinct({
                    collection: "Region",
                    field: 'assignedSchoolOrInstitute',
                    query: query,
                });
            } else if (request.user.partnerAdmin) {
                query['_id'] = request.user.partnerAdmin
                list = await distinct({
                    collection: "Partner",
                    field: 'assignedSchoolOrInstitute',
                    query: query,
                });
            }

            let SchoolOrInstituteList: any = [];
            SchoolOrInstituteList.sort((a: any, b: any) => a.toLowerCase().localeCompare(b.toLowerCase()));
            list.forEach((x: any) => {
                if (x.toLocaleLowerCase().search(search.toLocaleLowerCase()) > -1) {
                    SchoolOrInstituteList.push(x)
                }
            });

            res.status(statusCode.OK).send(success(successMessage.READ_SUCCESS.replace(':attribute', "School or institute list"), { SchoolOrInstitute: SchoolOrInstituteList }, statusCode.OK))

        } catch (err: any) {
            logger.error(`There was an issue into school or institute list.: ${err}`)
            res.status(statusCode.FORBIDDEN).send(error("There was an issue into school or institute list.", { err }, statusCode.FORBIDDEN))
        }
    },

    /* User inquiry function */ 
    createInquiry: async (req: Request, res: Response) => {
        try {
            const { legalFname, legalLname, gender, email, primaryPhoneNo, city, state, partnerAdmin } = req.body;

            const emailExists = await findOne({
                collection: "User",
                query: { email: email.toLowerCase(), isDel: false }
            });

            if (emailExists) {
                res.status(statusCode.OK).send(success("An inquiry for this email address is already on record.", {}, statusCode.BAD_REQUEST))
                return
            }

            let isPartner = await countDocuments({ collection: 'Partner', query: { _id: partnerAdmin } })

            const newInquiry = await insertOne({
                collection: "User",
                document: {
                    preferredFname: legalFname,
                    preferredLname: legalLname,
                    gender,
                    email: email.toLowerCase(),
                    primaryPhoneNo,
                    address: {
                        city,
                        state
                    },
                    partnerAdmin: isPartner > 0 ? partnerAdmin : null,
                    region: isPartner == 0 ? partnerAdmin : null,
                    role: userRoleConstant.MENTOR,
                    isDel: false,
                    status: userStatusConstant.PENDING
                }
            });

            res.status(statusCode.OK).send(success(successMessage.CREATE_SUCCESS.replace(':attribute', "Inquiry"), newInquiry, statusCode.OK))

        } catch (err: any) {
            if (err.code == 11000) {
                res.status(statusCode.OK).send(success(errorMessage.ALREADY_EXISTS.replace(':attribute', "Inquiry email"), {}, statusCode.OK))
            }
            logger.error(`There was an issue into create inquiry.: ${err}`)
            res.status(statusCode.FORBIDDEN).send(error("There was an issue into create inquiry.", { err }, statusCode.FORBIDDEN))
        }
    },

    /* Update device info */
    updateDeviceInfo: async (req: Request, res: Response) => {
        try {
            const payload = req.body;
            let request = req as requestUser;

            const user = findOne({ collection: 'User', query: { _id: request.user._id, isDel: false } });
            const notiManage = findOne({ collection: 'NotificationManage', query: { user_id: request.user._id } });

            const response: any = await Promise.allSettled([user, notiManage]);

            if (!response[0].value) {
                return res.status(404).json({ message: 'User not found.', success: true, data: {} });
            }

            var updateDeviceInfo;
            if (response[1].value) {
                updateDeviceInfo = await findOneAndUpdate({
                    collection: 'NotificationManage',
                    query: { user_id: request.user._id },
                    update: { deviceId: payload.deviceId, deviceType: payload.deviceType, systemNotification: payload.systemNotification },
                    options: { new: true }
                });
            } else {
                updateDeviceInfo = await insertOne({
                    collection: 'NotificationManage',
                    document: {
                        user_id: request.user._id,
                        deviceId: payload.deviceId,
                        deviceType: payload.deviceType,
                        systemNotification: payload.systemNotification
                    }
                })
            }

            return res.status(200).json({ message: 'Success', success: true, data: updateDeviceInfo });
        } catch (err: any) {
            logger.error(`There was an issue into create inquiry.: ${err}`)
            res.status(statusCode.FORBIDDEN).send(error("There was an issue into create inquiry.", { err }, statusCode.FORBIDDEN))
        }
    },

    // check user is online or not
    checkActiveUser: async (req: any) => {
        console.log("req : ", req);

        const userLength = await (global as any).pubClient.LLEN('activeUsers');
        // console.log("userLength :: ", userLength);

        const activeUsers = await (global as any).pubClient.LRANGE('activeUsers', 0, userLength);

        let result = false;
        if (activeUsers.indexOf(req) < 0) {
            result = true
        } else {
            result = false
        }
        return result
    },

    acceptCookieForUser: async (req: Request, res: Response) => {
        try {

            let request = req as requestUser;

            let userObj = await findOne({ collection: 'User', query: { _id: request.user._id, isDel: false } });

            if (!userObj) {
                res.status(statusCode.BAD_REQUEST).send(error(errorMessage.NOT_EXISTS.replace(":attribute", "User"), {}, statusCode.BAD_REQUEST));
                return
            }

            let updatedUser = await findOneAndUpdate({ collection: 'User', query: { _id: userObj._id }, update: { $set: { isCookieAccepted: req.body.isCookieAccepted } }, options: { new: true } });

            res.send(success("Cookie status updated successfully.", updatedUser, statusCode.OK))
        } catch (err: any) {
            res.status(statusCode.FORBIDDEN).send(error("There is some issue while accepting the cookie for website", err.message, statusCode.FORBIDDEN))
        }
    },

    allSchoolOrInstituteList: async (req: Request, res: Response) => {
        try {
            let list = await findOne({
                collection: "AppSetting",
                query: { key: "SchoolOrInstitute" },
            });

            (list?.value || []).sort((a: any, b: any) => { return a.localeCompare(b) });
            res.send(success(successMessage.FETCH_SUCCESS.replace(":attribute", "SchoolOrInstitute"), list?.value, statusCode.OK));
        } catch (err: any) {
            logger.error("partnerController > SchoolOrInstitute ", err);
            res
                .status(statusCode.FORBIDDEN)
                .send(error("There is some issue to Create SchoolOrInstitute list.", err.message, statusCode.FORBIDDEN));
        }
    },

    addNewSchoolOrInstituteInApp: async function (req: any, res: any) {
        try {
            let { SchoolOrInstitute } = req.body;
            let checkName = await findOne({
                collection: "AppSetting",
                query: {
                    value: { $in: [SchoolOrInstitute] },
                },
            });
            if (checkName) {
                return res
                    .status(statusCode.BAD_REQUEST)
                    .send(error(errorMessage.ALREADY_EXISTS.replace(":attribute", SchoolOrInstitute), {}, statusCode.BAD_REQUEST));
            }
            let data = await updateOne({
                collection: "AppSetting",
                query: { key: "SchoolOrInstitute", value: { $nin: [SchoolOrInstitute] } },
                update: { $push: { value: SchoolOrInstitute } },
            });
            res.send(success(successMessage.ADD_SUCCESS.replace(":attribute", "SchoolOrInstituteInApp"), {}, statusCode.OK));
        } catch (err: any) {
            logger.error("partnerController > addNewSchoolOrInstitute ", err);
            res
                .status(statusCode.FORBIDDEN)
                .send(error("There is some issue to Create addNewSchoolOrInstituteInApp .", err.message, statusCode.FORBIDDEN));
        }
    },

    updateMessageNotificationStatus: async function (req: Request, res: Response) {
        try {
            const { isEnable } = req.body;
            let request = req as requestUser;

            const updateStatus = await findOneAndUpdate({
                collection: 'NotificationManage',
                query: { user_id: request.user._id },
                update: { $set: { messageNotification: isEnable } },
                options: { new: true, upsert: true }
            });

            return res.status(statusCode.OK).send(success("Message notification status updated successfully.", updateStatus, statusCode.OK))
        } catch (err: any) {
            return res.status(statusCode.FORBIDDEN).send(error("There is some issue while update message notification status.", err.message, statusCode.FORBIDDEN))
        }
    }

};