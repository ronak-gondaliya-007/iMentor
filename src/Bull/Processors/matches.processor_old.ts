import { Calucalte } from "../../services/matching_old.service";
import { userStatusConstant } from "../../utils/const";
import { ObjectId, find, findOne, insertMany, updateOne } from "../../utils/db";

export let processer = async function ({ data }: any) {
  let objCollection = data.menteeId ? "AnswerByMentee" : "AnswerByMentors"; // Mentee 1 - AnswerByMentee
  let arrCollection = data.mentorId ? "AnswerByMentee" : "AnswerByMentors"; // Mentors - AnswerByMentors

  // if (data.QuestionUpdated) {
  //   let mentor = await find({
  //     collection: "AnswerByMentors",
  //     query: { isConfirm: false },
  //   });

  //   mentor.forEach(async (ele: any) => {
  //     let mentor = { ...ele };
  //     let arr = await find({
  //       collection: "AnswerByMentee",
  //       query: { isConfirm: false, createdBy: new ObjectId(ele?._id) },
  //     });
  //     for (let ele of arr) {
  //       let CalculationClass = new Calucalte(ele, mentor);
  //       let data = await CalculationClass.Calculate();
  //       await updateOne({
  //         collection: "PairInfo",
  //         query: { mentorId: mentor?._id },
  //         update: { ...data },
  //       });
  //     }
  //   });
  // }

  let id = data.menteeId ?? data.mentorId;

  // Mentee Answer
  let obj: any = await findOne({
    collection: objCollection,
    query: { createdBy: new ObjectId(id),status:userStatusConstant.Matching },
    populate: [{ path: "queAns.question" }, { path: "user" }],
  });
  if (obj?.queAns?.length == 0) throw Error(`${arrCollection} Answer Is Not Found`);
  if (!obj) {
    return { Opration: `${objCollection} Is Empty Or Data Is Not Found` };
  }

  
  // Fetch Partner Data
  let PnR = await findOne({
    collection: "User",
    query: { $or: [{ partnerAdmin: new Object(id) }, { region: new Object(id) }] },
    populate: [{ path: "partnerAdmin" }, { path: "region" }],
  });
  
  let query: any = { createdBy: new ObjectId(id),status:userStatusConstant.Matching };
  // if (arrCollection == "AnswerByMentee") query = { createdBy: new ObjectId(id), isConfirm: false };
  let arr: any = await find({
    collection: arrCollection,
    query,
    populate: [{ path: "queAns.question" }],
  });
  if (!arr.length) throw Error(`${arrCollection} Is Empty Or Data Is Not Found`);
  let insertData = [];
  for (let ele of arr) {
    let mentee = objCollection == "AnswerByMentee" ? obj : ele;
    let mentor = arrCollection == "AnswerByMentee" ? obj : ele;
    if (ele.queAns.length == 0) continue;
    let CalculationClass = new Calucalte(mentee, mentor);
    let data = await CalculationClass.Calculate();
    
    console.log("==============Data==========");
    console.log(data);


    // insertData.push({
    //   ...data,
    //   location: PnR?.partnerAdmin?.region ?? PnR?.region?.city,
    //   school: PnR?.partnerAdmin?.assignedSchoolOrInstitute ?? PnR?.region?.assignedSchoolOrInstitute,
    //   partner: PnR?.partnerAdmin?.partnerName ?? PnR?.region?.region,
    //   partnerId: PnR?.partnerAdmin?._id ?? null,
    //   regionId: PnR?.region?._id ?? null,
    //   partnerIdOrRegionId: PnR?.partnerAdmin?._id ?? PnR?.region?._id,
    // });
  }

  // await insertMany({ collection: "PairInfo", documents: insertData });
  
  
  
  
  return { Opration: "Mentor Mentees Matches Created" };
};

export let onCompleted = async function (job: any, result: any) {
  console.log("Job completed with result:", result);
};
export let onFailed = async function (job: any, err: any) {
  console.log("Job failed with error:", err);
};
