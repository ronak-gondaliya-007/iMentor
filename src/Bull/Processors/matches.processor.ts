import { Calculate } from "../../services/matching.service";
import { questionState, userStatusConstant } from "../../utils/const";
import { ObjectId, countDocuments, distinct, find, findOne, findOneAndUpdate, insertMany, updateMany, updateOne } from "../../utils/db";

export let processer = async function ({ data }: any, done: any) {
  try {
    console.log("=============> data <=============", data);

    const addOnDate = data.addOnDate;
    let objCollection = data.menteeId ? "AnswerByMentee" : "AnswerByMentors";
    let arrCollection = data.mentorId ? "AnswerByMentee" : "AnswerByMentors";
    let id = data.menteeId ?? data.mentorId;
    console.log("User ID ==================>", id);

    let userObj = await findOne({ collection: "User", query: { _id: id, isDel: false } });
    console.log("userObj===========>", JSON.stringify(userObj));

    if (!userObj) {
      done(null, `User doesn't exists`);
      return { Operation: `User doesn't exists` };
    }

    // Source User Answers
    let matchSourceUser: any = await findOne({
      collection: objCollection,
      query: { user: id, status: userStatusConstant.ACTIVE },
      populate: [{ path: "queAns.question" }, { path: "user" }],
    });

    if (!matchSourceUser) {
      done(null, `Match source user doesn't exists`);
      return { Operation: `Match source user doesn't exists` };
    }
    if (matchSourceUser.user.status !== userStatusConstant.Matching && matchSourceUser.user.status !== userStatusConstant.Matched && matchSourceUser.user.status !== userStatusConstant.MATCHED_NOT_REGISTERED) {
      done(null, `Source User is not able to perform matching`);
      return { Operation: `Source User is not able to perform matching` };
    }
    if (!matchSourceUser.queAns || matchSourceUser?.queAns?.length == 0) {
      done(null, `Step 3 is not completed by user`);
      throw Error(`Step 3 is not completed by user`)
    };
    matchSourceUser.queAns = matchSourceUser?.queAns.filter((ele: any) => ele && ele.question && ele.answer.length > 0 && !ele.question.isDel && ele.question.status === questionState.ACTIVE)

    // Destination User Answers
    let arrQuery: any = { createdBy: new ObjectId(matchSourceUser.createdBy), status: userStatusConstant.ACTIVE };

    let arr: any = await find({ collection: arrCollection, query: arrQuery, populate: [{ path: "queAns.question" }, { path: "user" }] });

    // if (!arr.length) throw Error(`No ${data.menteeId ? "Mentors" : "Mentees"} Found...`);
    if (!arr.length) {
      done(null, `No ${data.menteeId ? "Mentors" : "Mentees"} Found...`);
      throw Error(`No ${data.menteeId ? "Mentors" : "Mentees"} Found...`);
    }

    for (let index = 0; index < arr.length; index++) {
      arr[index].queAns = arr[index].queAns.filter((ele: any) => ele && ele.question && ele.answer.length > 0 && !ele.question.isDel && ele.question.status === questionState.ACTIVE)
    }

    // Fetch Partner Data
    let PartnerData = await findOne({
      collection: "User",
      query: { $or: [{ partnerAdmin: new ObjectId(matchSourceUser.user.partnerAdmin) }, { region: new ObjectId(matchSourceUser.user.region) }] },
      populate: [{ path: "partnerAdmin" }, { path: "region" }],
    });

    for (let index = 0; index < arr.length; index++) {
      const ele = arr[index];
      if (!ele.user) {
        continue;
      }
      if (ele.user.status !== userStatusConstant.Matching && ele.user.status !== userStatusConstant.Matched && ele.user.status !== userStatusConstant.MATCHED_NOT_REGISTERED) {
        continue;
      }

      let mentee = objCollection == "AnswerByMentee" ? matchSourceUser : ele;
      let mentor = arrCollection == "AnswerByMentee" ? matchSourceUser : ele;

      for (let index = 0; index < ele?.queAns?.length; index++) {
        const element = ele?.queAns[index];
        element.question.option.forEach((option: any) => {
          if (option.answer === true || option.matchAns === true) {
            delete option.answer;
            delete option.matchAns;
          }
        });
      }
      for (let index = 0; index < mentee?.queAns?.length; index++) {
        const element = mentee?.queAns[index];
        element.question.option.forEach((option: any) => {
          if (option.answer === true || option.matchAns === true) {
            delete option.answer;
            delete option.matchAns;
          }
        });
      }

      if (ele.queAns.length == 0) continue;
      let CalculationClass = new Calculate(mentee, mentor);
      let data = await CalculationClass.generateScore();

      let isExists = await countDocuments({ collection: "PairInfo", query: { "menteeId": mentee.user._id, mentorId: mentor.user._id } })

      await findOneAndUpdate({
        collection: "PairInfo",
        query: { "menteeId": mentee.user._id, mentorId: mentor.user._id },
        update: {
          ...data,
          isUpdated: isExists ? true : false,
          isConfirm: false,
          location: PartnerData?.partnerAdmin?.region ?? PartnerData?.region?.city,
          school: PartnerData?.partnerAdmin?.assignedSchoolOrInstitute ?? PartnerData?.region?.assignedSchoolOrInstitute,
          partner: PartnerData?.partnerAdmin?.partnerName ?? PartnerData?.region?.region,
          partnerId: PartnerData?.partnerAdmin?._id ?? null,
          regionId: PartnerData?.region?._id ?? null,
          partnerIdOrRegionId: PartnerData?.partnerAdmin?._id ?? PartnerData?.region?._id,
          addOnDate: addOnDate ?? null
        },
        options: {
          upsert: true,
          new: true
        }
      })
    }

    done(null, "Mentor Mentees Matches Created");
    return { Operation: "Mentor Mentees Matches Created" };
  } catch (err: any) {
    console.log("done error");
    done();
  }
};

export let pairProcessor = async function ({ data }: any, done: any) {
  try {
    console.log("=============> data <=============", data);
    // done();

    const addOnDate = data.addOnDate;
    let objCollection = data.menteeId ? "AnswerByMentee" : "AnswerByMentors";
    let arrCollection = data.mentorId ? "AnswerByMentee" : "AnswerByMentors";
    let id = data.menteeId ?? data.mentorId;

    let userObj: any = await findOne({ collection: 'User', query: { _id: new ObjectId(id), isDel: false } });

    if (!userObj) {
      done(null, `User doesn't exists`);
      return { Operation: `User doesn't exists` };
    }
    let isCsvPair = data.isCsvPair ?? "";
    let pairUser = data.pairUser ?? "";

    // Source User Answers
    let matchSourceUser: any = await findOne({
      collection: objCollection,
      query: { user: new ObjectId(id), status: userStatusConstant.ACTIVE },
      populate: [{ path: "queAns.question" }, { path: "user" }],
    });

    if (!matchSourceUser) {
      done(null, `User doesn't exists`);
      return { Operation: `User doesn't exists` };
    }
    if (matchSourceUser.user.status !== userStatusConstant.Matching && matchSourceUser.user.status !== userStatusConstant.Matched && matchSourceUser.user.status !== userStatusConstant.MATCHED_NOT_REGISTERED) {
      done(null, `Source User is not able to perform matching`);
      return { Operation: `Source User is not able to perform matching` };
    }
    if (!matchSourceUser.queAns || matchSourceUser?.queAns?.length == 0) {
      done(null, `Step 3 is not completed by user`);
      throw Error(`Step 3 is not completed by user`)
    };
    matchSourceUser.queAns = matchSourceUser?.queAns.filter((ele: any) => ele && ele.question && ele.answer.length > 0 && !ele.question.isDel && ele.question.status === questionState.ACTIVE)

    // Destination User Answers
    let arrQuery: any = {};
    // if (isCsvPair === true && isCsvPair !== "") {
    //   arrQuery = { user: new ObjectId(data.pairUser), status: userStatusConstant.ACTIVE };
    // } else {
    arrQuery = { createdBy: new ObjectId(matchSourceUser.createdBy), status: userStatusConstant.ACTIVE };
    // }

    let arr: any = await find({ collection: arrCollection, query: arrQuery, populate: [{ path: "queAns.question" }, { path: "user" }] });

    // if (!arr.length) throw Error(`No ${data.menteeId ? "Mentors" : "Mentees"} Found...`);
    if (!arr.length) {
      done(null, `No ${data.menteeId ? "Mentors" : "Mentees"} Found...`);
      throw Error(`No ${data.menteeId ? "Mentors" : "Mentees"} Found...`);
    }

    for (let index = 0; index < arr.length; index++) {
      arr[index].queAns = arr[index].queAns.filter((ele: any) => ele && ele.question && ele.answer.length > 0 && !ele.question.isDel && ele.question.status === questionState.ACTIVE)
    }

    // Fetch Partner Data
    let PartnerData = await findOne({
      collection: "User",
      query: { $or: [{ partnerAdmin: new ObjectId(matchSourceUser.user.partnerAdmin) }, { region: new ObjectId(matchSourceUser.user.region) }] },
      populate: [{ path: "partnerAdmin" }, { path: "region" }],
    });

    console.log("arr==================>", arr.length);
    for (let index = 0; index < arr.length; index++) {
      const ele = arr[index];
      if (!ele.user) {
        continue;
      }
      if (ele.user.status !== userStatusConstant.Matching && ele.user.status !== userStatusConstant.Matched && ele.user.status !== userStatusConstant.MATCHED_NOT_REGISTERED) {
        continue;
      }

      let mentee = objCollection == "AnswerByMentee" ? matchSourceUser : ele;
      let mentor = arrCollection == "AnswerByMentee" ? matchSourceUser : ele;

      for (let index = 0; index < ele?.queAns?.length; index++) {
        const element = ele?.queAns[index];
        element.question.option.forEach((option: any) => {
          if (option.answer === true || option.matchAns === true) {
            delete option.answer;
            delete option.matchAns;
          }
        });
      }
      for (let index = 0; index < mentee?.queAns?.length; index++) {
        const element = mentee?.queAns[index];
        element.question.option.forEach((option: any) => {
          if (option.answer === true || option.matchAns === true) {
            delete option.answer;
            delete option.matchAns;
          }
        });
      }

      if (ele.queAns.length == 0) continue;
      let CalculationClass = new Calculate(mentee, mentor);
      let dataUserDetail = await CalculationClass.generateScore();

      let isExists = await countDocuments({ collection: "PairInfo", query: { "menteeId": mentee.user._id, mentorId: mentor.user._id } });

      console.log("data", data);
      console.log("condition", mentee.user._id?.toString() == pairUser && mentor.user._id?.toString() == data.mentorId || mentee.user._id?.toString() == pairUser && mentee.user._id?.toString() == data.menteeId);

      await findOneAndUpdate({
        collection: "PairInfo",
        query: { "menteeId": mentee.user._id, mentorId: mentor.user._id },
        update: {
          ...dataUserDetail,
          isUpdated: isExists ? true : false,
          isConfirm: false,
          location: PartnerData?.partnerAdmin?.region ?? PartnerData?.region?.city,
          school: PartnerData?.partnerAdmin?.assignedSchoolOrInstitute ?? PartnerData?.region?.assignedSchoolOrInstitute,
          partner: PartnerData?.partnerAdmin?.partnerName ?? PartnerData?.region?.region,
          partnerId: PartnerData?.partnerAdmin?._id ?? null,
          regionId: PartnerData?.region?._id ?? null,
          partnerIdOrRegionId: PartnerData?.partnerAdmin?._id ?? PartnerData?.region?._id,
          addOnDate: addOnDate ?? null
        },
        options: {
          upsert: true,
          new: true
        }
      })

      if (isCsvPair) {
        const verifyMentor = await distinct({
          collection: 'User',
          field: "_id",
          query: { _id: { $in: [mentee.user._id, mentor.user._id] }, status: { $in: [userStatusConstant.Matching] } }
        });

        await updateMany({
          collection: "User",
          query: { _id: { $in: verifyMentor } },
          update: { $set: { status: userStatusConstant.MATCHED_NOT_REGISTERED } },
          options: { new: true }
        });

        // if (mentee.user._id?.toString() == pairUser && mentor.user._id?.toString() == data.mentorId || mentee.user._id?.toString() == pairUser && mentee.user._id?.toString() == data.menteeId) {
        //   console.log("==========================>Create CSV Pair=======================>", mentee.user._id?.toString() == pairUser && mentor.user._id?.toString() == data.mentorId || mentee.user._id?.toString() == pairUser && mentee.user._id?.toString() == data.menteeId);
        //   if (isCsvPair) {
        //     await updateMany({
        //       collection: "User",
        //       query: { _id: { $in: [mentee.user._id, mentor.user._id] } },
        //       update: { $set: { status: userStatusConstant.MATCHED_NOT_REGISTERED } },
        //       options: { new: true }
        //     });
        //     const updatePairInfo = await findOneAndUpdate({
        //       collection: "PairInfo",
        //       query: { menteeId: mentee.user._id, mentorId: mentor.user._id },
        //       update: { $set: { isConfirm: true } },
        //       options: { new: true }
        //     });
        //     console.log("============> updatePairInfo ==============>", updatePairInfo);
        //   }
      }
    }

    done(null, "Mentor Mentees Matches Created");
    return { Operation: "Mentor Mentees Matches Created" };
  } catch (err: any) {
    done(err);
  }
};

export let singleProcesser = async function ({ data }: any, done: any) {
  try {
    console.log("=============> data <=============", data);
    console.log("=============> Start Time <=============", new Date());

    const addOnDate = data.addOnDate;
    let objCollection = data.menteeId ? "AnswerByMentee" : "AnswerByMentors";
    let arrCollection = data.mentorId ? "AnswerByMentee" : "AnswerByMentors";
    let id = data.menteeId ?? data.mentorId;
    let count = 0;
    console.log("Count ==================>", count);
    console.log("User ID ==================>", id);

    let userObj = await findOne({ collection: "User", query: { _id: id } });
    console.log("userObj===========>", JSON.stringify(userObj));

    if (!userObj) {
      console.log("users ::: ", userObj);
      done(null, `User doesn't exists`);
      return { Operation: `User doesn't exists` };
    }

    // Source User Answers
    let matchSourceUser: any = await findOne({
      collection: objCollection,
      query: { user: id, status: userStatusConstant.ACTIVE },
      populate: [{ path: "queAns.question" }, { path: "user" }],
    });

    if (!matchSourceUser) {
      done(null, `Match source user doesn't exists`);
      return { Operation: `Match source user doesn't exists` };
    }
    if (matchSourceUser.user.status !== userStatusConstant.Matching && matchSourceUser.user.status !== userStatusConstant.Matched && matchSourceUser.user.status !== userStatusConstant.MATCHED_NOT_REGISTERED) {
      done(null, `Source User is not able to perform matching`);
      return { Operation: `Source User is not able to perform matching` };
    }
    if (!matchSourceUser.queAns || matchSourceUser?.queAns?.length == 0) {
      done(null, `Step 3 is not completed by user`);
      throw Error(`Step 3 is not completed by user`)
    };
    matchSourceUser.queAns = matchSourceUser?.queAns.filter((ele: any) => ele && ele.question && ele.answer.length > 0 && !ele.question.isDel && ele.question.status === questionState.ACTIVE)

    // Destination User Answers
    let arrQuery: any = { user: new ObjectId(data.user), status: userStatusConstant.ACTIVE };

    let arr: any = await find({ collection: arrCollection, query: arrQuery, populate: [{ path: "queAns.question" }, { path: "user" }] });

    // if (!arr.length) throw Error(`No ${data.menteeId ? "Mentors" : "Mentees"} Found...`);
    if (!arr.length) {
      done(null, `No ${data.menteeId ? "Mentors" : "Mentees"} Found...`);
      throw Error(`No ${data.menteeId ? "Mentors" : "Mentees"} Found...`);
    }
    count = arr.length;
    console.log("Array Length===================>", count);

    for (let index = 0; index < arr.length; index++) {
      arr[index].queAns = arr[index].queAns.filter((ele: any) => ele && ele.question && ele.answer.length > 0 && !ele.question.isDel && ele.question.status === questionState.ACTIVE)
    }

    // Fetch Partner Data
    let PartnerData = await findOne({
      collection: "User",
      query: { $or: [{ partnerAdmin: new ObjectId(matchSourceUser.user.partnerAdmin) }, { region: new ObjectId(matchSourceUser.user.region) }] },
      populate: [{ path: "partnerAdmin" }, { path: "region" }],
    });

    for (let index = 0; index < arr.length; index++) {
      count--;
      console.log("Count Data=========================>", count);

      const ele = arr[index];
      if (!ele.user) {
        continue;
      }
      if (ele.user.status !== userStatusConstant.Matching && ele.user.status !== userStatusConstant.Matched && ele.user.status !== userStatusConstant.MATCHED_NOT_REGISTERED) {
        continue;
      }

      let mentee = objCollection == "AnswerByMentee" ? matchSourceUser : ele;
      let mentor = arrCollection == "AnswerByMentee" ? matchSourceUser : ele;

      for (let index = 0; index < ele?.queAns?.length; index++) {
        const element = ele?.queAns[index];
        element.question.option.forEach((option: any) => {
          if (option.answer === true || option.matchAns === true) {
            delete option.answer;
            delete option.matchAns;
          }
        });
      }
      for (let index = 0; index < mentee?.queAns?.length; index++) {
        const element = mentee?.queAns[index];
        element.question.option.forEach((option: any) => {
          if (option.answer === true || option.matchAns === true) {
            delete option.answer;
            delete option.matchAns;
          }
        });
      }

      if (ele.queAns.length == 0) continue;
      let CalculationClass = new Calculate(mentee, mentor);
      let dataUserDetail = await CalculationClass.generateScore();

      let isExists = await countDocuments({ collection: "PairInfo", query: { "menteeId": mentee.user._id, mentorId: mentor.user._id } })

      await findOneAndUpdate({
        collection: "PairInfo",
        query: { "menteeId": mentee.user._id, mentorId: mentor.user._id },
        update: {
          ...dataUserDetail,
          isUpdated: isExists ? true : false,
          isConfirm: false,
          location: PartnerData?.partnerAdmin?.region ?? PartnerData?.region?.city,
          school: PartnerData?.partnerAdmin?.assignedSchoolOrInstitute ?? PartnerData?.region?.assignedSchoolOrInstitute,
          partner: PartnerData?.partnerAdmin?.partnerName ?? PartnerData?.region?.region,
          partnerId: PartnerData?.partnerAdmin?._id ?? null,
          regionId: PartnerData?.region?._id ?? null,
          partnerIdOrRegionId: PartnerData?.partnerAdmin?._id ?? PartnerData?.region?._id,
          addOnDate: addOnDate ?? null
        },
        options: {
          upsert: true,
          new: true
        }
      })
    }

    console.log("=============> End Time <=============", new Date());
    done(null, "Mentor Mentees Matches Created");
    return { Operation: "Mentor Mentees Matches Created" };
  } catch (err: any) {
    done(err);
  }
};