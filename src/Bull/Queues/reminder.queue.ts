import Bull, { Queue } from "bull";
import { failed, queueProcess } from "../Processors/reminder.processor";
import config from "../../utils/config";

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
console.log('Reminder Queue', JSON.stringify(redisConfig))
const Reminder: Queue = new Bull("Reminder", { redis: redisConfig, prefix: "iMentor" });

Reminder.process(queueProcess);

Reminder.on('error', (error) => {
    console.log('Reminder Queue error', error);
})

Reminder.on("failed", failed);

export { Reminder };
