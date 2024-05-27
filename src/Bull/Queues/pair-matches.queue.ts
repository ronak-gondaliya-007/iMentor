import Bull, { Queue } from "bull";
import { pairProcessor } from "../Processors/matches.processor";
import { findOneAndUpdate } from "../../utils/db";

var redisConfig: any;
var dbNo = process.env.REDIS_DB_NO ?? 15;
if (process.env.REDISENV === "prod1") {
  redisConfig = { host: process.env.REDIS_HOST, port: process.env.REDIS_PORT, db: dbNo };
} else {
  redisConfig = {
    port: parseInt(process.env.REDIS_PORT || ""),
    host: process.env.REDIS_HOST,
    password: process.env.REDIS_PASSWORD,
    db: dbNo,
  }
}

console.log('Pair Matches Queue', JSON.stringify(redisConfig))
const PairMatches: Queue = new Bull("PairMatches", { redis: redisConfig, prefix: "iMentor" });

const addToPairMatches = async (data: any) => {
  try {
    console.log("Add To Pair Matches Queue=======================>", data);
    const options: Bull.JobOptions = {
      jobId: data.jobId,
      delay: 0,
      removeOnComplete: true
    };
    await PairMatches.add(data, options);
    return true;
  } catch (error) {
    console.log("error ::: ", error);
  }
};

PairMatches.process(pairProcessor);

PairMatches.on('error', (error) => {
  console.log('Matches Queue error', error);
})

PairMatches.on('waiting', function (jobId) {
  console.log(`Job ${jobId} is waiting`);
});

PairMatches.on('completed', async function (job, result) {
  let query: any = {};
  if (job.data.mentorId) {
    query = { mentorId: job.data.mentorId, menteeId: job.data.pairUser };
  } else {
    query = { menteeId: job.data.menteeId, mentorId: job.data.pairUser };
  }
  const updatePair = await findOneAndUpdate({
    collection: 'PairInfo',
    query,
    update: { $set: { isConfirm: true } },
    options: { new: true }
  });
  console.log(`Job ${job.id} is completed`, result);
});
PairMatches.on('failed', function (job, err) {
  console.log(`Job ${job.id} is failed`, err);
});

export { PairMatches, addToPairMatches };
