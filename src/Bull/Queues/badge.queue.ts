// import Bull, { Queue } from "bull";
// import { failed, queueProcess } from "../Processors/badge.processor";
// import config from "../../utils/config";

// var redisConfig: any;
// var dbNo = process.env.REDIS_DB_NO ?? 14;
// if (process.env.REDISENV === "prod1") {
//     redisConfig = { host: process.env.REDIS_HOST, port: process.env.REDIS_PORT, db: dbNo };
// } else {
//     redisConfig = {
//         port: parseInt(process.env.REDIS_PORT || ""),
//         host: process.env.REDIS_HOST,
//         password: process.env.REDIS_PASSWORD,
//         db: dbNo,
//     };
//     // redisConfig = {
//     //     socket: { port: process.env.REDIS_PORT, host: process.env.REDIS_HOST },
//     //     password: process.env.REDIS_PASSWORD
//     // }
// }

// console.log('Badge Queue', JSON.stringify(redisConfig))
// const Badge: Queue = new Bull("Badge", { redis: redisConfig, prefix: "iMentor" });

// Badge.on('error', (error) => {
//     console.log('Badge Queue error', error);
// })

// Badge.process(queueProcess);

// Badge.on("failed", failed);

// export { Badge };
