import { Request, Response, request } from "express";
import { distinct, find, findOne, findOneAndUpdate, insertMany, insertOne, updateMany, paginate, aggregate, ObjectId, deleteMany, findOneAndDelete } from "../utils/db";
import { categoryOfQuestion, defaultProfilePicConstant, errorMessage, messageConstant, msg_Type, questionState, statusCode, statusType, successMessage, uploadConstant, userRoleConstant, userStatusConstant, ContentConstants, questionConst, User_Activity } from "../utils/const";
import { success, error } from "../utils/helpers/resSender";
import { logger } from "../utils/helpers/logger";
import { uploadToS3, validateFile } from "../utils/uploadFile";
import { stateList } from "../utils/state";
import { RegionList } from "../utils/region";
import { requestUser } from "../Interfaces/schemaInterfaces/user";
import { capitalizeFirstLetter, generateToken, generateTokenLoginAs, isEmailAlreadyExists } from "../utils/helpers/functions";
import { sendMail } from "../utils/helpers/sendEmail";
import csvtojson from 'csvtojson';
import fs from 'fs';
import _ from "lodash";
import { createOrGetUser, enrollCourse } from "../services/thinkific/thinkific.service";
import { sendMsg } from "./Web/message.controller";
import exportFileFunction from "../utils/exportCSV";
import mongoose from "mongoose";

export let mentorController = {

    addMentor: async (req: any, res: Response) => {
        try {
            const { fname, lname, preferredFname, preferredLname, email, recoveryEmail, primaryPhoneNo, secondaryPhoneNo, address, mentorProfilePic,
                demographicInformation, pronounciationName, employerInformation, programInformation, preloadMentees, references, legalStatus, physicalAndEmotionalCondition,
                queAns, primaryPhoneNoCountryCode, secondaryPhoneNoCountryCode, dob, isSaveAndExit, isSaveAndInvite, isField
            } = req.body;

            let status = "";

            let request = req as requestUser

            const isEmailExists: any = await isEmailAlreadyExists(email)

            if (!isEmailExists) {
                res.status(statusCode.BAD_REQUEST).send(error("Email already exists", {}, statusCode.BAD_REQUEST))
                return
            }

            let message = ""
            if (isSaveAndExit) {
                status = userStatusConstant.draft;
                message = successMessage.DRAFT_MESSAGE.replace(":attribute", 'Form')
            }

            if (isSaveAndInvite) {
                status = userStatusConstant.invited;
                message = successMessage.CREATE_SUCCESS.replace(':attribute', "Mentor")
            }

            if (isSaveAndExit && isField) {
                status = userStatusConstant.draft;
                message = successMessage.DRAFT_MESSAGE.replace(":attribute", 'Form')
            }

            if (email?.toLowerCase() == recoveryEmail?.toLowerCase()) {
                res.status(statusCode.BAD_REQUEST).send(error("Secondary email should differ from the primary email."));
                return
            }

            let basicInfoQuery: any = {
                legalFname: fname,
                legalLname: lname,
                preferredFname: preferredFname,
                preferredLname: preferredLname,
                pronounciationName: pronounciationName,
                dob: dob,
                email: email,
                role: userRoleConstant.MENTOR,
                recoveryEmail: recoveryEmail,
                primaryPhoneNo: primaryPhoneNo,
                secondaryPhoneNo: secondaryPhoneNo,
                address: address,
                primaryPhoneNoCountryCode: primaryPhoneNoCountryCode,
                secondaryPhoneNoCountryCode: secondaryPhoneNoCountryCode,
                status: status,
                isSaveAndExit: isSaveAndExit,
                isSaveAndInvite: isSaveAndInvite,
                isField: isField,
                profilePic: mentorProfilePic,
                createdBy: request.user._id
            }

            if (isSaveAndInvite && !isField) {
                basicInfoQuery['resentInvitationDate'] = new Date()
            }

            let partnerOrRegionObj: any = {}
            if (request.user.role == userRoleConstant.I_LOCAL_ADMIN) {
                basicInfoQuery['region'] = request.user.region ? request.user.region : null
                partnerOrRegionObj = await findOne({ collection: "AssignedCourses", query: { partnerIdOrRegionId: request.user.region, courseType: ContentConstants.COURSES_TYPE.training, isDefaultCourse: true }, populate: [{ path: 'thinkificCourseId', select: 'courseId' }] });
            } else if (request.user.role == userRoleConstant.P_LOCAL_ADMIN || request.user.role == userRoleConstant.P_SUPER_ADMIN) {
                basicInfoQuery['partnerAdmin'] = request.user.partnerAdmin ? request.user.partnerAdmin : ''
                partnerOrRegionObj = await findOne({ collection: "AssignedCourses", query: { partnerIdOrRegionId: request.user.partnerAdmin, courseType: ContentConstants.COURSES_TYPE.training, isDefaultCourse: true }, populate: [{ path: 'thinkificCourseId', select: 'courseId' }] });
            }

            // if (!partnerOrRegionObj) {
            //     res.status(statusCode.BAD_REQUEST).send(error(errorMessage.PLEASE_ADD_BEFORE.replace(":attribute", 'Default training').replace(":action", 'adding').replace(":value", 'Mentor'), {}, statusCode.BAD_REQUEST));
            //     return
            // }
            const mentor = await insertOne({ collection: 'User', document: basicInfoQuery })
            let matchingQuestion: any = {}, addtionalInfo: any = {};

            if (partnerOrRegionObj) {
                let thinkificUser = await createOrGetUser({ email, firstName: preferredFname, lastName: preferredLname })
                basicInfoQuery['thinkificUserId'] = thinkificUser['id']

                let enrollUserAtThinkific = await enrollCourse({ courseId: partnerOrRegionObj.thinkificCourseId.courseId, userId: thinkificUser.id, activatedAt: new Date().toISOString() })
                if (enrollUserAtThinkific) {
                    await insertOne({
                        collection: 'RecommendedCourses', document: {
                            courseId: partnerOrRegionObj.courseId,
                            userId: mentor._id,
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


            const additionalInfoQuery = {
                userId: mentor._id,
                programInformation: programInformation,
                employerInformation: employerInformation,
                demographicInformation: demographicInformation,
                preloadMentees: preloadMentees,
                references: references,
                legalStatus: legalStatus,
                physicalAndEmotionalCondition: physicalAndEmotionalCondition
            }

            addtionalInfo = await insertOne({ collection: 'AdditionalInfo', document: additionalInfoQuery });


            let { partnerAdmin, region } = await findOne({
                collection: "User",
                query: {
                    _id: req.user._id
                }
            })
            let createdBy = partnerAdmin ?? region


            const matchingQuestionQuery = {
                queAns: queAns,
                user: addtionalInfo.userId,
                createdBy
            }


            matchingQuestion = await insertOne({ collection: 'AnswerByMentors', document: matchingQuestionQuery });
            if (mentor && mentor.status == userStatusConstant.invited) {
                const url = process.env.FRONT_URL + `register?id=${mentor._id}`;

                const userRes = _.pick(mentor, 'email', "role", "legalFname", "legalLname", "preferredFname", "preferredLname", "primaryPhoneNo", "status", "_id")

                var template = fs.readFileSync(__dirname + "/../../src/utils/emailTemplates/headerfooter.html").toString();
                var content = fs.readFileSync(__dirname + "/../../src/utils/emailTemplates/registerUserInvitation.html").toString();
                content = content.replace(/{{fullname}}/g, (mentor.preferredFname + " " + mentor.preferredLname));
                content = content.replace(/{{adminUserName}}/g, (request.user.legalFname + " " + request.user.legalLname));
                content = content.replace(/{{adminUserRole}}/g, request.user.role)
                content = content.replace(/{{adminUserProfilePic}}/g, request.user.profilePic ? request.user.profilePic : defaultProfilePicConstant.USER_PROFILE_PIC)
                content = content.replace(/{{url}}/g, url)
                template = template.replace(/{{template}}/g, content);

                sendMail(userRes.email, `You're Registered for iMentor`, 'iMentor', template);

            }
            res.send(success(message, { mentor, addtionalInfo, matchingQuestion, isAuditLog: true, audit: User_Activity.CREATE_NEW_MENTOR }, statusCode.OK))

        } catch (err: any) {
            logger.error(`There was an issue into create mentor.: ${err} `)
            res.status(statusCode.FORBIDDEN).send(error(err.message))
        }
    },

    getMentors: async (req: Request, res: Response) => {
        try {
            let request = req as requestUser
            const { search, sort, page, limit, status } = req.body;

            let location: Array<any> = req.body?.location || [];
            let isSortEmpty = _.isEmpty(sort);

            let query: any = {
                role: userRoleConstant.MENTOR,
                isDel: false,
                status: userStatusConstant.PENDING
            }

            if (request.user.region) {
                query['region'] = request.user.region
            } else if (request.user.partnerAdmin) {
                query['partnerAdmin'] = request.user.partnerAdmin
            }

            let sortKey: Array<any> = [], sortQuery: any;
            if (sort) {
                sortKey = Object.keys(sort)
            }

            if (search) {
                const searchText = search.split(" ")
                if (searchText && searchText.length > 1) {
                    query['$or'] = [{ preferredFname: new RegExp(searchText[0], 'i') }, { preferredLname: new RegExp(searchText[1], 'i') }]
                } else {
                    query['$or'] = [{ preferredFname: new RegExp(search, 'i') }, { preferredLname: new RegExp(search, 'i') }]
                }
            }

            if (status) {
                query = {
                    ...query,
                    status: userStatusConstant.REJECT
                }
            }

            if (location?.length > 0) {
                query = {
                    ...query,
                    'address.city': { $in: location }
                }
            }

            let pipeLine: any = [
                {
                    $match: query
                },
                {
                    $lookup: {
                        from: 'partners',
                        localField: 'partnerAdmin',
                        foreignField: '_id',
                        as: 'partner'
                    }
                },
                {
                    $unwind: {
                        path: '$partner',
                        preserveNullAndEmptyArrays: true
                    }
                },
                {
                    $lookup: {
                        from: 'regions',
                        localField: 'region',
                        foreignField: '_id',
                        as: 'region'
                    }
                },
                {
                    $unwind: {
                        path: '$region',
                        preserveNullAndEmptyArrays: true
                    }
                },
                {
                    $project: {
                        mentorName: { $concat: ['$preferredFname', " ", "$preferredLname"] },
                        preferredFname: 1,
                        preferredLname: 1,
                        role: 1,
                        status: 1,
                        email: 1,
                        city: '$address.city',
                        state: '$address.state',
                        createdAt: 1,
                        rejectDate: 1,
                        rejectReason: 1,
                        partnerName: '$partner.partnerName',
                        region: '$region.region',
                        requestMoreInfoDate: 1
                    }
                }
            ];

            let limitQuery: any;
            if (limit) {
                limitQuery = { $limit: limit }
            }

            let skipQuery: any;
            if (page) {
                skipQuery = { $skip: (page - 1) * limit }
            }

            if (sortKey[0]) {
                var sortPipeLine: any = {}
                pipeLine.push({
                    $addFields: {
                        "insensitive": {
                            "$toLower": sortQuery ? sortQuery : `$${sortKey[0]}`
                        }
                    }
                })

                sortPipeLine = { $sort: (!isSortEmpty) ? { 'insensitive': sort[sortKey[0]] } : { 'createdAt': -1 } }
                pipeLine.push(sortPipeLine)
            } else {
                pipeLine.push({ $sort: { 'createdAt': -1 } })
            }

            pipeLine.push(skipQuery)
            pipeLine.push(limitQuery)

            const mentor = await aggregate({ collection: 'User', pipeline: pipeLine })

            let result = {
                docs: mentor,
                page: page,
                pages: Math.ceil(mentor.length / limit),
                total: mentor.length,
                limit: limit,
            };

            // const mentor = await paginate({ collection: 'User', query: query, options: { populate: [{ path: 'partnerAdmin', select: 'partnerName' }, { path: 'region', select: 'region' }], page: page, sort: sort, limit: limit } });

            res.send(success(successMessage.FETCH_SUCCESS.replace(':attribute', "Mentor"), result, statusCode.OK))

        } catch (err) {
            logger.error(`There was an issue into get mentor.: ${err} `)
            res.status(statusCode.FORBIDDEN).send(error("There was an issue into get mentor", err))
        }
    },

    getSingleMentor: async (req: Request, res: Response) => {
        try {

            const { mentorId } = req.body;

            let mentorPipeLine: any = [
                {
                    $match: { _id: new ObjectId(mentorId) }
                },
                {
                    '$lookup': {
                        'from': 'pairinfos',
                        'localField': '_id',
                        'foreignField': 'mentorId',
                        'as': 'result'
                    }
                },
                {
                    $lookup: {
                        from: "pairinfos",
                        let: { mentor: "$_id", },
                        pipeline: [
                            {
                                $match: {
                                    $expr: {
                                        $and: [{ $eq: ["$isConfirm", true] }, { $eq: ["$mentorId", "$$mentor"] }],
                                    },
                                },
                            },
                        ],
                        as: "confirmedPair",
                    },
                },
                {
                    '$project': {
                        'legalFname': 1,
                        'legalLname': 1,
                        "preferredFname": 1,
                        "preferredLname": 1,
                        'address': 1,
                        'onboardingStep': 1,
                        'preMatchStep': 1,
                        'status': {
                            '$cond': [
                                {
                                    '$and': [
                                        { '$gt': ["$onboardingStep", 1] },
                                        { '$lte': ["$onboardingStep", 4] },
                                        { '$eq': ["$status", "Draft"] }
                                    ]
                                },
                                "In Progress",
                                {
                                    '$cond': [
                                        {
                                            '$and': [
                                                { '$eq': ["$onboardingStep", 5] },
                                                { '$lte': ["$preMatchStep", 4] },
                                                { '$eq': ["$status", "Draft"] },
                                            ]
                                        },
                                        "Completed",
                                        "$status"
                                    ]
                                }
                            ]
                        },
                        'profilePic': 1,
                        'matches': {
                            '$size': '$result'
                        },
                        'mentees': {
                            '$size': '$confirmedPair'
                        },
                        'isSaveAndExit': 1,
                        'isSaveAndInvite': 1,
                        'isField': 1,
                        'createdAt': 1
                    }
                }
            ]

            const matchesAndmentees = await aggregate({ collection: 'User', pipeline: mentorPipeLine })

            let mentor = await findOne({ collection: 'User', query: { _id: mentorId, role: userRoleConstant.MENTOR, isDel: false } });

            const additionalInfo = await findOne({ collection: 'AdditionalInfo', query: { userId: mentorId } })

            const matchingQuestion = await findOne({ collection: 'AnswerByMentors', query: { user: mentorId } })

            mentor.matches = matchesAndmentees[0].matches ? matchesAndmentees[0].matches : 0;
            mentor.mentees = matchesAndmentees[0].mentees ? matchesAndmentees[0].mentees : 0;
            mentor.status = matchesAndmentees[0].status ? matchesAndmentees[0].status : "";

            mentor.additionalInfo = additionalInfo ? additionalInfo : {};

            mentor.matchingQuestion = matchingQuestion ? matchingQuestion : {};

            res.send(success(successMessage.FETCH_SUCCESS.replace(':attribute', "Mentor"), mentor, statusCode.OK))

        } catch (err) {
            logger.error(`There was an issue into get mentor.: ${err} `)
            res.status(statusCode.FORBIDDEN).send(error("There was an issue into get mentor", err))
        }
    },

    updateMentor: async (req: Request, res: Response) => {
        try {
            const { mentorId, fname, lname, preferredFname, preferredLname, recoveryEmail, primaryPhoneNo, secondaryPhoneNo, address,
                demographicInformation, pronounciationName, employerInformation, programInformation, preloadMentees, references, legalStatus, physicalAndEmotionalCondition,
                queAns, primaryPhoneNoCountryCode, secondaryPhoneNoCountryCode, dob, mentorProfilePic, isField
            } = req.body;

            let { email } = req.body;

            const isMentorExists = await findOne({
                collection: 'User', query: {
                    _id: mentorId,
                    email: email.toLowerCase()
                }
            })

            if (isMentorExists) {
                email = email.toLowerCase();

            } else {
                const isEmailExists = await findOne({
                    collection: 'User', query: {
                        _id: { $ne: mentorId },
                        email: email.toLowerCase()
                    }
                })

                if (isEmailExists) {
                    res.status(statusCode.BAD_REQUEST).send(error("Email already exists", {}, statusCode.BAD_REQUEST))
                    return
                }

                email = email.toLowerCase()
            }

            let basicInfoQuery: any = {
                legalFname: fname,
                legalLname: lname,
                preferredFname: preferredFname,
                preferredLname: preferredLname,
                pronounciationName: pronounciationName,
                dob: dob,
                email: email.toLowerCase(),
                recoveryEmail: recoveryEmail ? recoveryEmail.toLowerCase() : '',
                primaryPhoneNo: primaryPhoneNo,
                secondaryPhoneNo: secondaryPhoneNo ? secondaryPhoneNo : '',
                address: address,
                primaryPhoneNoCountryCode: primaryPhoneNoCountryCode,
                secondaryPhoneNoCountryCode: secondaryPhoneNoCountryCode,
                profilePic: mentorProfilePic,
                isField: isField
            }

            const mentor = await findOneAndUpdate({
                collection: 'User', query: {
                    _id: mentorId
                },
                update: {
                    $set: basicInfoQuery
                }
            });

            const additionalInfoQuery = {
                programInformation: programInformation,
                employerInformation: employerInformation,
                demographicInformation: demographicInformation,
                preloadMentees: preloadMentees,
                references: references,
                legalStatus: legalStatus,
                physicalAndEmotionalCondition: physicalAndEmotionalCondition
            }

            const addtionalInfo = await findOneAndUpdate({
                collection: 'AdditionalInfo', query: {
                    userId: mentorId,
                },
                update: {
                    $set: additionalInfoQuery
                }, options: {
                    new: true,
                    upsert: true
                }
            });

            const matchingQuestionQuery = {
                queAns: queAns,
            }

            const matchingQuestion = await findOneAndUpdate({
                collection: 'AnswerByMentors', query: {
                    user: mentorId,
                },
                update: {
                    $set: matchingQuestionQuery
                },
                options: {
                    new: true,
                    upsert: true
                }
            });

            let audit;
            if (isMentorExists.profilePic != mentorProfilePic) {
                audit = User_Activity.MENTOR_LOGO_UPDATED
            } else {
                audit = User_Activity.MENTOR_DATA_UPDATED
            }

            res.send(success(successMessage.UPDATE_SUCCESS.replace(':attribute', "Mentor"), { mentor, addtionalInfo, matchingQuestion, isAuditLog: true, audit }, statusCode.OK))

        } catch (err) {
            logger.error(`There was an issue into create mentor.: ${err} `)
            res.status(statusCode.FORBIDDEN).send(error("There was an issue into update mentor", err))
        }
    },

    deleteMentor: async (req: Request, res: Response) => {
        try {

            const { isInquiry } = req.body;
            let message = '';
            var mentor;

            if (isInquiry) {
                message = successMessage.DELETE_SUCCESS.replace(':attribute', "Inquiry")

                mentor = await deleteMany({ collection: 'User', query: { _id: req.body.mentorId } });

            } else {
                message = successMessage.REMOVE.replace(':attribute', "Mentor")
                let menteeList = await distinct({ collection: 'PairInfo', field: 'menteeId', query: { mentorId: req.body.mentorId } });
                await deleteMany({ collection: "PairInfo", query: { mentorId: req.body.mentorId } })
                // await updateMany({ collection: 'PairInfo', query: { mentorId: req.body.mentorId }, update: { isDel: true } });
                await updateMany({ collection: "User", query: { _id: { $in: menteeList } }, update: { $set: { status: userStatusConstant.Matching } } });

                mentor = await updateMany({ collection: 'User', query: { _id: req.body.mentorId, role: userRoleConstant.MENTOR }, update: { $set: { isDel: true } } });
                await updateMany({ collection: 'AnswerByMentors', query: { user: req.body.mentorId }, update: { $set: { status: userStatusConstant.PENDING } } });

                await updateMany({ collection: 'Messages', query: { $or: [{ senderId: req.body.mentorId }, { receiverId: req.body.mentorId }] }, update: { isDel: true } });
                await deleteMany({ collection: 'EventGuest', query: { userId: req.body.mentorId } });

                await updateMany({ collection: 'Event', query: { guest: { $in: req.body.mentorId } }, update: { $pull: { guest: { $in: req.body.mentorId } } } })
                await updateMany({ collection: 'Group', query: { groupMember: { $in: req.body.mentorId } }, update: { $pull: { groupMember: { $in: req.body.mentorId } } } })
            }

            res.send(success(message, {
                ...mentor, auditIds: req.body.mentorId, isAuditLog: true, audit: req.body.mentorId?.length > 1 ? User_Activity.MULTIPLE_MENTOR_DELETED : User_Activity.MENTOR_DELETED
            }, statusCode.OK))

        } catch (err) {
            logger.error(`There was an issue into delete mentor.: ${err} `)
            res.status(statusCode.FORBIDDEN).send(error("There was an issue into delete mentor", err))
        }
    },

    getAllmentorStateAndCity: async (req: Request, res: Response) => {
        try {
            let request = req as requestUser;

            let status: Array<any> = [], regionOrPartner: Array<any> = [];

            status.push(
                userStatusConstant.draft,
                userStatusConstant.invited,
                userStatusConstant.Not_Started,
                userStatusConstant.inProgress,
                userStatusConstant.Completed,
                userStatusConstant.Matching,
                userStatusConstant.Matched,
                userStatusConstant.MATCHED_NOT_REGISTERED
            )

            let query: any = {}

            if (request.user.partnerAdmin) {
                query['partnerAdmin'] = request.user.partnerAdmin
            } else if (request.user.region) {
                query['region'] = request.user.region
            }

            query['role'] = userRoleConstant.MENTOR

            const mentorCity = await distinct({ collection: 'User', field: 'address.city', query: query });

            const mentorState = await distinct({ collection: 'User', field: 'address.state', query: { role: userRoleConstant.MENTOR } });

            query = {};

            if (request.user.partnerAdmin) {
                query['_id'] = request.user.partnerAdmin
            } else if (request.user.region) {
                query['_id'] = request.user.region
            }

            const regionList = await find({ collection: 'Region', query: query, project: { 'region': 1 } })

            const partnerList = await find({ collection: 'Partner', query: query, project: { 'partnerName': 1 } })

            regionOrPartner = partnerList.concat(regionList)

            mentorCity.sort((a: any, b: any) => { return a.localeCompare(b) })
            mentorState.sort((a: any, b: any) => { return a.localeCompare(b) })
            // regionOrPartner.sort((a: any, b: any) => { return a.value.localeCompare(b.value) })

            res.send(success(successMessage.DELETE_SUCCESS.replace(':attribute', "Mentor"), { mentorCity, mentorState, status, regionOrPartner }, statusCode.OK))

        } catch (err) {
            logger.error(`There was an issue into delete mentor.: ${err} `)
            res.status(statusCode.FORBIDDEN).send(error("There was an issue into delete mentor", err))
        }
    },

    approveAndRejectMentor: async (req: Request, res: Response) => {
        try {
            let request = req as requestUser
            const { mentorId, status, rejectReason } = req.body;
            const isMentorExists = await findOne({ collection: 'User', query: { _id: mentorId, role: userRoleConstant.MENTOR } });

            if (!isMentorExists) {
                res.status(statusCode.BAD_REQUEST).send(error(errorMessage.NOT_EXISTS.replace(':attribute', 'mentor')))
            }

            let reason = '', rejectDate, message = '';
            if (status == userStatusConstant.REJECT) {
                if (!rejectReason) {
                    res.status(statusCode.BAD_REQUEST).send(error(errorMessage.REQUIRED.replace(':attribute', 'rejectReason')))
                }
                reason = rejectReason;
                rejectDate = new Date();

                message = "Inquiry has been successfully rejected "
            }

            if (status == userStatusConstant.invited) {
                reason = ''
                message = "User has been successfully approved. You will find mentor details in Mentor List."
                // message = successMessage.APPROVE_SUCESS.replace(':attribute', 'Mentor inquiry')
            }

            const updateData = {
                status: status,
                rejectReason: reason,
                rejectDate: rejectDate
            }

            const updateStatus = await findOneAndUpdate({
                collection: 'User',
                query: { _id: mentorId, role: userRoleConstant.MENTOR },
                update: updateData
            });


            if (status == userStatusConstant.invited) {
                const subject = "Mentor Invitation";

                const despcription = process.env.FRONT_URL + `register?id=${updateStatus._id}`;

                var template = fs.readFileSync(__dirname + "/../../src/utils/emailTemplates/headerfooter.html").toString();
                var content = fs.readFileSync(__dirname + "/../../src/utils/emailTemplates/sendInvitation.html").toString();
                content = content.replace(/{{fullname}}/g, (updateStatus.preferredFname + " " + updateStatus.preferredLname));
                content = content.replace(/{{url}}/g, despcription);
                content = content.replace(/{{adminUserName}}/g, (request.user.legalFname + " " + request.user.legalLname));
                content = content.replace(/{{adminUserRole}}/g, request.user.role);
                content = content.replace(/{{adminProfilePic}}/g, request.user.profilePic ? request.user.profilePic : defaultProfilePicConstant.USER_PROFILE_PIC);
                template = template.replace(/{{template}}/g, content)

                sendMail(updateStatus.email, subject, 'Mentor Invitation', template);
            }

            if (status == userStatusConstant.REJECT) {
                const subject = "Mentor Invitation";

                const despcription = process.env.FRONT_URL + `register?id=${updateStatus._id}`;

                var template = fs.readFileSync(__dirname + "/../../src/utils/emailTemplates/headerfooter.html").toString();
                var content = fs.readFileSync(__dirname + "/../../src/utils/emailTemplates/rejectInvitation.html").toString();
                content = content.replace(/{{fullname}}/g, (updateStatus.preferredFname + " " + updateStatus.preferredLname));
                content = content.replace(/{{reason}}/g, reason);
                content = content.replace(/{{url}}/g, despcription);
                content = content.replace(/{{adminUserName}}/g, (request.user.legalFname + " " + request.user.legalLname));
                content = content.replace(/{{adminUserRole}}/g, request.user.role);
                content = content.replace(/{{adminProfilePic}}/g, request.user.profilePic ? request.user.profilePic : defaultProfilePicConstant.USER_PROFILE_PIC);
                template = template.replace(/{{template}}/g, content)

                sendMail(updateStatus.email, subject, 'Mentor Invitation', template);
            }

            res.send(success(message, { updateStatus, isAuditLog: true, audit: User_Activity.MENTOR_INQUIRY_REQUEST_STATUS_UPDATED }, statusCode.OK))

        } catch (err) {
            logger.error(`There was an issue into update mentor.: ${err} `)
            res.status(statusCode.FORBIDDEN).send(error("There was an issue into delete mentor", err))
        }
    },

    uploadMentorProfilePic: async (req: Request, res: Response) => {
        try {
            const { mentorId } = req.body;

            const isMentorExists = await findOne({ collection: 'User', query: { _id: mentorId, role: userRoleConstant.MENTOR } });

            if (!isMentorExists) {
                res.status(statusCode.BAD_REQUEST).send(error(errorMessage.NOT_EXISTS.replace(':attribute', 'mentor')))
                return
            }

            const file = req.file;
            const maxSize = uploadConstant.PROFILE_PIC_FILE_SIZE;
            const extArr = uploadConstant.PROFILE_PIC_EXT_ARRAY;

            // validate file
            let validateUplaodedFile = await validateFile(res, file, 'mentorProfilePic', extArr, maxSize);

            if (validateUplaodedFile) {
                res.status(statusCode.BAD_REQUEST).send(error(validateUplaodedFile, {}, statusCode.BAD_REQUEST))
                return
            }

            const uploadFile: any = await uploadToS3(file, 'mentorProfilePic');

            let profilePic = '';
            let profilePicKey = '';

            if (uploadFile) {
                profilePic = uploadFile.Location;
                profilePicKey = uploadFile.key;
            }

            const updateMentor = await findOneAndUpdate({
                collection: 'User',
                query: { _id: mentorId, role: userRoleConstant.MENTOR },
                update: {
                    $set: {
                        profilePic: profilePic,
                        profilePicKey: profilePicKey
                    }
                }
            })

            res.status(statusCode.OK).send(success(successMessage.UPLOAD_SUCCESS.replace(':attribute', "profile pic"), updateMentor))

        } catch (err) {
            logger.error(`There was an issue into upload file.: ${err} `)
            res.status(statusCode.FORBIDDEN).send(error("There was an issue into upload file", err))
        }
    },

    removeMentorProfilePic: async (req: Request, res: Response) => {
        try {
            const { mentorId } = req.body;

            const updateMentor = await findOneAndUpdate({
                collection: 'User',
                query: { _id: mentorId, role: userRoleConstant.MENTOR },
                update: {
                    $set: {
                        profilePic: "",
                        profilePicKey: ""
                    }
                }
            })

            res.status(statusCode.OK).send(success(successMessage.REMOVE.replace(':attribute', "profile pic"), updateMentor))

        } catch (err) {
            logger.error(`There was an issue into remove profile picture.: ${err} `)
            res.status(statusCode.FORBIDDEN).send(error("There was an issue into remove profile picture.", err))
        }
    },

    getMatchingQuestion: async (req: Request, res: Response) => {
        try {

            let request = req as requestUser

            let query: any = {}
            if (request.user.region) {
                query['regionId'] = request.user.region
            } else if (request.user.partnerAdmin) {
                query['partnerId'] = request.user.partnerAdmin
            } else {
                query['$or'] = [{ partnerId: new ObjectId(req.body.partnerIdOrRegionId) }, { regionId: new ObjectId(req.body.partnerIdOrRegionId) }];
            }

            query['status'] = questionState.ACTIVE

            let pipeLine: Array<any> = [
                {
                    $match: query
                },
                {
                    $addFields: {
                        question: { $cond: [{ $eq: ['$isAlternateQuestion', true] }, '$alternateQuestion', '$question'] }
                    }
                },
                {
                    $sort: {
                        orderNum: 1
                    }
                }
            ]

            query['category'] = categoryOfQuestion.PERSONALITY_AND_INTERESTS
            const getPersonalityQue = await aggregate({ collection: "Matches", pipeline: pipeLine })

            query['category'] = categoryOfQuestion.CREEAR_AND_EXPERIENCE

            const getCareerQue = await aggregate({ collection: "Matches", pipeline: pipeLine })

            query['category'] = categoryOfQuestion.EDUCATION_INFORMATION;

            let getEducationQue: any = await aggregate({ collection: "Matches", pipeline: pipeLine })

            const getExternalSchool = await findOne({ collection: "AppSetting" })

            let school = [];

            for (let i = 0; i < getExternalSchool.value.length; i++) {
                const schoolName = getExternalSchool.value[i];
                school.push({
                    option: schoolName
                })
            }

            for (let i = 0; i < getEducationQue.length; i++) {
                if (getEducationQue[i].question == questionConst.School_Question) {
                    getEducationQue[i].option = getEducationQue[i].option.concat(school)
                }
                const uniqueIds = new Set();

                const uniqueArray = getEducationQue[i].option.filter((obj: any) => {
                    if (!uniqueIds.has(obj.option.toLowerCase())) {
                        uniqueIds.add(obj.option.toLowerCase());
                        return true;
                    }
                    return false;
                });

                getEducationQue[i].option = uniqueArray;
            }

            res.send(success(successMessage.UPLOAD_SUCCESS.replace(':attribute', "profile pic"), { getPersonalityQue, getCareerQue, getEducationQue }, statusCode.OK))

        } catch (err) {
            logger.error(`There was an issue into upload file.: ${err} `)
            res.status(statusCode.FORBIDDEN).send(error("There was an issue into upload file", err))
        }
    },

    getStateList: async (req: Request, res: Response) => {
        try {
            const statesList = stateList;

            res.send(success(successMessage.FETCH_SUCCESS.replace(':attribute', "state list"), statesList, statusCode.OK))
        } catch (err) {
            logger.error(`There was an issue into get state list.: ${err} `)
            res.status(statusCode.FORBIDDEN).send(error("There was an issue into get state list.", err))
        }
    },

    getCurretnMentor: async (req: Request, res: Response) => {
        try {
            let request = req as requestUser
            const { search, sort, status, partnerIdOrRegionId } = req.body;
            let location: Array<any> = req.body?.location || []
            let { page, limit } = req.body;

            let isSortEmpty = _.isEmpty(sort)
            let query: any = {
                role: userRoleConstant.MENTOR,
                isDel: false,
                status: { $nin: [userStatusConstant.PENDING, userStatusConstant.REJECT] }
            }

            if (request.user.region) {
                query['region'] = request.user.region
            } else if (request.user.partnerAdmin) {
                query['partnerAdmin'] = request.user.partnerAdmin
            }
            var sortKey: Array<any> = []
            if (sort) {
                sortKey = Object.keys(sort)
            }

            if (partnerIdOrRegionId && partnerIdOrRegionId.length > 0) {
                let partnerIdOrRegionIds = partnerIdOrRegionId.map((x: any) => {
                    return new mongoose.Types.ObjectId(x)
                })
                query['$or'] = [{ partnerAdmin: { $in: partnerIdOrRegionIds } }, { region: { $in: partnerIdOrRegionIds } }];
            }

            if (location?.length > 0) {
                query = {
                    ...query,
                    'address.city': { $in: location }
                }
            }

            let sortQuery: any, mentorPipeLine: any = []
            if (sortKey[0] == "address") {
                sortQuery = '$address.city'
            }

            if (req.body.search) {
                mentorPipeLine.push({
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
                        preferredFname: "$preferredFname",
                        preferredLname: "$preferredLname"
                    }
                },
                    {
                        $match: {
                            $or: [
                                { user_name: { $regex: '.*' + req.body.search + '.*', $options: 'i' } },
                                { reverseUsername: { $regex: '.*' + req.body.search + '.*', $options: 'i' } },
                                { withoutBlankName: { $regex: '.*' + req.body.search + '.*', $options: 'i' } },
                                { preferredFname: { $regex: '.*' + req.body.search + '.*', $options: 'i' } },
                                { preferredLname: { $regex: '.*' + req.body.search + '.*', $options: 'i' } },
                                { reverseWithoutBlankName: { $regex: '.*' + req.body.search + '.*', $options: 'i' } }
                            ]
                        }
                    })
            }

            mentorPipeLine = [
                ...mentorPipeLine,
                {
                    $match: query
                },
                {
                    '$lookup': {
                        'from': 'pairinfos',
                        'localField': '_id',
                        'foreignField': 'mentorId',
                        'as': 'result'
                    }
                },
                {
                    '$lookup': {
                        'from': 'notes',
                        'let': {
                            'createdFor': '$_id'
                        },
                        'pipeline': [
                            {
                                '$match': {
                                    '$expr': {
                                        '$eq': [
                                            '$createdFor', '$$createdFor'
                                        ]
                                    },
                                    // 'role': userRoleConstant.MENTOR
                                }
                            }
                        ],
                        'as': 'notes'
                    }
                },
                {
                    $lookup: {
                        from: "pairinfos",
                        let: { mentor: "$_id", },
                        pipeline: [
                            {
                                $match: {
                                    $expr: {
                                        $and: [{ $eq: ["$isConfirm", true] }, { $eq: ["$mentorId", "$$mentor"] }],
                                    },
                                },
                            },
                        ],
                        as: "confirmedPair",
                    },
                },
                {
                    '$lookup': {
                        'from': 'partners',
                        'localField': 'partnerAdmin',
                        'foreignField': '_id',
                        'as': 'partners'
                    }
                },
                {
                    $unwind: {
                        path: '$partners',
                        preserveNullAndEmptyArrays: true
                    }
                },
                {
                    '$lookup': {
                        'from': 'regions',
                        'localField': 'region',
                        'foreignField': '_id',
                        'as': 'regions'
                    }
                },
                {
                    $unwind: {
                        path: '$regions',
                        preserveNullAndEmptyArrays: true
                    }
                },
                {
                    $addFields: {
                        partnerOrRegion: { $ifNull: ['$partners', '$regions'] }
                    }
                },
                {
                    '$project': {
                        'legalFname': 1,
                        'legalLname': 1,
                        "preferredFname": 1,
                        "preferredLname": 1,
                        'address': 1,
                        'email': 1,
                        'onboardingStep': 1,
                        'preMatchStep': 1,
                        'status': {
                            '$cond': [
                                {
                                    '$and': [
                                        { '$gt': ["$onboardingStep", 1] },
                                        { '$lte': ["$onboardingStep", 4] },
                                        { '$eq': ["$status", "Draft"] }
                                    ]
                                },
                                "In Progress",
                                {
                                    '$cond': [
                                        {
                                            '$and': [
                                                { '$eq': ["$onboardingStep", 5] },
                                                { '$lte': ["$preMatchStep", 4] },
                                                { '$eq': ["$status", "Draft"] },
                                            ]
                                        },
                                        "Completed",
                                        "$status"
                                    ]
                                }
                            ]
                        },
                        'profilePic': 1,
                        'matches': {
                            '$size': '$result'
                        },
                        'mentees': {
                            '$size': '$confirmedPair'
                        },
                        'notes': {
                            '$size': '$notes'
                        },
                        'isSaveAndExit': 1,
                        'isSaveAndInvite': 1,
                        'isField': 1,
                        'createdAt': 1,
                        'userActivationDate': 1,
                        'resentInvitationDate': { $cond: [{ $eq: ['$status', userStatusConstant.draft] }, '', { $ifNull: ['$resentInvitationDate', '$createdAt'] }] },
                        partnerOrRegion: /* '$partnerOrRegion' */ {
                            $cond: [{ $ifNull: ['$partnerOrRegion.partnerName', null] }, '$partnerOrRegion.partnerName', '$partnerOrRegion.region']
                        },
                        pairImported: 1,
                        password: 1
                    }
                }
            ]

            if (status?.length > 0) {
                mentorPipeLine.push({
                    $match: {
                        status: { $in: status }
                    }
                })
            }

            if (sortKey[0]) {
                var sortPipeLine: any = {}
                mentorPipeLine.push({
                    $addFields: {
                        "insensitive": {
                            "$toLower": sortQuery ? sortQuery : `$${sortKey[0]}`
                        }
                    }
                })
                if (sortKey[0] == 'matches' || sortKey[0] == "mentees") {
                    sortPipeLine = { $sort: (!isSortEmpty) ? sort : { 'createdAt': -1 } }
                } else {
                    sortPipeLine = { $sort: (!isSortEmpty) ? { 'insensitive': sort[sortKey[0]] } : { 'createdAt': -1 } }
                }

                mentorPipeLine.push(sortPipeLine)
            } else {
                mentorPipeLine.push({ $sort: { 'createdAt': -1 } })
            }


            mentorPipeLine = [
                ...mentorPipeLine,
                {
                    '$facet': {
                        metadata: [{ $count: "total" }],
                        data: [{ $skip: (req.body.limit * (req.body.page - 1)) }, { $limit: req.body.limit }] // add projection here wish you re-shape the docs
                    }
                },
                {
                    $unwind: '$metadata'
                }

            ]

            if (sort) {
                // mentorPipeLine.push({ $sort: sort })
            } else {
                mentorPipeLine.push({ $sort: { 'updatedAt': -1 } })
            }

            let docs: any = [
                {
                    $match: query
                },
                {
                    '$lookup': {
                        'from': 'pairinfos',
                        'localField': '_id',
                        'foreignField': 'mentorId',
                        'as': 'result'
                    }
                }, {
                    '$project': {
                        'legalFname': 1,
                        'legalLname': 1,
                        'address': 1,
                        'status': 1,
                        'matches': {
                            '$size': '$result'
                        },
                        'mentees': {
                            '$size': '$result'
                        },
                        'createdAt': 1
                    }
                }
            ]

            docs.push({ "$count": "legalFname" })

            const mentor = await aggregate({ collection: 'User', pipeline: mentorPipeLine })

            let totalDocs = 0;

            if (mentor && mentor) {
                totalDocs = mentor[0]?.metadata?.total || 0
            }

            let pages = Math.ceil(totalDocs / limit);

            // for (let i = 0; i < mentor[0]?.data.length; i++) {
            //     if (!mentor[0]?.data[i].password && mentor[0]?.data[i].pairImported == true) {
            //         mentor[0].data[i].isLoginAS = true
            //     } else {
            //         mentor[0].data[i].isLoginAS = false
            //     }
            // }

            res.send(success(successMessage.FETCH_SUCCESS.replace(':attribute', "Mentor"), { mentor: mentor[0]?.data || [], page: page, pages: pages, limit: limit, totalDocs }, statusCode.OK))

        } catch (err) {
            logger.error(`There was an issue into get current mentor.: ${err} `)
            res.status(statusCode.FORBIDDEN).send(error("There was an issue into get current mentor", err))
        }
    },

    sendRequestMail: async (req: Request, res: Response) => {
        try {
            const { to, subject, despcription } = req.body;

            // sendMail(to, subject, despcription);

            await findOneAndUpdate({
                collection: 'User',
                query: { isDel: false, email: to.toLowerCase() },
                update: {
                    $set: {
                        requestMoreInfoDate: new Date()
                    }
                },
                options: {
                    new: true
                }
            })

            var template = fs.readFileSync(__dirname + "/../../src/utils/emailTemplates/headerfooter.html").toString();
            var content = fs.readFileSync(__dirname + "/../../src/utils/emailTemplates/requestMoreInfo.html").toString();
            content = content.replace(/{{description}}/g, despcription)
            template = template.replace(/{{template}}/g, content);

            sendMail(to, subject, 'iMentor', template);
            res.send(success("Request has been sent.", statusCode.OK))

        } catch (err) {
            logger.error(`There was an issue into send request mail.: ${err} `)
            res.status(statusCode.FORBIDDEN).send(error("There was an issue into send request mail.", err))
        }
    },

    sendInvite: async (req: Request, res: Response) => {
        try {
            const { mentorId } = req.body;

            let request = req as requestUser

            const mentor = await findOne({ collection: 'User', query: { _id: mentorId } })

            if (mentor.status == statusType.DRAFT) {
                await findOneAndUpdate({
                    collection: "User",
                    query: { _id: mentorId, status: statusType.DRAFT },
                    update: { $set: { status: statusType.INVITED } },
                    options: { new: true }
                });
            }

            const to = mentor.email;

            const subject = "Mentor Invitation";

            const despcription = process.env.FRONT_URL + `register?id=${mentor._id}`;

            var template = fs.readFileSync(__dirname + "/../../src/utils/emailTemplates/headerfooter.html").toString();
            var content = fs.readFileSync(__dirname + "/../../src/utils/emailTemplates/sendInvitation.html").toString();
            content = content.replace(/{{fullname}}/g, (mentor.preferredFname + " " + mentor.preferredLname));
            content = content.replace(/{{url}}/g, despcription);
            content = content.replace(/{{adminUserName}}/g, (request.user.legalFname + " " + request.user.legalLname));
            content = content.replace(/{{adminUserRole}}/g, request.user.role);
            content = content.replace(/{{adminProfilePic}}/g, request.user.profilePic ? request.user.profilePic : defaultProfilePicConstant.USER_PROFILE_PIC);
            template = template.replace(/{{template}}/g, content)

            await findOneAndUpdate({
                collection: 'User',
                query: { _id: mentorId },
                update: { $set: { resentInvitationDate: new Date() } }
            })

            sendMail(to, subject, 'Mentor Invitation', template);

            res.send(success("Invitation has been sent.", statusCode.OK))

        } catch (err) {
            logger.error(`There was an issue into send request mail.: ${err} `)
            res.status(statusCode.FORBIDDEN).send(error("There was an issue into send request mail.", err))
        }
    },

    sendMessageToMentor: async (req: Request, res: Response) => {
        try {
            const { message, receiverId } = req.body;
            const request = req as requestUser;
            const senderId = request.user._id.toString()

            const isMentorExists = await findOne({ collection: 'User', query: { _id: receiverId } });

            if (!isMentorExists) {
                res.status(statusCode.BAD_REQUEST).send(error(errorMessage.NOT_EXISTS.replace(':attribute', 'mentor'), {}, statusCode.BAD_REQUEST))
                return
            }

            const files: any = req.files;
            let uploadedFile: any = [];

            if (files && files.length > 0) {
                for (let index = 0; index < files.length; index++) {
                    const file = files[index];

                    const uploadFile: any = await uploadToS3(file, 'MessageUploadedFile');

                    uploadedFile.push(uploadFile)
                }
            }

            // const addMessage = await insertOne({
            //     collection: 'Messages', document: {
            //         senderId: senderId,
            //         receiverId: receiverId,
            //         message: message,
            //         messageType: messageConstant.mentorMessage,
            //         uploadedFile: uploadedFile
            //     }
            // })

            await sendMsg({
                data: {
                    user_id: senderId,
                    user_type: request.user.role,
                    receiverId: receiverId,
                    message: message,
                    msg_type: msg_Type.MESSAGE,
                    file: uploadedFile.Location,
                    fileKey: uploadedFile.key
                }
            });

            res.send(success("Your message has been sent.", { auditIds: [req.body.receiverId], isAuditLog: true, audit: User_Activity.SEND_MESSAGE_TO_MENTOR }, statusCode.OK))
        } catch (err) {
            logger.error(`There was an issue into send request mail.: ${err} `)
            res.status(statusCode.FORBIDDEN).send(error("There was an issue into send message.", err))
        }
    },

    mentorLogin: async (req: Request, res: Response) => {
        try {
            const { userId } = req.body;

            const userObj = await findOne({ collection: "User", query: { _id: userId, role: userRoleConstant.MENTOR, isDel: false } });

            if (!userObj) {
                res.send(error("User not found."));
                return;
            }

            const token: any = await generateTokenLoginAs(userObj);

            if (!token) {
                res.send(error("Token Expired"));
                return;
            }

            res.send(success("Logged In Successfully.", { token, auditIds: [userId], isAuditLog: true, audit: User_Activity.MENTOR_GHOST_LOGIN }));

        } catch (err) {
            logger.error(`There was an issue into login.: ${err} `)
            res.status(statusCode.FORBIDDEN).send(error("There was an issue into login.", err))
        }
    },

    getMatchesList: async (req: Request, res: Response) => {
        try {
            let request = req as requestUser

            const { mentorId, sort } = req.body;

            let mentorObj = await findOne({ collection: 'User', query: { _id: mentorId, role: userRoleConstant.MENTOR } });

            if (!mentorObj) {
                res.status(statusCode.BAD_REQUEST).send(error(errorMessage.NOT_EXISTS.replace(":attribute", 'mentor'), {}, statusCode.BAD_REQUEST));
                return
            }

            let userquery: any = { isDel: false, role: userRoleConstant.MENTEE }

            if (request.user.partnerAdmin) {
                userquery['partnerAdmin'] = request.user.partnerAdmin
            } else if (request.user.region) {
                userquery['region'] = request.user.region
            }

            let menteeList = await find({ collection: 'User', query: userquery, project: { _id: 1 } })

            let query: any = { mentorId };

            query['menteeId'] = { $in: menteeList }

            const getMatchesList = await find({ collection: 'PairInfo', query: query, populate: { path: 'menteeId', select: 'legalFname legalLname preferredFname preferredLname profilePic partnerAdmin region', populate: { path: 'partnerAdmin region', select: 'partnerName region' } }, project: 'menteeId mentorId SOM createdAt addOnDate', sort: sort });

            query['isConfirm'] = true;

            const getMenteeList = await find({ collection: "PairInfo", query: query, populate: { path: 'menteeId', select: 'legalFname legalLname preferredFname preferredLname profilePic partnerAdmin region', populate: { path: 'partnerAdmin region', select: 'partnerName region' } }, project: 'menteeId mentorId SOM createdAt addOnDate', sort: sort })
            const matchesCount = getMatchesList.length;
            res.send(success(successMessage.FETCH_SUCCESS.replace(':attribute', "Matches list"), { getMatchesList, matchesCount, getMenteeList, getMenteeListCount: getMenteeList.lenght }, statusCode.OK))
        } catch (err) {
            logger.error(`There was an issue into get matches list.: ${err} `)
            res.status(statusCode.FORBIDDEN).send(error("There was an issue get matches list.", err))
        }
    },

    importMentorFromCSV: async (req: Request, res: Response) => {
        try {
            let request = req as requestUser;
            const file: any = req.file;
            let filePath = __dirname + "/../../" + file.path;

            let skippedUser: Array<any> = [], message: string = "";
            csvtojson()
                .fromFile(filePath)
                .then(async (data: Array<any>) => {

                    const totalData = data.length;
                    const auditIds: any = [];

                    for (let i = 0; i < data.length; i++) {
                        let rows = data[i];

                        console.log(rows)

                        for (var key in rows) {
                            if (!rows['email'] || !rows['fname'] || !rows['lname']) {
                                message = "Invalid First/Last name or Email."
                                break
                            }
                            else if (!rows[key]) {
                                key = capitalizeFirstLetter(key);
                                message = `${key} is required.`
                                break
                            }
                        }

                        if (!message && rows['email']) {
                            let regexPattern = /\S+@\S+\.\S+/
                            let isEmailValid = regexPattern.test(rows['email'])
                            if (!isEmailValid) {
                                message = `Invalid Email.`
                            }
                        }

                        // if (!message && rows['phoneNo'] && (rows['phoneNo'].length < 10 || rows['phoneNo'].length > 11 || rows['phoneNo'].includes("."))) {
                        //     message = "Phone number length should be 10 or 11"
                        // }

                        if (!message && rows['email']) {
                            const isEmailExists: any = await isEmailAlreadyExists(rows.email)

                            let obj: any = {};
                            if (isEmailExists) {
                                obj = {
                                    role: userRoleConstant.MENTOR,
                                    preferredFname: rows.fname,
                                    preferredLname: rows.lname,
                                    email: rows.email.toLowerCase(),
                                    // primaryPhoneNo: rows.phoneNo,
                                    countryCode: "+1",
                                    status: userStatusConstant.invited,
                                    userImported: true
                                }

                                if (request.user.partnerAdmin) {
                                    obj['partnerAdmin'] = request.user.partnerAdmin
                                } else if (request.user.region) {
                                    obj['region'] = request.user.region
                                } else {
                                    res.status(statusCode.UNAUTHORIZED).send(error(errorMessage.ACTION.replace(":attribute", request.user.role), {}, statusCode.UNAUTHORIZED));
                                    return
                                }
                                let mentorObj = await insertOne({ collection: 'User', document: obj })
                                auditIds.push(mentorObj._id);
                                const url = process.env.FRONT_URL + `register?id=${mentorObj._id}`;
                                var template = fs.readFileSync(__dirname + "/../../src/utils/emailTemplates/headerfooter.html").toString();
                                var content = fs.readFileSync(__dirname + "/../../src/utils/emailTemplates/registerUserInvitation.html").toString();
                                content = content.replace(/{{fullname}}/g, (mentorObj.preferredFname + " " + mentorObj.preferredLname));
                                content = content.replace(/{{adminUserName}}/g, (request.user.legalFname + " " + request.user.legalLname));
                                content = content.replace(/{{adminUserRole}}/g, request.user.role)
                                content = content.replace(/{{adminUserProfilePic}}/g, request.user.profilePic ? request.user.profilePic : defaultProfilePicConstant.USER_PROFILE_PIC)
                                content = content.replace(/{{url}}/g, url)
                                template = template.replace(/{{template}}/g, content);

                                sendMail(mentorObj.email, `You're Registered for iMentor`, 'iMentor', template);
                            } else {
                                obj = {};
                                message = "Email Already Exists.";
                            }
                        }
                        if (message) {
                            rows.message = message;
                            rows.row = i + 2
                            skippedUser.push(rows)
                            message = ""
                        }

                    }
                    let uplaodedUser = data.length - skippedUser.length;
                    let skippedUserCount = skippedUser.length;

                    let csvUrl: any;

                    if (skippedUser && skippedUser.length > 0) {
                        csvUrl = await exportFileFunction(true, 'skipMentorCsv', skippedUser, res, req);
                    }

                    csvUrl = (csvUrl && csvUrl.filePath) ? csvUrl.filePath : "";

                    res.status(statusCode.OK).send(success(successMessage.UPLOAD_SUCCESS.replace(':attribute', "CSV file"), {
                        skippedUser, skippedUserCount, uplaodedUser, csvUrl, totalData, auditIds, isCsv: true, isAuditLog: true, audit: User_Activity.CREATE_BULK_MENTOR
                    }))
                })
        } catch (err: any) {
            res.status(statusCode.FORBIDDEN).send(error("There is some issue while importing user from CSV.", err.message, statusCode.FORBIDDEN))
        }
    },
}