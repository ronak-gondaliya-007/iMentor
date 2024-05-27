import { Request, Response } from "express";
import {
  distinct,
  find,
  findOne,
  findOneAndUpdate,
  insertMany,
  insertOne,
  updateMany,
  paginate,
  deleteMany,
  updateOne,
  aggregate,
} from "../utils/db";
import {
  categoryOfQuestion,
  errorMessage,
  statusCode,
  successMessage,
  uploadConstant,
  userRoleConstant,
  userStatusConstant,
  ContentConstants,
  User_Activity,
} from "../utils/const";
import { success, error } from "../utils/helpers/resSender";
import { logger } from "../utils/helpers/logger";
import csvtojson from "csvtojson";
import { requestUser } from "../Interfaces/schemaInterfaces/user";
import fs from "fs/promises";
import { capitalizeFirstLetter, isEmailAlreadyExists } from "../utils/helpers/functions";
import _ from 'lodash';
import { questionList } from "../utils/defaultQuestions";
import { checkIsCourseCompletedByMentor } from "../Controller/content.controller";
import exportFileFunction from "../utils/exportCSV";
 
export const regionController = {
  addRegion: async (req: any, res: any) => {
    try {
      let request = req as requestUser
      const { region, city, assignedSchoolOrInstitute, contactEmail, defaultTrainingId } = req.body;

      const isEmailExists: any = await isEmailAlreadyExists(contactEmail)

      if (!isEmailExists) {
        return res
          .status(statusCode.BAD_REQUEST)
          .send(error(errorMessage.ALREADY_EXISTS.replace(":attribute", "email"), {}, statusCode.BAD_REQUEST));
      }

      const isRegion = await findOne({
        collection: "Region",
        query: { region: region, contactEmail: contactEmail, isDel: false },
      });

      if (isRegion) {
        return res
          .status(statusCode.BAD_REQUEST)
          .send(error(errorMessage.ALREADY_EXISTS.replace(":attribute", "region"), {}, statusCode.BAD_REQUEST));
      }

      const isRegionExists = await findOne({
        collection: "Region",
        query: { region, contactEmail: { $ne: contactEmail }, isDel: false /* { $regex: new RegExp("^" + region + "", "i") } */ },
      });

      if (isRegionExists) {
        res.status(statusCode.BAD_REQUEST).send(error("Region already exists", {}, statusCode.BAD_REQUEST));
        return;
      }

      const isRegionEmailExists = await findOne({ collection: 'Region', query: { region: { $ne: region }, contactEmail: contactEmail, isDel: false } });

      if (isRegionEmailExists) {
        return res
          .status(statusCode.BAD_REQUEST)
          .send(error(errorMessage.ALREADY_EXISTS.replace(":attribute", "region mail"), {}, statusCode.BAD_REQUEST));
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

      const addRegion = await insertOne({
        collection: "Region",
        document: {
          region: region || "--",
          city: city || "--",
          assignedSchoolOrInstitute: assignedSchoolOrInstitute,
          contactEmail: contactEmail,
          createdBy: req.user._id,
        },
      });

      // add record into assigned courses.
      if (defaultTrainingId && thinkificCourse && addRegion && addRegion._id) {
        const regionId = addRegion._id;

        const assignedCourse = await insertOne({
          collection: "AssignedCourses",
          document: {
            thinkificCourseId: defaultTrainingId,
            assignedUserType: ContentConstants.ASSIGNED_USER_TYPES.region,
            partnerId: null,
            regionId: regionId,
            courseType: ContentConstants.COURSES_TYPE.training,
            partnerIdOrRegionId: regionId,
            isDefaultCourse: true
          },
        });
      }


      let questionListArray: Array<any> = questionList

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
          orderNum: i,
          regionId: addRegion._id,
          createdBy: request.user._id
        }
        await insertOne({
          collection: "Matches",
          document: obj,
        });
      }

      res.send(success(successMessage.CREATE_SUCCESS.replace(":attribute", "Region"), { addRegion, isAuditLog: true, audit: User_Activity.CREATE_REGION }, statusCode.OK));
    } catch (err) {
      logger.error(`There was an issue into add region.: ${err}`);
      res.status(statusCode.FORBIDDEN).send(error(err));
    }
  },

  getRegion: async function (req: any, res: any) {
    try {
      let { search, cityFilter, regionFilter, SchoolOrInstituteFilter, sort, page, limit } = req.body;
      let sortQuery: any = {};
      sort = sort || {};
      sortQuery[String(Object.keys(sort)) || "_id"] = String(Object.values(sort)) == "asc" ? 1 : -1;
      let query: { $and: any[] } = { $and: [{ isDel: false }] };
      if (search)
        query.$and.push({
          $or: [{ region: { $regex: search, $options: "i" } }, { city: { $regex: search, $options: "i" } }],
        });
      if (cityFilter?.length) query.$and.push({ city: { $in: cityFilter } });
      if (regionFilter?.length) query.$and.push({ region: { $in: regionFilter } });
      if (SchoolOrInstituteFilter?.length) query.$and.push({ assignedSchoolOrInstitute: { $in: SchoolOrInstituteFilter } });
      if (req.user.role != userRoleConstant.I_SUPER_ADMIN) query.$and.push({ createdBy: req.user._id });
      let userData = await paginate({
        collection: "Region",
        query: query,
        options: {
          collation: {
            locale: "en",
            strength: 2,
          },
          sort: sortQuery,
          limit: limit || 10,
          page: page || 1,
        },
      });
      res.send(success(successMessage.FETCH_SUCCESS.replace(":attribute", "RegionList"), userData, statusCode.OK));
    } catch (err: any) {
      logger.error("regionController > partnerList ", err);
      res.status(statusCode.FORBIDDEN).send(error("There is some issue to get Region list.", err.message, statusCode.FORBIDDEN));
    }
  },

  deleteRegion: async (req: Request, res: Response) => {
    try {
      const { region } = req.body;

      const deleteRegion = await deleteMany({
        collection: "Region",
        query: { _id: region },
      });

      res.send(success(successMessage.DELETE_SUCCESS.replace(":attribute", "Region"), deleteRegion, statusCode.OK));
    } catch (err: any) {
      logger.error(`There was an issue into delete region.: ${err}`);
      res
        .status(statusCode.FORBIDDEN)
        .send(error("There is some issue to get deleteRegion list.", err.message, statusCode.FORBIDDEN));
    }
  },
  getOneRegion: async function (req: any, res: any) {
    try {
      let { id } = req.query;
      let partner = await findOne({
        collection: "Region",
        query: { _id: id },
      });
      if (!partner) {
        return res
          .status(statusCode.BAD_REQUEST)
          .send(error(errorMessage.NOT_EXISTS.replace(":attribute", "Region"), {}, statusCode.BAD_REQUEST));
      }

      const defaultTraining = await findOne({
        collection: "AssignedCourses",
        query: {
          assignedUserType: ContentConstants.ASSIGNED_USER_TYPES.region,
          courseType: ContentConstants.COURSES_TYPE.training,
          partnerIdOrRegionId: id,
          isDefaultCourse: true
        },
        project: { thinkificCourseId: 1 }
      });

      partner.defaultTrainingId = defaultTraining;

      res.send(success(successMessage.FETCH_SUCCESS.replace(":attribute", "Region"), partner, statusCode.OK));
    } catch (err: any) {
      logger.error("regionController > getPartner ", err);
      res.status(statusCode.FORBIDDEN).send(error("There is some issue to get Partner list.", err.message, statusCode.FORBIDDEN));
    }
  },
  regionEdit: async function (req: any, res: any) {
    try {
      let { id, defaultTrainingId } = req.body;
      let partner = await findOne({
        collection: "Region",
        query: { _id: id },
      });
      if (!partner) {
        return res
          .status(statusCode.BAD_REQUEST)
          .send(error(errorMessage.NOT_EXISTS.replace(":attribute", "Region"), {}, statusCode.BAD_REQUEST));
      }
      delete req.body.id;
      //Sentize School Name
      if (partner.assignedSchoolOrInstitute.length) {
        req.body.assignedSchoolOrInstitute = req.body.assignedSchoolOrInstitute.filter(
          (ele: any, index: any, array: any) => array.indexOf(ele) == index
        );
      }
      if (!req.body.region) req.body.region = "--";
      if (!req.body.city) req.body.city = "--";

      // check old default training
      const defaultTraining = await findOne({
        collection: "AssignedCourses",
        query: {
          assignedUserType: ContentConstants.ASSIGNED_USER_TYPES.region,
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
            assignedUserType: ContentConstants.ASSIGNED_USER_TYPES.region,
            partnerId: null,
            regionId: id,
            courseType: ContentConstants.COURSES_TYPE.training,
            partnerIdOrRegionId: id
          },
          update: { isDefaultCourse: true },
          options: { upsert: true, new: true }
        });
      }

      await updateOne({
        collection: "Region",
        query: { _id: partner?._id },
        update: { $set: req.body },
      });

      let audit;
      if (partner?.logo != req.body.logo) {
        audit = User_Activity.REGION_LOGO_UPDATED;
      } else {
        audit = User_Activity.REGION_DATA_UPDATED;
      }

      res.send(success(successMessage.UPDATE_SUCCESS.replace(":attribute", "Region"), { isAuditLog: true, audit }, statusCode.OK));
    } catch (err: any) {
      logger.error("regionController > partnerEdit ", err);
      res.status(statusCode.FORBIDDEN).send(error("There is some issue to get region list.", err.message, statusCode.FORBIDDEN));
    }
  },
  addNewSchoolOrInstitute: async function (req: any, res: any) {
    try {
      let { id, SchoolOrInstitute } = req.body;
      let user = await findOne({
        collection: "Region",
        query: {
          _id: id,
        },
      });
      if (!user) {
        return res
          .status(statusCode.NOT_FOUND)
          .send(error(errorMessage.NOT_EXISTS.replace(":attribute", "Region"), {}, statusCode.NOT_FOUND));
      }
      //Sentize School Name
      if (user.assignedSchoolOrInstitute.length) {
        SchoolOrInstitute = SchoolOrInstitute.filter((ele: any) => !user.assignedSchoolOrInstitute.includes(ele));
        if (!SchoolOrInstitute.length)
          return res
            .status(statusCode.BAD_REQUEST)
            .send(error(errorMessage.ALREADY_EXISTS.replace(":attribute", "SchoolOrInstitute"), {}, statusCode.BAD_REQUEST));
      }

      await updateOne({
        collection: "Region",
        query: { _id: id },
        update: { $push: { assignedSchoolOrInstitute: { $each: SchoolOrInstitute } } },
      });
      res.send(success("School/Institute has been successfully assigned.", { isAuditLog: true, audit: User_Activity.ADD_NEW_SCHOOL }, statusCode.OK));
    } catch (err: any) {
      logger.error("regionController > addNewSchoolOrInstitute ", err);
      res
        .status(statusCode.FORBIDDEN)
        .send(error("There is some issue to Create addNewSchoolOrInstitute APi.", err.message, statusCode.FORBIDDEN));
    }
  },
  removeNewSchoolOrInstitute: async function (req: any, res: any) {
    try {
      let { id, SchoolOrInstitute } = req.body;
      let user = await findOne({
        collection: "Region",
        query: {
          _id: id,
        },
      });
      if (!user) {
        return res
          .status(statusCode.NOT_FOUND)
          .send(error(errorMessage.NOT_EXISTS.replace(":attribute", "Region"), {}, statusCode.NOT_FOUND));
      }

      let data = await updateOne({
        collection: "Region",
        query: { _id: id },
        update: { $pull: { assignedSchoolOrInstitute: { $in: SchoolOrInstitute } } },
      });
      res.send(success("School/Institute has been successfully unassigned", { isAuditLog: true, audit: User_Activity.REMOVE_NEW_SCHOOL }, statusCode.OK));
    } catch (err: any) {
      logger.error("regionController > removeNewSchoolOrInstitute ", err);
      res
        .status(statusCode.FORBIDDEN)
        .send(error("There is some issue to Create addNewSchoolOrInstitute APi.", err.message, statusCode.FORBIDDEN));
    }
  },
  filterOptions: async function (req: any, res: any) {
    try {
      let pipeline = [
        { $match: { isDel: false } },
        {
          $group: {
            _id: null,
            city: { $push: "$city" },
            assignedSchoolOrInstitute: { $push: "$assignedSchoolOrInstitute" },
            region: { $push: "$region" },
          },
        },
        {
          $project: {
            _id: 0,
            city: {
              $filter: {
                input: "$city",
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
            regionName: {
              $setUnion: ["$region", []],
            },
            assignedSchoolOrInstitute: {
              $setUnion: ["$assignedSchoolOrInstitute", []],
            },
            city: {
              $setUnion: ["$city", []],
            },
          },
        },
      ];
      let useData = await aggregate({
        collection: "Region",
        pipeline,
      });

      (useData[0]?.regionName || []).sort((a: any, b: any) => { return a.localeCompare(b) });

      (useData[0]?.assignedSchoolOrInstitute || []).sort((a: any, b: any) => { return a.localeCompare(b) });

      (useData[0]?.city || []).sort((a: any, b: any) => { return a.localeCompare(b) });

      res.send(success(successMessage.FETCH_SUCCESS.replace(":attribute", "filterOptions"), useData[0], statusCode.OK));
    } catch (err: any) {
      logger.error("regionController > filterOptions ", err);
      res
        .status(statusCode.FORBIDDEN)
        .send(error("There is some issue to get filterOptions list.", err.message, statusCode.FORBIDDEN));
    }
  },
  ListDelete: async function (req: any, res: any) {
    try {
      let { id } = req.body;
      //id Is array of _ids
      let partnerFind = await find({
        collection: "Region",
        query: { _id: { $in: id } },
      });
      if (!partnerFind) {
        return res
          .status(statusCode.NOT_FOUND)
          .send(error(errorMessage.NOT_EXISTS.replace(":attribute", "Partner"), {}, statusCode.NOT_FOUND));
      }
      await updateMany({
        collection: "Region",
        query: {
          _id: id,
        },
        update: {
          isDel: true,
        },
      });

      res.send(success("Region has been successfully removed", {}, statusCode.OK));
    } catch (err: any) {
      logger.error("controlController > ListDelete ", err);
      res
        .status(statusCode.FORBIDDEN)
        .send(error("There is some issue to delete ListDelete .", err.message, statusCode.FORBIDDEN));
    }
  },
  schoolFileUpload: async function (req: any, res: any) {
    try {
      let filePath = __dirname + "/../../" + req.file.path;
      let skippedUser: Array<any> = [], message: string = "";
      let data: any = await csvtojson({
        // delimiter: ",",
        // ignoreEmpty: false,
      }).fromFile(filePath);
      await fs.unlink(filePath);
      let schoolArray: any = [];

      for (let i = 0; i < data.length; i++) {
        let rows = data[i];

        const schoolName = Object.values(rows);

        const isExists = await findOne({ collection: 'AppSetting', query: { key: "SchoolOrInstitute", value: schoolName[0] } })

        schoolArray.push(schoolName[0]);
        schoolArray = _.uniq(schoolArray)
        if (!isExists) {
          await findOneAndUpdate({ collection: "AppSetting", query: { key: 'SchoolOrInstitute' }, update: { $push: { value: schoolName[0] } } })
        } else {
          message = "School or Institute Already Exists.";
        }

        if (message) {
          rows.message = message;
          rows.row = i + 2
          skippedUser.push(rows)
        }

      }
      res.send(success("CSV uploaded successfully.", { schoolArray, skippedUser }, statusCode.OK));
    } catch (err: any) {
      logger.error("controlController > schoolFileUpload ", err);
      res
        .status(statusCode.FORBIDDEN)
        .send(error("There is some issue to delete schoolFileUpload .", err.message, statusCode.FORBIDDEN));
    }
  },

  // bulkRegionCreate: async function (req: any, res: any) {
  //   try {
  //     let filePath = __dirname + "/../../" + req.file.path;
  //     let data: any = await csv({
  //       delimiter: ",",
  //       ignoreEmpty: true,
  //     }).fromFile(filePath);
  //     fs.unlink(filePath)
  //     let map = new Map();
  //     for (let idx = 1; idx < data.length; idx -= -1) {
  //       let oldData = map.get(data[idx].region);
  //       let setData = { ...data[idx], assignedSchoolOrInstitute: {} };
  //       if (oldData) setData = { ...oldData, assignedSchoolOrInstitute: { ...oldData["assignedSchoolOrInstitute"] } };
  //       setData.assignedSchoolOrInstitute[data[idx].assignedSchoolOrInstitute] = idx;
  //       map.set(data[idx].region, setData);
  //     }
  //     let region = [...map.keys()];
  //     data = [];
  //     for (let [key, value] of map) {
  //       data.push({ ...value, assignedSchoolOrInstitute: Object.keys(value["assignedSchoolOrInstitute"]) });
  //     }

  //     let partner = await find({
  //       collection: "Region",
  //       query: { region: { $in: region }, isDel: false },
  //     });
  //     region = partner.map((ele: any) => ele.region);
  //     data = data.filter((ele: any) => !region.includes(ele.region));
  //     await insertMany({
  //       collection: "Region",
  //       documents: data,
  //     });
  //     res.send(success("Partner/Region has been successfully created!", "createData", statusCode.OK));
  //   } catch (err: any) {
  //     logger.error("partnerController > createPartner ", err);
  //     res
  //       .status(statusCode.FORBIDDEN)
  //       .send(error("There is some issue to Create Partner list.", err.message, statusCode.FORBIDDEN));
  //   }
  // },


  bulkRegionCreate: async (req: Request, res: Response) => {
    try {
      const file: any = req.file;
      let filePath = __dirname + "/../../" + file.path;
      let skippedUser: Array<any> = [], message: string = "";
      const request = req as requestUser;
      const createdBy = request.user._id
      csvtojson()
        .fromFile(filePath)
        .then(async (data: Array<any>) => {
          const totalData = data.length;
          const auditIds: any = [];

          for (let i = 0; i < data.length; i++) {
            let rows = data[i];

            for (var key in rows) {
              // if (rows.region && rows.assignedSchoolOrInstitute && rows.city && rows.contactEmail) {
              if (!rows[key]) {
                key = capitalizeFirstLetter(key);
                message = `${key} is required.`
                break
              }
              /*  } else {
                 message = "Region is required."
               } */
            }

            if (rows['contactEmail']) {
              let regexPattern = /\S+@\S+\.\S+/
              let isEmailValid = regexPattern.test(rows['contactEmail'])
              if (!isEmailValid) {
                message = `Invalid Email.`
              }
            }

            if (!message) {
              const isEmailExist: any = await isEmailAlreadyExists(rows.contactEmail)

              const isRegion = await findOne({ collection: 'Region', query: { region: rows.region, contactEmail: rows.contactEmail } });

              const isEmailExists = await findOne({ collection: 'Region', query: { region: rows.region, contactEmail: { $ne: rows.contactEmail } } })

              const isRegionEmailExists = await findOne({ collection: 'Region', query: { region: { $ne: rows.region }, contactEmail: rows.contactEmail, isDel: false } })

              let obj: any = {};
              if (isEmailExist && !isRegion && !isEmailExists && !isRegionEmailExists) {
                obj = {
                  region: rows.region ? rows.region : "",
                  city: rows.city ? rows.city : "",
                  contactEmail: rows.contactEmail,
                  assignedSchoolOrInstitute: rows.assignedSchoolOrInstitute ? rows.assignedSchoolOrInstitute : "",
                  createdBy: createdBy,
                  regionImported: true
                }
                let addRegion = await insertOne({ collection: 'Region', document: obj })
                auditIds.push(addRegion._id);

                let questionListArray: Array<any> = questionList

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
                    orderNum: i,
                    regionId: addRegion._id,
                    createdBy: request.user._id
                  }
                  await insertOne({
                    collection: "Matches",
                    document: obj,
                  });
                }
              } else {
                obj = {};
                message = "Region name or email already Exists.";
              }
            }
            if (message) {
              rows.message = message;
              rows.row = i + 2
              skippedUser.push(rows)
            }

          }
          let uplaodedUser = data.length - skippedUser.length
          let skippedUserCount = skippedUser.length

          let csvUrl: any;

          if (skippedUser && skippedUser.length > 0) {
            csvUrl = await exportFileFunction(true, 'skipRegionCsv', skippedUser, res, req);
          }

          csvUrl = (csvUrl && csvUrl.filePath) ? csvUrl.filePath : "";
          res.status(statusCode.OK).send(success(successMessage.UPLOAD_SUCCESS.replace(':attribute', "CSV file"), {
            skippedUser, skippedUserCount, uplaodedUser, csvUrl, totalData, auditIds, isCsv: true, isAuditLog: true, audit: User_Activity.CREATE_BULK_REGION
          }))
        })
    } catch (err: any) {
      res.status(statusCode.FORBIDDEN).send(error("There is some issue while importing user from CSV.", err.message, statusCode.FORBIDDEN))
    }
  },

};
