import Bull, { Queue } from "bull";
import { processer as processor, singleProcesser } from "../Processors/matches.processor";

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

console.log('Matches Queue', JSON.stringify(redisConfig))
const Matches: Queue = new Bull("Matches", { redis: redisConfig, prefix: "iMentor" });

const addToMatches = async (data: any) => {
  try {
    console.log("Add To Matches Queue=======================>", data);
    const options: Bull.JobOptions = {
      jobId: data.jobId,
      delay: 0,
      removeOnComplete: true
    };
    await Matches.add(data, options);
    return true;
  } catch (error) {
    console.log("error ::: ", error);
  }
};

Matches.process(processor);

Matches.on('error', (error) => {
  console.log('Matches Queue error', error);
})

Matches.on('waiting', function (jobId) {
  console.log(`Job ${jobId} is waiting`);
});

Matches.on('active', function (job) {
  console.log(`Job ${job.id} is now active`);
});

Matches.on('progress', function (job, progress) {
  console.log(`Job ${job.id} is ${progress}% complete`);
});

Matches.on('completed', async function (job, result) {
  let jobs = await Matches.getJobs(['waiting', 'active']);
  console.log(`Job ${job.id} is completed`, result + " " + jobs.length);
});

Matches.on('failed', function (job, err) {
  console.log(`Job ${job.id} is failed`, err);
});

export { Matches, addToMatches };
