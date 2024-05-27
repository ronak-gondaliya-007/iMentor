import Bull, { Queue } from "bull";
import { singleProcesser } from "../Processors/matches.processor";

var redisConfig: any;
var dbNo = process.env.REDIS_DB_NO ?? 14;
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

console.log('Single Matches Queue', JSON.stringify(redisConfig))
const SingleMatches: Queue = new Bull("SingleMatches", { redis: redisConfig, prefix: "iMentor" });


const addToSingleMatches = async (data: any) => {
  try {
    console.log("Add To Single Matches Queue=======================>", data);
    const options: Bull.JobOptions = {
      jobId: data.jobId,
      delay: 0,
      removeOnComplete: true
    };
    await SingleMatches.add(data, options);
    return true;
  } catch (error) {
    console.log("error ::: ", error);
  }
};

SingleMatches.process(singleProcesser);

SingleMatches.on('error', (error) => {
  console.log('SingleMatches Queue error', error);
})

SingleMatches.on('waiting', function (jobId) {
  console.log(`Job ${jobId} is waiting`);
});

SingleMatches.on('active', function (job) {
  console.log(`Job ${job.id} is now active`);
});

SingleMatches.on('progress', function (job, progress) {
  console.log(`Job ${job.id} is ${progress}% complete`);
});

SingleMatches.on('completed', async function (job, result) {
  let jobs = await SingleMatches.getJobs(['waiting', 'active']);
  console.log(`Job ${job.id} is completed`, result + " " + jobs.length);
});
SingleMatches.on('failed', function (job, err) {
  console.log(`Job ${job.id} is failed`, err);
});

export { SingleMatches, addToSingleMatches };
