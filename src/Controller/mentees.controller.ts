import { Request, Response, request } from "express";
import { User_Activity, categoryOfQuestion, defaultProfilePicConstant, errorMessage, messageConstant, msg_Type, questionState, statusCode, statusType, successMessage, uploadConstant, userRoleConstant, userStatusConstant } from "../utils/const";
import { aggregate, countDocuments, deleteMany, distinct, find, findOne, findOneAndUpdate, insertMany, insertOne, ObjectId, save, updateMany } from "../utils/db";
import { error, success } from "../utils/helpers/resSender";
import { ascendingSorting, capitalizeFirstLetter, descendingSorting, generateToken, generateTokenLoginAs, isEmailAlreadyExists } from "../utils/helpers/functions";
import { uploadToS3, validateFile } from "../utils/uploadFile";
import { logger } from "../utils/helpers/logger";
import csvtojson from 'csvtojson'
import { requestUser } from "../Interfaces/schemaInterfaces/user";
import _ from 'lodash'
import { sendMail } from "../utils/helpers/sendEmail";
import config from "../utils/config";
import fs from 'fs'
import { createOrGetUser } from "../services/thinkific/thinkific.service";
import { sendMsg, userInactivated } from "./Web/message.controller";
import mongoose from "mongoose";
import exportFileFunction from "../utils/exportCSV"; 

export let menteeController = {
  addMentee: async function (req: any, res: Response) {
    try {
      let request = req as requestUser
      const {
        fname,
        lname,
        preferredfname,
        preferredlname,
        pronounciationName,
        dob,
        email,
        recoveryEmail,
        primaryPhoneNo,
        isSharedThisNumber,
        secondaryPhoneNo,
        guardianFname,
        guardianLname,
        guardianEmail,
        guardianPhone,
        guardianSecondaryPhoneNo,
        address,
        demographicInformation,
        programInformation,
        profilePic,
        queAns,
        isSaveAndExit,
        isField,
        isSaveAndInvite,
        education_level,
        guardianAddress,
        isSameAddress,
        isParentBornInUnitedStates,
        menteeProfilePic
      } = req.body;

      let status = "";

      const isEmailExists: any = await isEmailAlreadyExists(email);

      if (!isEmailExists) {
        res.status(statusCode.BAD_REQUEST).send(error(errorMessage.ALREADY_EXISTS.replace(":attribute", "email"), {}, statusCode.BAD_REQUEST));
        return
      }

      let message = "";
      if (isSaveAndExit) {
        status = userStatusConstant.draft;
        message = successMessage.DRAFT_MESSAGE.replace(":attribute", "Form")
      }

      if (isSaveAndInvite) {
        status = userStatusConstant.invited;
        message = successMessage.ADD_SUCCESS.replace(":attribute", "user")
      }

      if (isSaveAndExit && isField) {
        status = userStatusConstant.draft;
        message = successMessage.DRAFT_MESSAGE.replace(":attribute", "Form")
      }

      if (email?.toLowerCase() == recoveryEmail?.toLowerCase()) {
        res.status(statusCode.BAD_REQUEST).send(error("Secondary email should differ from the primary email."));
        return
      }
      const basicInfoQuery: any = {
        legalFname: fname ? fname : '',
        legalLname: lname ? lname : '',
        preferredFname: preferredfname ? preferredfname : '',
        preferredLname: preferredlname ? preferredlname : '',
        role: userRoleConstant.MENTEE,
        dob: dob ? dob : '',
        pronounciationName: pronounciationName ? pronounciationName : '',
        email: email ? email.toLowerCase() : '',
        recoveryEmail: recoveryEmail ? recoveryEmail.toLowerCase() : '',
        primaryPhoneNo: primaryPhoneNo ? primaryPhoneNo : '',
        isSharedThisNumber: isSharedThisNumber ? isSharedThisNumber : false,
        secondaryPhoneNo: secondaryPhoneNo ? secondaryPhoneNo : '',
        guardianFname: guardianFname ? guardianFname : '',
        guardianLname: guardianLname ? guardianLname : '',
        guardianEmail: guardianEmail ? guardianEmail.toLowerCase() : '',
        guardianPhone: guardianPhone ? guardianPhone : '',
        guardianSecondaryPhoneNo: guardianSecondaryPhoneNo ? guardianSecondaryPhoneNo : '',
        isSameAddress: isSameAddress ? isSameAddress : false,
        guardianAddress: guardianAddress ? guardianAddress : {},
        address: address ? address : {},
        profilePic: menteeProfilePic ? menteeProfilePic : '',
        status: status,
        isDel: false,
        isParentBornInUnitedStates: isParentBornInUnitedStates ? isParentBornInUnitedStates : false,
        isField: isField
      };

      if (request.user.region) {
        basicInfoQuery['region'] = request.user.region
      } else if (request.user.partnerAdmin) {
        basicInfoQuery['partnerAdmin'] = request.user.partnerAdmin
      } else {
        res.status(statusCode.UNAUTHORIZED).send(error(errorMessage.ACTION.replace(":attribute", request.user.role), {}, statusCode.UNAUTHORIZED));
        return
      }

      if (isSaveAndInvite && !isField) {
        basicInfoQuery['resentInvitationDate'] = new Date()
      }

      let answerByMantees: any = {}, additionalInfoQuery: any = {}, addtionalInfo

      let mentee = await insertOne({ collection: "User", document: basicInfoQuery });

      additionalInfoQuery = {
        userId: mentee._id,
        programInformation: programInformation,
        demographicInformation: demographicInformation,
        education_level: education_level
      };

      addtionalInfo = await insertOne({ collection: "AdditionalInfo", document: additionalInfoQuery });

      let thinkificUser = await createOrGetUser({ email, firstName: preferredfname, lastName: preferredlname })

      if (thinkificUser) {
        basicInfoQuery['thinkificUserId'] = thinkificUser['id']
      }

      let { partnerAdmin, region } = await findOne({
        collection: "User",
        query: {
          _id: req.user._id
        }
      })
      let createdBy = partnerAdmin ?? region
      answerByMantees = await insertOne({ collection: 'AnswerByMentee', document: { queAns: queAns, user: mentee._id, createdBy } })

      let url = config.FRONT_URL + "register?id=" + mentee._id
      // template = template.replace(/{{url}}/g, url)

      var template = fs.readFileSync(__dirname + "/../../src/utils/emailTemplates/headerfooter.html").toString();
      var content = fs.readFileSync(__dirname + "/../../src/utils/emailTemplates/registerUserInvitation.html").toString();
      content = content.replace(/{{fullname}}/g, (mentee.preferredFname + " " + mentee.preferredLname));
      content = content.replace(/{{url}}/g, url);
      content = content.replace(/{{adminUserName}}/g, (request.user.legalFname + " " + request.user.legalLname));
      content = content.replace(/{{adminUserRole}}/g, request.user.role);
      content = content.replace(/{{adminProfilePic}}/g, request.user.profilePic ? request.user.profilePic : defaultProfilePicConstant.USER_PROFILE_PIC);
      template = template.replace(/{{template}}/g, content)

      sendMail(mentee.email, `You're Registered for iMentor`, "Mentee Registration", template)

      res.send(
        success(
          message,
          { mentee, addtionalInfo, answerByMantees, isAuditLog: true, audit: User_Activity.CREATE_NEW_MENTEE },
          statusCode.OK
        )
      );
    } catch (err: any) {
      console.log(err)
      res.status(statusCode.FORBIDDEN).send(error("There is some issue to get addMentee.", err.message, statusCode.FORBIDDEN));
    }
  },

  menteesList: async (req: Request, res: Response) => {
    try {
      let request = req as requestUser
      let query: any = {},
        sort: any = {},
        page = req.body.page || 1,
        limit = req.body.limit || 10,
        total,
        pages,
        status: Array<any> = [];
      (sort = req.body.sort), (status = req.body.status);

      let sortKey = Object.keys(sort)

      if (request.user.region) {
        query['region'] = request.user.region
      } else if (request.user.partnerAdmin) {
        query['partnerAdmin'] = request.user.partnerAdmin
      }

      if (req.body.location.length > 0) {
        query["address.city"] = { $in: req.body.location } /* new RegExp(req.body.location, "i"); */
      }

      query["isDisabled"] = false;
      if (req.body.disabledUserList == true) {
        query["isDisabled"] = true;
      }

      query["role"] = userRoleConstant.MENTEE;
      query["isDel"] = false;

      if (Object.values(sort).length) {
        sort[Object.keys(sort)[0]] = Object.values(sort)[0] === "asc" ? 1 : -1;
      }
      let sortQuery: any = { $sort: { 'createdAt': -1 } }
      let sortQuery2: any = {}
      if (Object.keys(sort).length && Object.keys(sort)[0] !== "") {
        if (["matches", "assignedMentor", "partnerOrRegion", "joinDate", "menteesName"].includes(Object.keys(sort)[0])) {
          if (sortKey[0] == "matches") {
            sortQuery2 = { $sort: { 'matches': sort[sortKey[0]] } }
          } else
            sortQuery2 = { $sort: { "insensitive": sort[sortKey[0]] } }
        } else {
          sortQuery = { $sort: { "insensitive": sort[sortKey[0]] } }
        }
      }

      let limitQuery: any = { $sort: { 'createdAt': -1 } }
      if (limit) {
        limitQuery = { $limit: limit }
      }

      let skipQuery: any = { $sort: { 'createdAt': -1 } }
      if (page) {
        skipQuery = { $skip: (page - 1) * limit }
      }

      let searchQuery: any = {}

      if (req.body.assignedMentor.length > 0) {
        let assignedMentor = req.body.assignedMentor.map((x: any) => {
          return new mongoose.Types.ObjectId(x)
        })
        searchQuery["menteePair.mentorId"] = { $in: assignedMentor };
      }

      let pipeLine: Array<any> = [
        {
          $match: query
        },
        {
          $addFields: {
            locationCity: "$address.city",
          },
        },
        {
          $addFields: {
            locationState: "$address.state",
          },
        },
        {
          $addFields: {
            status: {
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
                        { '$lte': ["$preMatchStep", 3] },
                        { '$eq': ["$status", "Draft"] },
                      ]
                    },
                    "Completed",
                    "$status"
                  ]
                }
              ]
            },
          }
        }
      ]

      if (req.body.search) {
        pipeLine.push({
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

      if (status?.length > 0) {
        pipeLine.push({
          $match: {
            status: { $in: status }
          }
        })
      }

      if (!Object.keys(sortQuery2).length) {
        if (sortKey[0])
          pipeLine.push({ $addFields: { insensitive: { $toLower: `$${sortKey[0]}` } } })
        pipeLine.push(sortQuery)
        pipeLine.push(skipQuery)
        pipeLine.push(limitQuery)
      }

      pipeLine = [
        ...pipeLine,
        {
          $lookup: {
            from: "pairinfos",
            localField: "_id",
            foreignField: "menteeId",
            as: "result",
          },
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
          $addFields: {
            totalMatches: { $size: "$result" },
          },
        },
        {
          $lookup: {
            from: "pairinfos",
            let: { mentee: "$_id", },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $and: [{ $eq: ["$isConfirm", true] }, { $eq: ["$menteeId", "$$mentee"] }],
                  },
                },
              },
            ],
            as: "menteePair",
          },
        },
        {
          $unwind: {
            path: '$menteePair',
            preserveNullAndEmptyArrays: true
          }
        },
        {
          $match: searchQuery
        },
        {
          $lookup: {
            from: 'users',
            localField: 'menteePair.mentorId',
            foreignField: '_id',
            as: 'menteePair.mentorId'
          }
        },
        {
          $unwind: {
            path: '$menteePair.mentorId',
            preserveNullAndEmptyArrays: true
          }
        },
        {
          '$lookup': {
            'from': 'additionalinfos',
            'localField': '_id',
            'foreignField': 'userId',
            'as': 'userAddInfo'
          }
        },
        {
          $unwind: {
            path: '$userAddInfo',
            preserveNullAndEmptyArrays: true
          }
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
        }
      ]

      pipeLine.push({
        $project: {
          legalFname: 1,
          legalLname: 1,
          preferredFname: 1,
          preferredLname: 1,
          email: 1,
          menteesName: { $concat: ['$preferredFname', " ", "$preferredLname"] },
          menteeProfilePic: '$profilePic',
          locationCity: "$address.city",
          locationState: "$address.state",
          matches: '$totalMatches',
          onboardingStep: 1,
          preMatchStep: 1,
          pairImported: 1,
          password: 1,
          status: 1,
          'notes': {
            '$size': '$notes'
          },
          assignedMentorId: '$menteePair.mentorId._id',
          assignedMentor: { $concat: ['$menteePair.mentorId.preferredFname', " ", "$menteePair.mentorId.preferredLname"] },
          assignedMentorProfilePic: '$menteePair.mentorId.profilePic',
          school: '$userAddInfo.education_level.assignedSchoolOrInstitutions',
          joinDate: '$createdAt',
          isField: 1,
          partnerOrRegion: {
            $cond: [{ $ifNull: ['$partnerOrRegion.partnerName', null] }, '$partnerOrRegion.partnerName', '$partnerOrRegion.region']
          },
          resentInvitationDate: 1,
          userActivationDate: 1
        }
      })

      if (Object.keys(sortQuery2).length) {
        let query
        if (sortKey[0] == "partnerOrRegion") {
          query = '$partnerOrRegion'
        } else if (sortKey[0] == "joinDate") {
          query = '$joinDate'
        } else if (sortKey[0] == "assignedMentor") {
          query = '$assignedMentor'
        } else if (sortKey[0] == "menteesName") {
          query = '$menteesName'
        }
        else {
          query = `$${sortKey[0]}`
        }
        if (sortKey[0]) pipeLine.push({ $addFields: { insensitive: { $toLower: query } } })
        pipeLine.push(sortQuery2)
        pipeLine.push(skipQuery)
        pipeLine.push(limitQuery)
      }

      let menteesCount: number = await countDocuments({ collection: "User", query: query });
      let menteesArr: Array<any> = await aggregate({ collection: "User", pipeline: pipeLine });

      if (req.body.assignedMentor && req.body.assignedMentor.length > 0 || status.length > 0 || req.body.search) {
        menteesCount = menteesArr.length
      }

      // for (let i = 0; i < menteesArr.length; i++) {
      //   if (!menteesArr[i].password && menteesArr[i].pairImported == true) {
      //     menteesArr[i].isLoginAS = true
      //   } else {
      //     menteesArr[i].isLoginAS = false
      //   }
      // }

      let result = {
        docs: menteesArr,
        page: page,
        pages: (menteesArr && menteesArr.length > 0) ? Math.ceil(menteesCount / limit) : 1,
        total: (menteesArr.length > 0 && menteesCount) ? menteesCount : 0,
        limit: limit,
      };

      res.send(success(successMessage.FETCH_SUCCESS.replace(":attribute", "menteesList"), result, statusCode.OK));
    } catch (err: any) {
      res.status(statusCode.FORBIDDEN).send(error("There is some issue in fetching menteesList.", err.message, statusCode.FORBIDDEN));
    }
  },

  getMenteeUser: async (req: Request, res: Response) => {
    try {
      const { userId } = req.query;

      let menteeObj: any = await findOne({ collection: "User", query: { _id: userId, isDel: false } });

      let pipeLine: any = [
        {
          $match: {
            _id: new ObjectId(menteeObj._id),
            isDel: false
          }
        },
        {
          '$project': {
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
                        { '$lte': ["$preMatchStep", 3] },
                        { '$eq': ["$status", "Draft"] },
                      ]
                    },
                    "Completed",
                    "$status"
                  ]
                }
              ]
            }
          }
        }
      ]

      let menteeStatus = await aggregate({
        collection: 'User', pipeline: pipeLine
      })

      if (!menteeObj) {
        res
          .status(statusCode.BAD_REQUEST)
          .send(error(errorMessage.NOT_EXISTS.replace(":attribute", "Mentee"), {}, statusCode.BAD_REQUEST));
        return;
      }

      menteeObj.status = menteeStatus[0].status;

      // if (!menteeObj.profilePic) {
      //   menteeObj.profilePic = defaultProfilePicConstant.USER_PROFILE_PIC
      // }

      let additionalInfo = await findOne({ collection: "AdditionalInfo", query: { userId: menteeObj._id } });

      let queAns = await findOne({ collection: "AnswerByMentee", query: { user: menteeObj._id }, populate: { path: 'queAns.question', select: 'question' } });

      let assignMentor = await findOne({ collection: "PairInfo", query: { menteeId: userId, isConfirm: true }, populate: { path: "mentorId", select: "preferredFname preferredLname profilePic" } });

      let matches = await find({ collection: "PairInfo", query: { menteeId: userId }, populate: { path: "mentorId", select: "preferredFname preferredLname profilePic" } });

      res.send(
        success(
          successMessage.FETCH_SUCCESS.replace(":attribute", "Mentee"),
          { menteeObj, additionalInfo: additionalInfo ? additionalInfo : {}, queAns: queAns ? queAns : '', assignMentor: assignMentor ? assignMentor : {}, matches: matches ? matches : {}, matchesCount: (matches && matches.length) ? matches.length : 0 },
          statusCode.OK
        )
      );
    } catch (err: any) {
      res
        .status(statusCode.FORBIDDEN)
        .send(error("There is some issue during fetching one Mentee.", err.message, statusCode.FORBIDDEN));
    }
  },

  deleteMentees: async (req: Request, res: Response) => {
    try {
      let users: Array<any> = [];

      users = req.body.userId;

      for (let i = 0; i < users.length; i++) {
        const user = users[i];

        let menteeObj = await findOne({ collection: "User", query: { _id: user } });

        if (!menteeObj) {
          res
            .status(statusCode.BAD_REQUEST)
            .send(error(errorMessage.NOT_EXISTS.replace(":attribute", "Mentee"), {}, statusCode.BAD_REQUEST));
          return;
        }
      }

      await updateMany({
        collection: "User",
        query: { _id: { $in: users } },
        update: {
          isDel: true,
        },
        options: {
          new: true,
        },
      });

      await updateMany({ collection: 'AnswerByMentee', query: { user: { $in: users } }, update: { $set: { status: userStatusConstant.PENDING } } });

      // If user is deleted than send socket event
      userInactivated({ data: { users } });

      let mentorList = await find({ collection: 'PairInfo', query: { menteeId: { $in: users } } });
      await deleteMany({ collection: "PairInfo", query: { menteeId: { $in: users } } })

      await updateMany({ collection: 'Messages', query: { $or: [{ senderId: { $in: users } }, { receiverId: { $in: users } }] }, update: { isDel: true } });
      await deleteMany({ collection: 'EventGuest', query: { userId: { $in: users } } });

      await updateMany({ collection: 'Event', query: { guest: { $in: users } }, update: { $pull: { guest: { $in: users } } } })
      await updateMany({ collection: 'Group', query: { groupMember: { $in: users } }, update: { $pull: { groupMember: { $in: users } } } })

      for (let i = 0; i < mentorList.length; i++) {
        const mentor = mentorList[i];
        let query: any = {}

        if (mentor && mentor.isConfirm == true) {
          query['status'] = userStatusConstant.Matched
        } else {
          query['status'] = userStatusConstant.Matching
        }

        await findOneAndUpdate({ collection: "User", query: { _id: mentor.mentorId }, update: query, options: { new: true } })
      }

      res.send(success(successMessage.REMOVE.replace(":attribute", "Mentee"), { auditIds: req.body.userId, isAuditLog: true, audit: req.body.userId?.length > 1 ? User_Activity.MULTIPLE_MENTEE_DELETED : User_Activity.MENTEE_DELETED }, statusCode.OK));
    } catch (err: any) {
      res
        .status(statusCode.FORBIDDEN)
        .send(error("There is some issue while deleting the Mentee.", err.message, statusCode.FORBIDDEN));
    }
  },

  disableMentees: async (req: Request, res: Response) => {
    try {
      let users: Array<any> = [];
      users = req.body.userId;

      for (let i = 0; i < users.length; i++) {
        const user = users[i];
        let menteeObj = await findOne({ collection: "User", query: { _id: user } });

        if (!menteeObj) {
          res
            .status(statusCode.BAD_REQUEST)
            .send(error(errorMessage.NOT_EXISTS.replace(":attribute", "Mentee"), {}, statusCode.BAD_REQUEST));
          return;
        }
      }

      await updateMany({
        collection: "User",
        query: { _id: { $in: users } },
        update: {
          $set: {
            isDisabled: true,
          },
        },
        options: {
          new: true,
        },
      });

      // If user is disable than send socket event
      userInactivated({ data: { users } });

      res.send(success(successMessage.DISABLE_SUCCESS.replace(":attribute", "Mentee"), { auditIds: req.body.userId, isAuditLog: true, audit: req.body.userId?.length > 1 ? User_Activity.MULTIPLE_MENTEE_DEACTIVATED : User_Activity.MENTEE_DEACTIVATED }, statusCode.OK));
    } catch (err: any) {
      res.status(statusCode.FORBIDDEN).send(error("There is some issue while desabling mentees.", err.message, statusCode.FORBIDDEN));
    }
  },

  activeMentees: async (req: Request, res: Response) => {
    try {
      let users: Array<any> = [];
      users = req.body.userId;

      for (let i = 0; i < users.length; i++) {
        const user = users[i];
        let menteeObj = await findOne({ collection: "User", query: { _id: user } });

        if (!menteeObj) {
          res
            .status(statusCode.BAD_REQUEST)
            .send(error(errorMessage.NOT_EXISTS.replace(":attribute", "Mentee"), {}, statusCode.BAD_REQUEST));
          return;
        }
      }

      await updateMany({
        collection: "User",
        query: { _id: { $in: users } },
        update: {
          $set: {
            isDisabled: false,
          },
        },
        options: {
          new: true,
        },
      });

      res.send(success(successMessage.ACTIVATE_SUCCESS.replace(":attribute", "Mentee"), { auditIds: req.body.userId, isAuditLog: true, audit: req.body.userId?.length > 1 ? User_Activity.MULTIPLE_MENTEE_ACTIVATED : User_Activity.MENTEE_ACTIVATED }, statusCode.OK));
    } catch (err: any) {
      res.status(statusCode.FORBIDDEN).send(error("There is some issue while active mentees.", err.message, statusCode.FORBIDDEN));
    }
  },

  updateMentee: async (req: Request, res: Response) => {
    try {
      let {
        menteeId,
        fname,
        lname,
        preferredfname,
        preferredlname,
        pronounciationName,
        dob,
        email,
        recoveryEmail,
        primaryPhoneNo,
        isSharedThisNumber,
        secondaryPhoneNo,
        guardianFname,
        guardianLname,
        guardianEmail,
        guardianPhone,
        guardianSecondaryPhoneNo,
        address,
        demographicInformation,
        programInformation,
        // profilePic,
        education_level,
        queAns,
        guardianAddress,
        isSameAddress,
        isParentBornInUnitedStates,
        menteeProfilePic,
        isField
      } = req.body

      let menteeObj = await findOne({
        collection: 'User',
        query: {
          _id: menteeId,
          role: userRoleConstant.MENTEE
        }
      })

      if (!menteeObj) {
        res.status(statusCode.BAD_REQUEST).send(error(errorMessage.NOT_EXISTS.replace(":attribute", "Mentee"), {}, statusCode.BAD_REQUEST));
        return
      }

      const basicInfoQuery = {
        legalFname: fname,
        legalLname: lname,
        preferredFname: preferredfname,
        preferredLname: preferredlname,
        role: userRoleConstant.MENTEE,
        dob: dob,
        pronounciationName: pronounciationName,
        email: email.toLowerCase(),
        recoveryEmail: recoveryEmail ? recoveryEmail.toLowerCase() : '',
        primaryPhoneNo: primaryPhoneNo,
        isSharedThisNumber: isSharedThisNumber,
        secondaryPhoneNo: secondaryPhoneNo ? secondaryPhoneNo : '',
        guardianFname: guardianFname,
        guardianLname: guardianLname,
        guardianEmail: guardianEmail ? guardianEmail.toLowerCase() : '',
        guardianPhone: guardianPhone,
        guardianSecondaryPhoneNo: guardianSecondaryPhoneNo,
        guardianAddress: guardianAddress,
        isSameAddress: isSameAddress,
        address: address,
        profilePic: menteeProfilePic,
        isParentBornInUnitedStates,
        isField: isField
      }

      const additionalInfo = {
        demographicInformation: demographicInformation,
        programInformation: programInformation,
        education_level: education_level
      }

      const matchingQuestions = {
        queAns: queAns
      }

      let mentee = await findOneAndUpdate({
        collection: "User",
        query: { _id: menteeId },
        update: {
          $set: basicInfoQuery
        },
        options: { new: true }
      })

      let addtionalInfo = await findOneAndUpdate({
        collection: 'AdditionalInfo',
        query: { userId: menteeId },
        update: {
          $set: additionalInfo
        },
        options: { new: true, upsert: true }
      })

      let matchingQuestion = await findOneAndUpdate({
        collection: 'AnswerByMentee',
        query: { user: menteeId },
        update: {
          $set: matchingQuestions
        },
        options: {
          new: true, upsert: true
        }
      })

      let audit;
      if (menteeObj.profilePic != menteeProfilePic) {
        audit = User_Activity.MENTEE_LOGO_UPDATED
      } else {
        audit = User_Activity.MENTEE_DATA_UPDATED
      }

      res.send(success(successMessage.UPDATE_SUCCESS.replace(":attribute", "Mentee"), { mentee, addtionalInfo, matchingQuestion, isAuditLog: true, audit }, statusCode.OK))

    } catch (err: any) {
      res.status(statusCode.FORBIDDEN).send(error("There is some issue during updating mentee.", err.message, statusCode.FORBIDDEN))
    }
  },

  uploadProfilePicOfMentee: async (req: Request, res: Response) => {
    try {
      const { menteeId } = req.body;

      const isMenteeExists = await findOne({ collection: 'User', query: { _id: menteeId, role: userRoleConstant.MENTEE } });

      if (!isMenteeExists) {
        res.status(statusCode.BAD_REQUEST).send(error(errorMessage.NOT_EXISTS.replace(':attribute', 'Mentee')))
        return
      }

      const file = req.file;
      const maxSize = uploadConstant.PROFILE_PIC_FILE_SIZE;
      const extArr = uploadConstant.PROFILE_PIC_EXT_ARRAY;

      // validate file
      let validateUplaodedFile = await validateFile(res, file, 'menteeProfilePic', extArr, maxSize);

      if (validateUplaodedFile) {
        res.status(statusCode.BAD_REQUEST).send(error(validateUplaodedFile, {}, statusCode.BAD_REQUEST))
        return
      }

      const uploadFile: any = await uploadToS3(file, 'menteeProfilePic');

      let profilePic = '';
      let profilePicKey = '';

      if (uploadFile) {
        profilePic = uploadFile.Location;
        profilePicKey = uploadFile.key;
      }

      const updateMentee = await findOneAndUpdate({
        collection: 'User',
        query: { _id: menteeId, role: userRoleConstant.MENTEE },
        update: {
          $set: {
            profilePic: profilePic,
            profilePicKey: profilePicKey
          }
        },
        options: { new: true }
      })

      res.status(statusCode.OK).send(success(successMessage.UPLOAD_SUCCESS.replace(':attribute', "profile pic"), updateMentee))

    } catch (err) {
      logger.error(`There was an issue into upload file.: ${err}`)
      res.status(statusCode.FORBIDDEN).send(error("There was an issue into upload file", err))
    }
  },

  importUserFromCSV: async (req: Request, res: Response) => {
    try {
      const file: any = req.file;
      let filePath = __dirname + "/../../uploads/MenteeFile/" + file.filename;
      // return

      let request = req as requestUser

      const extArr = uploadConstant.CSV_FILE_EXT_ARR;
      // validate file
      let validateUplaodedFile = await validateFile(res, file, 'menteeCsv', extArr);

      if (validateUplaodedFile) {
        res.status(statusCode.BAD_REQUEST).send(error(validateUplaodedFile, {}, statusCode.BAD_REQUEST))
        return
      }

      let skippedUser: Array<any> = [], message: string = ""

      csvtojson()
        .fromFile(filePath)
        .then(async (data: Array<any>) => {

          const totalData = data.length;
          const auditIds: any = [];

          for (let i = 0; i < data.length; i++) {
            let rows = data[i];

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
            //   message = "Phone number length should be 10 or 11"
            // }

            if (!message && rows['email']) {
              const isEmailExists: any = await isEmailAlreadyExists(rows.email);

              let schoolOrInstitue = rows.schoolOrInstitue ? (rows.schoolOrInstitue).split(",") : ""

              let isExists: any = {}, education_level: any = {}
              if (schoolOrInstitue.length > 1) {
                for (let j = 0; j < schoolOrInstitue.length; j++) {
                  let sOrI = schoolOrInstitue[j];

                  isExists = await findOne({ collection: 'AppSetting', query: { key: "SchoolOrInstitute", value: sOrI } })
                  if (!isExists) {
                    await findOneAndUpdate({ collection: "AppSetting", query: { key: 'SchoolOrInstitute' }, update: { $push: { value: sOrI } } })
                  }
                }
              } else {
                isExists = await findOne({ collection: 'AppSetting', query: { key: "SchoolOrInstitute", value: schoolOrInstitue[0] } })
                if (!isExists) {
                  await findOneAndUpdate({ collection: "AppSetting", query: { key: 'SchoolOrInstitute' }, update: { $push: { value: schoolOrInstitue[0] } } })
                }
              }

              let obj: any = {}, assignedSchool: Array<any> = [];
              if (isEmailExists) {
                obj = {
                  role: userRoleConstant.MENTEE,
                  preferredFname: rows.fname,
                  preferredLname: rows.lname,
                  email: rows.email.toLowerCase(),
                  primaryPhoneNo: rows.phoneNo,
                  countryCode: "+1",
                  status: userStatusConstant.invited,
                  userImported: true
                }

                if (request.user.role == userRoleConstant.P_SUPER_ADMIN || request.user.role == userRoleConstant.P_LOCAL_ADMIN) {
                  let findPartnerAdmin = await findOne({ collection: 'User', query: { _id: request.user._id } });
                  obj['partnerAdmin'] = (findPartnerAdmin && findPartnerAdmin.partnerAdmin) ? findPartnerAdmin.partnerAdmin : null
                } else if (request.user.role == userRoleConstant.I_LOCAL_ADMIN) {
                  let localAdmin = await findOne({ collection: 'User', query: { _id: request.user._id } })
                  obj['region'] = (localAdmin && localAdmin.region) ? localAdmin.region : null
                }

                let insertUserFromCSV = await insertOne({ collection: 'User', document: obj })
                auditIds.push(insertUserFromCSV._id);

                for (let i = 0; i < schoolOrInstitue.length; i++) {
                  let element = schoolOrInstitue[i];
                  assignedSchool.push(element)
                }
                education_level = {
                  assignedSchoolOrInstitutions: assignedSchool
                }

                let additionalInfoQuery: any = { userId: insertUserFromCSV._id, education_level: education_level }
                await insertOne({ collection: 'AdditionalInfo', document: additionalInfoQuery })

                let url = config.FRONT_URL + "register?id=" + insertUserFromCSV._id
                // template = template.replace(/{{url}}/g, url)

                var template = fs.readFileSync(__dirname + "/../../src/utils/emailTemplates/headerfooter.html").toString();
                var content = fs.readFileSync(__dirname + "/../../src/utils/emailTemplates/registerUserInvitation.html").toString();
                content = content.replace(/{{fullname}}/g, (insertUserFromCSV.preferredFname + " " + insertUserFromCSV.preferredLname));
                content = content.replace(/{{url}}/g, url);
                content = content.replace(/{{adminUserName}}/g, (request.user.legalFname + " " + request.user.legalLname));
                content = content.replace(/{{adminUserRole}}/g, request.user.role);
                content = content.replace(/{{adminProfilePic}}/g, request.user.profilePic ? request.user.profilePic : defaultProfilePicConstant.USER_PROFILE_PIC);
                template = template.replace(/{{template}}/g, content)

                sendMail(insertUserFromCSV.email, `You're Registered for iMentor`, "Mentee Registration", template)
                // res.status(statusCode.BAD_REQUEST).send(error(`This ${rows.email} Email already exists`, {}, statusCode.BAD_REQUEST))
                // return
              } else {
                obj = {}
                message = "Email Already Exists."
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
            csvUrl = await exportFileFunction(true, 'skipMenteeCsv', skippedUser, res, req);
          }

          csvUrl = (csvUrl && csvUrl.filePath) ? csvUrl.filePath : "";
          res.status(statusCode.OK).send(success(successMessage.UPLOAD_SUCCESS.replace(':attribute', "CSV file"), {
            skippedUser, skippedUserCount, uplaodedUser, csvUrl, totalData, auditIds, isCsv: true, isAuditLog: true, audit: User_Activity.CREATE_BULK_MENTEE
          }))
        })


    } catch (err: any) {

      console.log(err)
      res.status(statusCode.FORBIDDEN).send(error("There is some issue while importing user from CSV.", err.message, statusCode.FORBIDDEN))
    }
  },
  sendMessageToMentee: async (req: Request, res: Response) => {
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
      //   collection: 'Messages', document: {
      //     senderId: senderId,
      //     receiverId: receiverId,
      //     message: message,
      //     messageType: messageConstant.menteeMessage,
      //     uploadedFile: uploadedFile
      //   }
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

      res.send(success("Your message has been sent.", { auditIds: [req.body.receiverId], isAuditLog: true, audit: User_Activity.SEND_MESSAGE_TO_MENTEE }, statusCode.OK))
    } catch (err) {
      logger.error(`There was an issue into send request mail.: ${err} `)
      res.status(statusCode.FORBIDDEN).send(error("There was an issue into send message.", err))
    }
  },

  filterListData: async (req: Request, res: Response) => {
    try {
      let request = req as requestUser;
      let status: Array<any> = [], assignedMentor: Array<any> = [], school: Array<any> = [], location: Array<any> = []

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

      let query: any = {}, pairQuery: any = {};

      if (request.user.partnerAdmin) {
        query['partnerAdmin'] = request.user.partnerAdmin
        pairQuery['partnerId'] = request.user.partnerAdmin
      } else if (request.user.region) {
        query['region'] = request.user.region
        pairQuery['regionId'] = request.user.region
      }

      pairQuery['isDel'] = false;
      pairQuery['isConfirm'] = true
      let pairData = await find({ collection: 'PairInfo', query: pairQuery, populate: { path: 'mentorId menteeId', select: 'preferredFname preferredLname isDisabled' } })

      query['role'] = userRoleConstant.MENTEE;
      let locationList = await distinct({ collection: 'User', field: 'address.city', query: query });


      query['role'] = userRoleConstant.MENTEE;
      let userArray = await find({ collection: 'User', query: query });

      userArray.forEach((x: any) => {
        location.push((x.address && x.address.state) ? x.address.state : '')
      })

      pairData.forEach((x: any) => {
        assignedMentor.push({
          _id: x.mentorId ? x.mentorId._id : '',
          name: (x.mentorId ? x.mentorId.preferredFname : '') + " " + (x.mentorId ? x.mentorId.preferredLname : ''),
          menteeDisable: x.menteeId ? x.menteeId.isDisabled : ''
        })
      })

      location = location.filter(x => { return x })
      assignedMentor = _.uniqBy(assignedMentor, "_id")
      location = _.uniq(location)

      assignedMentor.sort((a: any, b: any) => { return a.name.localeCompare(b.name) });
      location.sort((a: any, b: any) => { return a.localeCompare(b) });
      locationList.sort((a: any, b: any) => { return a.localeCompare(b) })
      res.send(success(successMessage.FETCH_SUCCESS.replace(":attribute", 'FilterData'),
        {
          status, assignedMentor, location, locationList
        },
        statusCode.OK
      ))

    } catch (err: any) {
      res.status(statusCode.FORBIDDEN).send(error("There is some issue in FilterList", err.message, statusCode.FORBIDDEN))
    }
  },

  removeMenteeProfilePic: async (req: Request, res: Response) => {
    try {
      const { menteeId } = req.body;

      let userObj = await findOne({ collection: 'User', query: { _id: menteeId, isDel: false } });

      if (!userObj) {
        res.status(statusCode.BAD_REQUEST).send(error(errorMessage.NOT_EXISTS.replace(":attribute", "User"), {}, statusCode.BAD_REQUEST))
        return
      }

      const updateMentor = await findOneAndUpdate({
        collection: 'User',
        query: { _id: menteeId, role: userRoleConstant.MENTEE },
        update: {
          $set: {
            profilePic: "",
            profilePicKey: ""
          }
        },
        options: { new: true }
      })

      res.status(statusCode.OK).send(success(successMessage.REMOVE.replace(':attribute', "profile pic"), updateMentor))

    } catch (err) {
      logger.error(`There was an issue into remove profile picture.: ${err} `)
      res.status(statusCode.FORBIDDEN).send(error("There was an issue into remove profile picture.", err))
    }
  },

  menteeLoginAs: async (req: Request, res: Response) => {
    try {
      const { userId } = req.body;

      const userObj = await findOne({ collection: "User", query: { _id: userId, role: userRoleConstant.MENTEE, isDel: false } });

      if (!userObj) {
        res.send(error("User not found."));
        return;
      }

      const token = await generateTokenLoginAs(userObj);

      if (!token) {
        res.send(error("Token Expired"));
        return;
      }

      res.send(success("Logged In Successfully.", { token, auditIds: [userId], isAuditLog: true, audit: User_Activity.MENTEE_GHOST_LOGIN }));

    } catch (err) {
      logger.error(`There was an issue into login.: ${err} `)
      res.status(statusCode.FORBIDDEN).send(error("There was an issue into login.", err))
    }
  },
  sendInvite: async (req: Request, res: Response) => {
    try {
      const { menteeId } = req.body;

      let request = req as requestUser

      const mentee = await findOne({ collection: 'User', query: { _id: menteeId } });

      if (mentee.status == statusType.DRAFT) {
        await findOneAndUpdate({
          collection: "User",
          query: { _id: menteeId, status: statusType.DRAFT },
          update: { $set: { status: statusType.INVITED } },
          options: { new: true }
        });
      }

      await findOneAndUpdate({
        collection: 'User',
        query: { _id: menteeId },
        update: { $set: { resentInvitationDate: new Date() } }
      })

      const to = mentee.email;

      const subject = "Mentee Invitation";

      const despcription = process.env.FRONT_URL + `register?id=${mentee._id}`;

      var template = fs.readFileSync(__dirname + "/../../src/utils/emailTemplates/headerfooter.html").toString();
      var content = fs.readFileSync(__dirname + "/../../src/utils/emailTemplates/sendInvitation.html").toString();
      content = content.replace(/{{fullname}}/g, (mentee.preferredFname + " " + mentee.preferredLname));
      content = content.replace(/{{url}}/g, despcription);
      content = content.replace(/{{adminUserName}}/g, (request.user.legalFname + " " + request.user.legalLname));
      content = content.replace(/{{adminUserRole}}/g, request.user.role);
      content = content.replace(/{{adminProfilePic}}/g, request.user.profilePic ? request.user.profilePic : defaultProfilePicConstant.USER_PROFILE_PIC);
      template = template.replace(/{{template}}/g, content)

      sendMail(to, subject, 'Mentee Invitation', template);

      res.send(success(successMessage.SEND_SUCCESS.replace(':attribute', "Mail"), statusCode.OK))

    } catch (err) {
      logger.error(`There was an issue into send request mail.: ${err} `)
      res.status(statusCode.FORBIDDEN).send(error("There was an issue into send request mail.", err))
    }
  },

  getMatchList: async (req: Request, res: Response) => {
    try {
      const { menteeId, sort } = req.body;

      let isSortEmpty = _.isEmpty(sort);

      let menteeObj = await findOne({ collection: 'User', query: { _id: menteeId, role: userRoleConstant.MENTEE } });

      if (!menteeObj) {
        res.status(statusCode.BAD_REQUEST).send(error(errorMessage.NOT_EXISTS.replace(":attribute", 'mentee'), {}, statusCode.BAD_REQUEST));
        return
      }

      let sortKey: Array<any> = [], sortQuery: any;
      if (sort) {
        sortKey = Object.keys(sort)
      }

      let pipeLine: any = [
        {
          $match: { menteeId: new ObjectId(menteeId) }
        },
        {
          '$lookup': {
            'from': 'users',
            'localField': 'mentorId',
            'foreignField': '_id',
            'as': 'mentor'
          }
        }, {
          '$unwind': {
            'path': '$mentor'
          }
        }, {
          '$project': {
            _id: '$_id',
            'mentorName': { $concat: ['$mentor.preferredFname', " ", "$mentor.preferredLname"] } ? { $concat: ['$mentor.preferredFname', " ", "$mentor.preferredLname"] } : { $concat: ['$mentor.legalFname', " ", "$mentor.legalLname"] },
            'profilePic': '$mentor.profilePic',
            'som': '$SOM'
          }
        }
      ]

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
      }

      const getMatchesList = await aggregate({ collection: "PairInfo", pipeline: pipeLine })

      // const getMatchesList = await find({ collection: 'PairInfo', query: query, populate: { path: 'mentorId', select: 'legalFname legalLname preferredFname preferredLname profilePic' }, project: 'mentorId menteeId SOM createdAt', sort: sort });

      const matchesCount = getMatchesList.length;
      res.send(success(successMessage.FETCH_SUCCESS.replace(':attribute', "Matches list"), { getMatchesList, matchesCount }, statusCode.OK))
    } catch (err) {
      logger.error(`There was an issue into get matches list.: ${err} `)
      res.status(statusCode.FORBIDDEN).send(error("There was an issue get matches list.", err))
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
        query['$or'] = [{ partnerId: req.body.partnerIdOrRegionId }, { regionId: req.body.partnerIdOrRegionId }];
      }

      query['status'] = questionState.ACTIVE

      let pipeLine: Array<any> = [
        {
          $match: query
        },
        {
          $addFields: {
            question: { $cond: [{ $eq: ['$isAlternateQuestion', false] }, '$alternateQuestion', '$question'] }
          }
        },
        {
          $sort: {
            orderNum: 1
          }
        }
      ]

      query['category'] = categoryOfQuestion.PERSONALITY_AND_INTERESTS
      // const getPersonalityQue = await aggregate({ collection: "Matches", pipeline: pipeLine })
      const getPersonalityQue = await find({ collection: "Matches", query: query, sort: { orderNum: 1 } })

      query['category'] = categoryOfQuestion.CREEAR_AND_EXPERIENCE
      // const getCareerQue = await aggregate({ collection: "Matches", pipeline: pipeLine })
      const getCareerQue = await find({ collection: "Matches", query: query, sort: { orderNum: 1 } })

      query['category'] = categoryOfQuestion.EDUCATION_INFORMATION;
      query['question'] = { $nin: ["At what schools (colleges and graduate schools) did you study?", "What was the highest level of education that you completed (mentors must have a 2-year or 4-year college degree, at minimum)?"] }
      // const getEducationQue = await aggregate({ collection: "Matches", pipeline: pipeLine })
      const getEducationQue = await find({ collection: "Matches", query: query, sort: { orderNum: 1 } })

      res.send(success(successMessage.UPLOAD_SUCCESS.replace(':attribute', "profile pic"), { getPersonalityQue, getCareerQue, getEducationQue }, statusCode.OK))
    } catch (err: any) {
      res.status(statusCode.FORBIDDEN).send(error("There is some issue while fetching matching question.", err.message, statusCode.FORBIDDEN))
    }
  },

  menteesListV2: async (req: Request, res: Response) => {
    try {
      const request = req as requestUser;
      const payload = req.body;

      payload.page = payload.page ? payload.page - 1 : 0;
      payload.limit = payload.limit ?? 10;

      const query: any = [];

      if (request.user.region) {
        query.push({ $match: { region: request.user.region } });
      } else if (request.user.partnerAdmin) {
        query.push({ $match: { partnerAdmin: request.user.partnerAdmin } });
      }

      // Get Mentees From User Table Query
      query.push(
        {
          $match: { role: userRoleConstant.MENTEE, isDel: false, isDisabled: payload.disabledUserList }
        }
      )

      // Filters
      /** User Assigned Mentor Filter */
      if (payload.assignedMentor?.length) {
        const mentees = await distinct({
          collection: 'PairInfo',
          field: 'menteeId',
          query: { mentorId: { $in: payload.assignedMentor }, isConfirm: true }
        });

        query.push({ $match: { _id: { $in: mentees } } })
      }

      /** User Status Filter */
      if (payload.status?.length) {
        // Set Status Verify With Onboarding and PreMatch Step
        query.push(
          {
            $addFields: {
              status: {
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
                          { '$lte': ["$preMatchStep", 3] },
                          { '$eq': ["$status", "Draft"] },
                        ]
                      },
                      "Completed",
                      "$status"
                    ]
                  }
                ]
              },
            }
          }
        );

        query.push({ $match: { status: { $in: payload.status } } });
      }

      /** User Location Filter */
      if (payload.location?.length) {
        query.push({ $match: { 'address.city': { $in: payload.location } } });
      }

      // Count Match Data
      const countQuery = [...query];

      // Removed Unused Data
      query.push(
        {
          $project: {
            legalFname: 1,
            legalLname: 1,
            preferredFname: 1,
            preferredLname: 1,
            email: 1,
            menteesName: { $concat: ['$preferredFname', " ", "$preferredLname"] },
            menteeProfilePic: '$profilePic',
            locationCity: "$address.city",
            locationState: "$address.state",
            onboardingStep: 1,
            preMatchStep: 1,
            pairImported: 1,
            password: 1,
            status: 1,
            isField: 1,
            resentInvitationDate: 1,
            userActivationDate: 1,
            partnerAdmin: 1,
            region: 1,
            joinDate: '$createdAt',
          }
        }
      );

      // Sorting
      if (payload.sort.menteesName) {
        query.push(
          {
            $addFields: {
              menteeName: { $toLower: "$menteesName" },
            }
          },
          {
            $sort: {
              menteeName: payload.sort.menteesName === "asc" ? 1 : -1
            }
          }
        )
      } else if (payload.sort.locationCity) {
        query.push(
          {
            $addFields: {
              locationCity: { $toLower: "$locationCity" },
            }
          },
          {
            $sort: {
              locationCity: payload.sort.locationCity === "asc" ? 1 : -1
            }
          }
        )
      } else if (payload.sort.status) {
        query.push(
          {
            $addFields: {
              status: { $toLower: "$status" },
            }
          },
          {
            $sort: {
              status: payload.sort.status === "asc" ? 1 : -1
            }
          }
        )
      } else if (payload.sort.partnerOrRegion) {
        query.push(
          {
            $lookup: {
              from: 'partners',
              let: { pId: '$partnerAdmin' },
              pipeline: [
                {
                  $match: {
                    $expr: {
                      $eq: ["$$pId", "$_id"]
                    },
                    isDel: false
                  }
                }
              ],
              as: 'partners'
            }
          },
          {
            $unwind: {
              path: '$partners',
              preserveNullAndEmptyArrays: true
            }
          },
          {
            $lookup: {
              from: 'regions',
              let: { rId: '$region' },
              pipeline: [
                {
                  $match: {
                    $expr: {
                      $eq: ["$$rId", "$_id"]
                    },
                    isDel: false
                  }
                }
              ],
              as: 'regions'
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
            $addFields: {
              partnerOrRegion: {
                $cond: [{ $ifNull: ['$partnerOrRegion.partnerName', null] }, '$partnerOrRegion.partnerName', '$partnerOrRegion.region']
              },
            }
          },
          { $unset: ["partners", "regions"] }
        )

        query.push(
          {
            $addFields: {
              partnerOrRegion: { $toLower: "$partnerOrRegion" },
            }
          },
          {
            $sort: {
              partnerOrRegion: payload.sort.partnerOrRegion === "asc" ? 1 : -1
            }
          }
        )
      } else if (payload.sort.matches) {
        query.push(
          {
            $lookup: {
              from: 'pairinfos',
              let: { mId: '$_id' },
              pipeline: [
                {
                  $match: {
                    $expr: {
                      $eq: ["$$mId", "$menteeId"]
                    },
                    isDel: false
                  }
                }
              ],
              as: 'matches'
            }
          },
          {
            $addFields: {
              matches: { $size: "$matches" },
            },
          },
        )

        query.push(
          {
            $sort: {
              matches: payload.sort.matches === "asc" ? 1 : -1
            }
          }
        )
      } else if (payload.sort.assignedMentor) {
        query.push(
          {
            $lookup: {
              from: "pairinfos",
              let: { mentee: "$_id", },
              pipeline: [
                {
                  $match: {
                    $expr: {
                      $and: [{ $eq: ["$isConfirm", true] }, { $eq: ["$menteeId", "$$mentee"] }],
                    },
                  },
                },
              ],
              as: "menteePair",
            },
          },
          {
            $unwind: {
              path: '$menteePair',
              preserveNullAndEmptyArrays: true
            }
          },
          {
            $lookup: {
              from: 'users',
              localField: 'menteePair.mentorId',
              foreignField: '_id',
              as: 'menteePair.mentorId'
            }
          },
          {
            $unwind: {
              path: '$menteePair.mentorId',
              preserveNullAndEmptyArrays: true
            }
          },
          {
            $addFields: {
              assignedMentorId: '$menteePair.mentorId._id',
              assignedMentor: { $concat: ['$menteePair.mentorId.preferredFname', " ", "$menteePair.mentorId.preferredLname"] },
              assignedMentorProfilePic: '$menteePair.mentorId.profilePic',
            }
          },
          {
            $unset: "menteePair"
          }
        )

        query.push(
          {
            $addFields: {
              assignedMentor: { $toLower: "$assignedMentor" },
            }
          },
          {
            $sort: {
              assignedMentor: payload.sort.assignedMentor === "asc" ? 1 : -1
            }
          }
        )
      } else if (payload.sort.userActivationDate) {
        query.push(
          {
            $sort: {
              userActivationDate: payload.sort.userActivationDate === "asc" ? 1 : -1
            }
          }
        )
      } else {
        query.push(
          {
            $sort: { createdAt: -1 }
          },
        )
      }

      // Search
      if (payload.search) {
        query.push({
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
                { user_name: { $regex: '.*' + payload.search + '.*', $options: 'i' } },
                { reverseUsername: { $regex: '.*' + payload.search + '.*', $options: 'i' } },
                { withoutBlankName: { $regex: '.*' + payload.search + '.*', $options: 'i' } },
                { preferredFname: { $regex: '.*' + payload.search + '.*', $options: 'i' } },
                { preferredLname: { $regex: '.*' + payload.search + '.*', $options: 'i' } },
                { reverseWithoutBlankName: { $regex: '.*' + payload.search + '.*', $options: 'i' } }
              ]
            }
          });

        countQuery.concat(...query);
      }

      query.push(
        {
          $skip: (payload.page * payload.limit)
        },
        {
          $limit: payload.limit
        }
      )

      if (!payload.status.length) {
        // Set Status Verify With Onboarding and PreMatch Step
        query.push(
          {
            $addFields: {
              status: {
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
                          { '$lte': ["$preMatchStep", 3] },
                          { '$eq': ["$status", "Draft"] },
                        ]
                      },
                      "Completed",
                      "$status"
                    ]
                  }
                ]
              },
            }
          }
        );
      }

      // Matches Count
      if (!payload.sort.matches) {
        query.push(
          {
            $lookup: {
              from: 'pairinfos',
              let: { mId: '$_id' },
              pipeline: [
                {
                  $match: {
                    $expr: {
                      $eq: ["$$mId", "$menteeId"]
                    },
                    isDel: false
                  }
                }
              ],
              as: 'matches'
            }
          },
          {
            $addFields: {
              matches: { $size: "$matches" },
            },
          },
        )
      }

      // Notes Count
      query.push(
        {
          $lookup: {
            from: 'notes',
            let: {
              createdFor: '$_id'
            },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $eq: [
                      '$createdFor', '$$createdFor'
                    ]
                  },
                }
              }
            ],
            as: 'notes'
          }
        },
        {
          $addFields: {
            notes: { $size: "$notes" },
          },
        },
      )

      // Mentee Addditional Info For Get Mentee School
      query.push(
        {
          $lookup: {
            from: 'additionalinfos',
            let: { mId: '$_id' },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $eq: ["$$mId", "$userId"]
                  },
                }
              }
            ],
            as: 'userAddInfo'
          }
        },
        {
          $unwind: {
            path: '$userAddInfo',
            preserveNullAndEmptyArrays: true
          }
        },
        {
          $addFields: {
            school: '$userAddInfo.education_level.assignedSchoolOrInstitutions',
          },
        },
        {
          $unset: "userAddInfo"
        }
      )

      // Mentee Partner Or Regoin Detail
      if (!payload.sort.partnerOrRegion) {
        query.push(
          {
            $lookup: {
              from: 'partners',
              let: { pId: '$partnerAdmin' },
              pipeline: [
                {
                  $match: {
                    $expr: {
                      $eq: ["$$pId", "$_id"]
                    },
                    isDel: false
                  }
                }
              ],
              as: 'partners'
            }
          },
          {
            $unwind: {
              path: '$partners',
              preserveNullAndEmptyArrays: true
            }
          },
          {
            $lookup: {
              from: 'regions',
              let: { rId: '$region' },
              pipeline: [
                {
                  $match: {
                    $expr: {
                      $eq: ["$$rId", "$_id"]
                    },
                    isDel: false
                  }
                }
              ],
              as: 'regions'
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
            $addFields: {
              partnerOrRegion: {
                $cond: [{ $ifNull: ['$partnerOrRegion.partnerName', null] }, '$partnerOrRegion.partnerName', '$partnerOrRegion.region']
              },
            }
          },
          { $unset: ["partners", "regions"] }
        )
      }

      if (!payload.sort.assignedMentor) {
        // Get Assigned Mentor
        query.push(
          {
            $lookup: {
              from: "pairinfos",
              let: { mentee: "$_id", },
              pipeline: [
                {
                  $match: {
                    $expr: {
                      $and: [{ $eq: ["$isConfirm", true] }, { $eq: ["$menteeId", "$$mentee"] }],
                    },
                  },
                },
              ],
              as: "menteePair",
            },
          },
          {
            $unwind: {
              path: '$menteePair',
              preserveNullAndEmptyArrays: true
            }
          },
          {
            $lookup: {
              from: 'users',
              localField: 'menteePair.mentorId',
              foreignField: '_id',
              as: 'menteePair.mentorId'
            }
          },
          {
            $unwind: {
              path: '$menteePair.mentorId',
              preserveNullAndEmptyArrays: true
            }
          },
          {
            $addFields: {
              assignedMentorId: '$menteePair.mentorId._id',
              assignedMentor: { $concat: ['$menteePair.mentorId.preferredFname', " ", "$menteePair.mentorId.preferredLname"] },
              assignedMentorProfilePic: '$menteePair.mentorId.profilePic',
            }
          },
          {
            $unset: "menteePair"
          }
        )
      }

      const menteesCount = aggregate({ collection: "User", pipeline: countQuery });
      const menteesArr = aggregate({ collection: "User", pipeline: query });

      const response: any = await Promise.allSettled([menteesCount, menteesArr]);
      console.log(response[0].value?.length);
      console.log(response[1].value?.length);

      const result: any = {
        page: payload.page + 1,
        pages: Math.ceil(response[0]?.value?.length / payload.limit),
        total: response[0].value?.length,
        limit: payload.limit,
        docs: response[1].value,
      };

      return res.send(success(successMessage.FETCH_SUCCESS.replace(":attribute", "menteesList"), result, statusCode.OK));
    } catch (err: any) {
      res.status(statusCode.FORBIDDEN).send(error("There is some issue in fetching menteesList.", err.message, statusCode.FORBIDDEN));
    }
  },
};
