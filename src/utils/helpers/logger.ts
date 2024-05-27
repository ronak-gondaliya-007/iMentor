import * as winston from "winston";
import DailyRotateFile from "winston-daily-rotate-file";

const logFormat = winston.format.combine(
  winston.format.errors({ stack: true }),
  winston.format.timestamp(),
  winston.format.printf((info) => {
    return `${info.timestamp} [${info.level}] : ${typeof info.message === "object" ? JSON.stringify(info.message) : info.message
      }`;
  })
);
const transport = new DailyRotateFile({
  filename: "./logs/%DATE%.log",
  datePattern: "YYYY-MM-DD",
  zippedArchive: true,
  maxFiles: "7d",
  level: "debug",
});

let logger = winston.createLogger({
  format: logFormat,
  transports: [
    transport,
    new winston.transports.Console({
      level: "info",
    }),
  ],
  exceptionHandlers: [new winston.transports.Console({ level: "error" }), new winston.transports.File({ filename: "./logs/uncaughtExceptions.log" })],
});

export { logger };
