import { Request, Response } from "express";
import { ObjectId, aggregate, find, findOne, insertMany, insertOne, paginate, updateMany, updateOne, deleteMany, findOneAndUpdate } from "../utils/db";
import { logger } from "../utils/helpers/logger";
import { error, success } from "../utils/helpers/resSender";
import { findByIdAndUpdate } from "../utils/db";
import { errorMessage, statusCode, successMessage, userRoleConstant, ContentConstants, User_Activity } from "../utils/const";
import csvtojson from 'csvtojson';
import { requestUser } from "../Interfaces/schemaInterfaces/user";
import { capitalizeFirstLetter, isEmailAlreadyExists } from "../utils/helpers/functions";
import { questionList } from "../utils/defaultQuestions";
import { checkIsCourseCompletedByMentor } from "../Controller/content.controller";
import exportFileFunction from "../utils/exportCSV";

export let partnerController = {
  partnerList: async function (req: any, res: any) {
    try {
      let { search, partnerFilter, regionFilter, SchoolOrInstituteFilter, sort, page, limit } = req.body;
      let sortQuery: any = {};
      sort = sort || {};
      sortQuery[String(Object.keys(sort)) || "_id"] = String(Object.values(sort)) == "asc" ? 1 : -1;
      let query: { $and: any[] } = { $and: [{ isDel: false }] };
      if (search)
        query.$and.push({
          $or: [{ partnerName: { $regex: search, $options: "i" } }, { region: { $regex: search, $options: "i" } }],
        });
      if (partnerFilter?.length) query.$and.push({ partnerName: { $in: partnerFilter } });
      if (regionFilter?.length) query.$and.push({ region: { $in: regionFilter } });
      if (SchoolOrInstituteFilter?.length) query.$and.push({ assignedSchoolOrInstitute: { $in: SchoolOrInstituteFilter } });
      if (req.user.role != userRoleConstant.I_SUPER_ADMIN) query.$and.push({ createdBy: req.user._id });
      let userData = await paginate({
        collection: "Partner",
        query: query,
        options: {
          populate: [{ path: "createdBy", select: "legalFname legalLname" }],
          collation: {
            locale: "en",
            strength: 2,
          },
          sort: sortQuery,
          limit: limit || 10,
          page: page || 1,
        },
      });
      res.send(success(successMessage.FETCH_SUCCESS.replace(":attribute", "partnerList"), userData, statusCode.OK));
    } catch (err: any) {
      logger.error("partnerController > partnerList ", err);
      res.status(statusCode.FORBIDDEN).send(error("There is some issue to get Partner list.", err.message, statusCode.FORBIDDEN));
    }
  },

  getPartner: async function (req: any, res: any) {
    try {
      let { id } = req.query;
      let partner = await findOne({
        collection: "Partner",
        query: { _id: id },
      });
      if (!partner) {
        return res
          .status(statusCode.BAD_REQUEST)
          .send(error(errorMessage.NOT_EXISTS.replace(":attribute", "Partner"), {}, statusCode.BAD_REQUEST));
      }

      const defaultTraining = await findOne({
        collection: "AssignedCourses",
        query: {
          assignedUserType: ContentConstants.ASSIGNED_USER_TYPES.partner,
          courseType: ContentConstants.COURSES_TYPE.training,
          partnerIdOrRegionId: id,
          isDefaultCourse: true
        },
        project: { thinkificCourseId: 1 }
      });

      partner.defaultTrainingId = defaultTraining;

      res.send(success(successMessage.FETCH_SUCCESS.replace(":attribute", "partnerList"), partner, statusCode.OK));
    } catch (err: any) {
      logger.error("partnerController > getPartner ", err);
      res.status(statusCode.FORBIDDEN).send(error("There is some issue to get Partner list.", err.message, statusCode.FORBIDDEN));
    }
  },

  getSchoolOrInstitute: async function (req: any, res: any) {
    try {
      let { id, sort } = req.query;
      let partner = await findOne({
        collection: "Partner",
        query: { _id: id },
        project: { assignedSchoolOrInstitute: 1 },
      });
      if (!partner) {
        return res
          .status(statusCode.BAD_REQUEST)
          .send(error(errorMessage.NOT_EXISTS.replace(":attribute", "Partner"), {}, statusCode.BAD_REQUEST));
      }
      if (sort && sort == "desc") partner.assignedSchoolOrInstitute.sort((a: any, b: any) => b.localeCompare(a));
      if (sort && sort == "asc") partner.assignedSchoolOrInstitute.sort((a: any, b: any) => a.localeCompare(b));
      res.send(success(successMessage.FETCH_SUCCESS.replace(":attribute", "partnerList"), partner, statusCode.OK));
    } catch (err: any) {
      logger.error("partnerController > getPartner ", err);
      res.status(statusCode.FORBIDDEN).send(error("There is some issue to get Partner list.", err.message, statusCode.FORBIDDEN));
    }
  },

  partnerEdit: async function (req: any, res: any) {
    try {
      let { id, defaultTrainingId } = req.body;
      let partner = await findOne({
        collection: "Partner",
        query: { _id: id },
      });
      if (!partner) {
        return res
          .status(statusCode.BAD_REQUEST)
          .send(error(errorMessage.NOT_EXISTS.replace(":attribute", "Partner"), {}, statusCode.BAD_REQUEST));
      }
      delete req.body.id;
      //Sentize School Name
      if (partner.assignedSchoolOrInstitute.length) {
        req.body.assignedSchoolOrInstitute = req.body.assignedSchoolOrInstitute.filter(
          (ele: any, index: any, array: any) => array.indexOf(ele) == index
        );
      }
      if (!req.body.region) req.body.region = "--";

      // check old default training
      const defaultTraining = await findOne({
        collection: "AssignedCourses",
        query: {
          assignedUserType: ContentConstants.ASSIGNED_USER_TYPES.partner,
          courseType: ContentConstants.COURSES_TYPE.training,
          partnerIdOrRegionId: id,
          isDefaultCourse: true
        },
        project: { thinkificCourseId: 1 }
      });

      if (defaultTraining) {
        const oldDeafaultTraining = defaultTraining.thinkificCourseId;

        // check is all mentor complete old default training
        // const isUnComplete = await findOne({
        //   collection: 'RecommendedCourses',
        //   query: {
        //     thinkificCourseId: oldDeafaultTraining,
        //     partnerIdOrRegionId: partner._id,
        //     percentageCompleted: { $lt: 100 }
        //   },
        // });

        // if (isUnComplete) {
        //   const errMsg = errorMessage.UNABLE_SET_DEFAULT_TRAINING;
        //   res.status(statusCode.BAD_REQUEST).send(error(errMsg, {}, statusCode.BAD_REQUEST))
        //   return
        // }

        if (oldDeafaultTraining != defaultTrainingId) {
          const checkCompletedData = {
            partnerIdOrRegionId: partner._id,
            thinkificCourseId: oldDeafaultTraining,
          }

          const isCompletedByMentors = await checkIsCourseCompletedByMentor(checkCompletedData);

          if (!isCompletedByMentors) {
            const errMsg = errorMessage.UNABLE_SET_DEFAULT_TRAINING;
            res.status(statusCode.BAD_REQUEST).send(error(errMsg, {}, statusCode.BAD_REQUEST))
            return
          }

          // update old default course to false
          const oldCourse = await findOneAndUpdate({
            collection: 'AssignedCourses',
            query: { _id: defaultTraining._id },
            update: { isDefaultCourse: false },
            options: { new: true }
          });
        }
      }

      if (defaultTrainingId) {
        // update new default course to true
        const newCourse = await findOneAndUpdate({
          collection: 'AssignedCourses',
          query: {
            thinkificCourseId: defaultTrainingId,
            assignedUserType: ContentConstants.ASSIGNED_USER_TYPES.partner,
            partnerId: id,
            regionId: null,
            courseType: ContentConstants.COURSES_TYPE.training,
            partnerIdOrRegionId: id
          },
          update: { isDefaultCourse: true },
          options: { upsert: true, new: true }
        });
      }

      await updateOne({
        collection: "Partner",
        query: { _id: partner?._id },
        update: { $set: req.body },
      });

      let audit;
      if (partner?.logo != req.body.logo) {
        audit = User_Activity.PARTNER_LOGO_UPDATED;
      } else {
        audit = User_Activity.PARTNER_DATA_UPDATED;
      }

      res.send(success(successMessage.UPDATE_SUCCESS.replace(":attribute", "Partner"), { isAuditLog: true, audit, auditIds: [partner?._id] }, statusCode.OK));
    } catch (err: any) {
      logger.error("partnerController > partnerEdit ", err);
      res.status(statusCode.FORBIDDEN).send(error("There is some issue to get Partner list.", err.message, statusCode.FORBIDDEN));
    }
  },

  createPartner: async function (req: any, res: any) {
    try {
      let request = req as requestUser
      let { partnerName, assignedSchoolOrInstitute, region, logo, contactEmail, defaultTrainingId } = req.body;
      if (req.user.role != userRoleConstant.I_SUPER_ADMIN)
        return res
          .status(statusCode.BAD_REQUEST)
          .send(error("Unauthorized For Doing This Operation", {}, statusCode.BAD_REQUEST));

      const isEmailExists: any = await isEmailAlreadyExists(contactEmail)
      if (!isEmailExists) {
        return res
          .status(statusCode.BAD_REQUEST)
          .send(error(errorMessage.ALREADY_EXISTS.replace(":attribute", "email"), {}, statusCode.BAD_REQUEST));
      }

      let partner = await findOne({
        collection: "Partner",
        query: { partnerName, contactEmail: contactEmail, isDel: false },
      });

      if (partner) {
        return res
          .status(statusCode.BAD_REQUEST)
          .send(error(errorMessage.ALREADY_EXISTS.replace(":attribute", "partner"), {}, statusCode.BAD_REQUEST));
      }

      let isPartnerNameExists = await findOne({
        collection: "Partner",
        query: { partnerName, contactEmail: { $ne: contactEmail }, isDel: false },
      });

      if (isPartnerNameExists) {
        return res
          .status(statusCode.BAD_REQUEST)
          .send(error(errorMessage.ALREADY_EXISTS.replace(":attribute", "partner name"), {}, statusCode.BAD_REQUEST));
      }

      const isPertnerEmailExists = await findOne({ collection: 'Partner', query: { partnerName: { $ne: partnerName }, contactEmail: contactEmail, isDel: false } });

      if (isPertnerEmailExists) {
        return res
          .status(statusCode.BAD_REQUEST)
          .send(error(errorMessage.ALREADY_EXISTS.replace(":attribute", "partner mail"), {}, statusCode.BAD_REQUEST));
      }

      let thinkificCourse: any = null;

      if (defaultTrainingId) {
        thinkificCourse = await findOne({
          collection: "ThinkificCourses",
          query: {
            _id: defaultTrainingId,
            courseType: ContentConstants.COURSES_TYPE.training,
            courseStatus: ContentConstants.ASSIGNED_COURSE_STATUS.published
          },
          project: { _id: 1 }
        });

        if (!thinkificCourse) {
          const errMsg = errorMessage.NOT_EXISTS.replace(':attribute', 'defaultTrainingId');
          res.status(statusCode.BAD_REQUEST).send(error(errMsg, {}, statusCode.BAD_REQUEST))
          return
        }
      }

      let createData = await insertOne({
        collection: "Partner",
        document: {
          partnerName, assignedSchoolOrInstitute, region, createdBy: req.user._id, logo, contactEmail
        },
      });

      // add record into assigned courses.
      if (defaultTrainingId && thinkificCourse && createData && createData._id) {
        const partnerId = createData._id;

        const assignedCourse = await insertOne({
          collection: "AssignedCourses",
          document: {
            thinkificCourseId: defaultTrainingId,
            assignedUserType: ContentConstants.ASSIGNED_USER_TYPES.partner,
            partnerId: partnerId,
            regionId: null,
            courseType: ContentConstants.COURSES_TYPE.training,
            partnerIdOrRegionId: partnerId,
            isDefaultCourse: true
          },
        });
      } 

      let questionListArray: Array<any> = questionList;

      for (let i = 0; i < questionListArray.length; i++) {
        const que = questionListArray[i];

        let obj: any = {
          category: que.category,
          question: que.question,
          alternateQuestion: que.alternateQuestion,
          isAlternateQuestion: que.isAlternateQuestion,
          isDefaultQuestion: que.isDefaultQuestion,
          option: que.option,
          queType: que.queType,
          status: que.status,
          weight: que.weight,
          isDraft: que.isDraft,
          orderNum: que.orderNum,
          partnerId: createData._id,
          createdBy: request.user._id
        }
        await insertOne({
          collection: "Matches",
          document: obj,
        });
      }

      res.send(success("Partner has been successfully created.", { createData, isAuditLog: true, audit: User_Activity.CREATE_PARTNER }, statusCode.OK));
    } catch (err: any) {
      logger.error("partnerController > createPartner ", err);
      res
        .status(statusCode.FORBIDDEN)
        .send(error("There is some issue to Create Partner list.", err.message, statusCode.FORBIDDEN));
    }
  },

  bulkPartnerCreate: async (req: Request, res: Response) => {
    try {
      const file: any = req.file;
      let filePath = __dirname + "/../../" + file.path;
      let skippedUser: Array<any> = [], message: string = "", obj: any = {};
      const request = req as requestUser;
      const createdBy = request.user._id;

      csvtojson()
        .fromFile(filePath)
        .then(async (data: Array<any>) => {
          if (request.user.role != userRoleConstant.I_SUPER_ADMIN) {
            res.status(statusCode.UNAUTHORIZED).send(error(errorMessage.ACTION.replace(":attribute", request.user.role), {}, statusCode.UNAUTHORIZED));
            return
          }

          const totalData = data.length;
          const auditIds: any = [];

          for (let i = 0; i < data.length; i++) {
            let rows = data[i];
            for (var key in rows) {
              if (!rows[key]) {
                key = capitalizeFirstLetter(key);
                message = `${key} is required.`
                break
              }
            }

            if (rows['contactEmail']) {
              let regexPattern = /\S+@\S+\.\S+/
              let isEmailValid = regexPattern.test(rows['contactEmail'])
              if (!isEmailValid) {
                message = `Invalid Email.`
              }
            }

            if (!message && rows.partnerName && rows.assignedSchoolOrInstitute && rows.city && rows.contactEmail) {

              const isEmailExists: any = await isEmailAlreadyExists(rows.contactEmail)

              const isPartnerExists = await findOne({ collection: 'Partner', query: { partnerName: rows.partnerName, contactEmail: rows.contactEmail, isDel: false } })

              const isPartnerNameExists = await findOne({ collection: 'Partner', query: { partnerName: rows.partnerName, contactEmail: { $ne: rows.contactEmail }, isDel: false } });

              const isPertnerEmailExists = await findOne({ collection: 'Partner', query: { partnerName: { $ne: rows.partnerName }, contactEmail: rows.contactEmail, isDel: false } });

              if (isEmailExists && !isPartnerExists && !isPartnerNameExists && !isPertnerEmailExists) {
                obj = {
                  partnerName: rows.partnerName,
                  assignedSchoolOrInstitute: rows.assignedSchoolOrInstitute ? rows.assignedSchoolOrInstitute : "",
                  region: rows.city ? rows.city : "",
                  contactEmail: rows.contactEmail,
                  createdBy: createdBy,
                  partnerImported: true
                }
                let createData = await insertOne({ collection: 'Partner', document: obj });
                auditIds.push(createData._id);

                let questionListArray: Array<any> = questionList;

                for (let i = 0; i < questionListArray.length; i++) {
                  const que = questionListArray[i];

                  let obj: any = {
                    category: que.category,
                    question: que.question,
                    alternateQuestion: que.alternateQuestion,
                    isAlternateQuestion: que.isAlternateQuestion,
                    isDefaultQuestion: que.isDefaultQuestion,
                    option: que.option,
                    queType: que.queType,
                    status: que.status,
                    weight: que.weight,
                    isDraft: que.isDraft,
                    orderNum: que.orderNum,
                    partnerId: createData._id,
                    createdBy: request.user._id
                  }
                  await insertOne({
                    collection: "Matches",
                    document: obj,
                  });
                }
              } else {
                obj = {};
                message = "Partner name or email already Exists.";
              }
            } /* else {
              message = `Partner name is required.`
            } */

            if (message) {
              rows.message = message;
              rows.row = i + 2
              skippedUser.push(rows)
              message = ""
            }
          }
          let uplaodedUser = data.length - skippedUser.length
          let skippedUserCount = skippedUser.length

          let csvUrl: any;

          if (skippedUser && skippedUser.length > 0) {
            csvUrl = await exportFileFunction(true, 'skipPartnerCsv', skippedUser, res, req);
          }

          csvUrl = (csvUrl && csvUrl.filePath) ? csvUrl.filePath : "";
          res.status(statusCode.OK).send(success(successMessage.UPLOAD_SUCCESS.replace(':attribute', "CSV file"), {
            skippedUser, skippedUserCount, uplaodedUser, csvUrl, totalData, auditIds, isCsv: true, isAuditLog: true, audit: User_Activity.CREATE_BULK_PARTNER
          }))
        })
    } catch (err: any) {
      res.status(statusCode.FORBIDDEN).send(error("There is some issue while importing user from CSV.", err.message, statusCode.FORBIDDEN))
    }
  },

  SchoolOrInstitute: async function (req: Request, res: Response) {
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


  SchoolOrInstituteListApis: async function (req: Request, res: Response) {
    try {
      let { search, partnerFilter, regionFilter, SchoolOrInstituteFilter, sort, page, limit } = req.body;
      let sortQuery: any = {};
      sort = sort || {};
      limit = limit || 10;
      page = page || 1;
      sortQuery[String(Object.keys(sort)) || "_id"] = String(Object.values(sort)) == "asc" ? 1 : -1;
      let query: { $and: any[] } = { $and: [{ isDel: false }] };
      if (search)
        query.$and.push({
          $or: [{ partnerName: { $regex: search, $options: "i" } }, { region: { $regex: search, $options: "i" } }],
        });
      if (partnerFilter?.length) query.$and.push({ partnerName: { $in: partnerFilter } });
      if (regionFilter?.length) query.$and.push({ region: { $in: regionFilter } });
      if (SchoolOrInstituteFilter?.length) query.$and.push({ assignedSchoolOrInstitute: { $in: SchoolOrInstituteFilter } });
      let pipeline: any = [
        {
          $match: query,
        },
        { $sort: sortQuery },

        {
          $unwind: "$assignedSchoolOrInstitute",
        },
        {
          $project: {
            Name: "$assignedSchoolOrInstitute",
            AssignedToPartner: "$partnerName",
            PartnerRegion: "$region",
          },
        },
      ];
      let count = await aggregate({
        collection: "Partner",
        pipeline,
      });
      let total = count.length;
      pipeline.push({ $skip: (page - 1) * limit }, { $limit: limit });
      let userData = await aggregate({
        collection: "Partner",
        pipeline,
      });
      res.send(
        success(
          successMessage.FETCH_SUCCESS.replace(":attribute", "partnerList"),
          { docs: userData, total, limit, page, pages: Math.ceil(total / limit) },
          statusCode.OK
        )
      );
    } catch (err: any) {
      logger.error("partnerController > SchoolOrInstituteListApis ", err);
      res
        .status(statusCode.FORBIDDEN)
        .send(error("There is some issue to Create SchoolOrInstitute list.", err.message, statusCode.FORBIDDEN));
    }
  },

  addNewSchoolOrInstitute: async function (req: any, res: any) {
    try {
      let { id, SchoolOrInstitute } = req.body;
      let user = await findOne({
        collection: "Partner",
        query: {
          _id: id,
        },
      });
      if (!user) {
        return res
          .status(statusCode.NOT_FOUND)
          .send(error(errorMessage.NOT_EXISTS.replace(":attribute", "Partner"), {}, statusCode.NOT_FOUND));
      }
      //Sentize School Name
      if (user.assignedSchoolOrInstitute.length) {
        SchoolOrInstitute = SchoolOrInstitute.filter((ele: any) => !user.assignedSchoolOrInstitute.includes(ele));
        if (!SchoolOrInstitute.length)
          return res
            .status(statusCode.BAD_REQUEST)
            .send(error(errorMessage.ALREADY_EXISTS.replace(":attribute", "SchoolOrInstitute"), {}, statusCode.BAD_REQUEST));
      }

      let data = await updateOne({
        collection: "Partner",
        query: { _id: id },
        update: { $push: { assignedSchoolOrInstitute: { $each: SchoolOrInstitute } } },
      });
      res.send(success("School/Institute has been successfully assigned", { isAuditLog: true, audit: User_Activity.ADD_NEW_SCHOOL }, statusCode.OK));
    } catch (err: any) {
      logger.error("partnerController > addNewSchoolOrInstitute ", err);
      res
        .status(statusCode.FORBIDDEN)
        .send(error("There is some issue to Create addNewSchoolOrInstitute APi.", err.message, statusCode.FORBIDDEN));
    }
  },

  removeNewSchoolOrInstitute: async function (req: any, res: any) {
    try {
      let { id, SchoolOrInstitute } = req.body;
      let user = await findOne({
        collection: "Partner",
        query: {
          _id: id,
        },
      });
      if (!user) {
        return res
          .status(statusCode.NOT_FOUND)
          .send(error(errorMessage.NOT_EXISTS.replace(":attribute", "Partner"), {}, statusCode.NOT_FOUND));
      }

      let data = await updateOne({
        collection: "Partner",
        query: { _id: id },
        update: { $pull: { assignedSchoolOrInstitute: { $in: SchoolOrInstitute } } },
      });
      res.send(success("School/Institute has been successfully unassigned", { isAuditLog: true, audit: User_Activity.REMOVE_NEW_SCHOOL }, statusCode.OK));
    } catch (err: any) {
      logger.error("partnerController > removeNewSchoolOrInstitute ", err);
      res
        .status(statusCode.FORBIDDEN)
        .send(error("There is some issue to Create addNewSchoolOrInstitute APi.", err.message, statusCode.FORBIDDEN));
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
      res.send(success(successMessage.ADD_SUCCESS.replace(":attribute", "SchoolOrInstituteInApp"), { isAuditLog: true, audit: User_Activity.ADD_NEW_SCHOOL }, statusCode.OK));
    } catch (err: any) {
      logger.error("partnerController > addNewSchoolOrInstitute ", err);
      res
        .status(statusCode.FORBIDDEN)
        .send(error("There is some issue to Create addNewSchoolOrInstituteInApp .", err.message, statusCode.FORBIDDEN));
    }
  },

  partnerListDelete: async function (req: any, res: any) {
    try {
      let { id } = req.body;
      //id Is array of _ids
      let partnerFind = await find({
        collection: "Partner",
        query: { _id: { $in: id } },
      });
      if (!partnerFind) {
        return res
          .status(statusCode.NOT_FOUND)
          .send(error(errorMessage.NOT_EXISTS.replace(":attribute", "Partner"), {}, statusCode.NOT_FOUND));
      }
      await deleteMany({
        collection: "Partner",
        query: {
          _id: id,
        }
      });

      res.send(success("Partner has been successfully removed.", {}, statusCode.OK));
    } catch (err: any) {
      logger.error("partnerController > partnerListDelete ", err);
      res
        .status(statusCode.FORBIDDEN)
        .send(error("There is some issue to Create partnerListDelete.", err.message, statusCode.FORBIDDEN));
    }
  },

  filterOptions: async function (req: any, res: any) {
    try {
      let pipeline = [
        { $match: { isDel: false } },
        {
          $group: {
            _id: null,
            partnerName: { $push: "$partnerName" },
            assignedSchoolOrInstitute: { $push: "$assignedSchoolOrInstitute" },
            region: { $push: "$region" },
          },
        },
        {
          $project: {
            _id: 0,
            partnerName: {
              $filter: {
                input: "$partnerName",
                cond: { $ne: ["$$this", ""] },
              },
            },
            assignedSchoolOrInstitute: {
              $reduce: {
                input: "$assignedSchoolOrInstitute",
                initialValue: [],
                in: { $concatArrays: ["$$value", "$$this"] },
              },
            },
            region: {
              $filter: {
                input: "$region",
                cond: { $not: { $in: ["$$this", ["", "--"]] } },
              },
            },
          },
        },

        {
          $project: {
            partnerName: {
              $setUnion: ["$partnerName", []],
            },
            assignedSchoolOrInstitute: {
              $setUnion: ["$assignedSchoolOrInstitute", []],
            },
            region: {
              $setUnion: ["$region", []],
            },
          },
        },
      ];
      let useData = await aggregate({
        collection: "Partner",
        pipeline,
      });

      (useData[0]?.partnerName || []).sort((a: any, b: any) => { return a.localeCompare(b) });

      (useData[0]?.assignedSchoolOrInstitute || []).sort((a: any, b: any) => { return a.localeCompare(b) });

      (useData[0]?.region || []).sort((a: any, b: any) => { return a.localeCompare(b) });

      res.send(success(successMessage.FETCH_SUCCESS.replace(":attribute", "filterOptions"), useData[0], statusCode.OK));
    } catch (err: any) {
      logger.error("partnerController > filterOptions ", err);
      res
        .status(statusCode.FORBIDDEN)
        .send(error("There is some issue to get filterOptions list.", err.message, statusCode.FORBIDDEN));
    }
  },
};
