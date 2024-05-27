import dotenv from "dotenv";
import { STATES } from "mongoose";

dotenv.config();

export default {
  Mongodb: {
    url: String(process.env.MONGOURI ?? ""),
    dbName: String(process.env.MONGODBNAME ?? ""),
  },
  server: {
    env: String(process.env.ENV ?? ""),
    port: Number(process.env.PORT ?? ""),
  },
  SSL: {
    key: String(process.env.SSLKEY ?? ""),
    cert: String(process.env.SSLCERT ?? ""),
  },
  PRIVATE_KEY: String(process.env.PRIVATE_KEY ?? ""),
  CRYPTO_PRIVATE_KEY: String(process.env.CRYPTO_PRIVATE_KEY ?? ""),
  S3_BUCKET: {
    S3_BUCKET_NAME: process.env.S3_BUCKET_NAME ?? "",
    S3_ACCESS_KEY: process.env.S3_ACCESS_KEY ?? "",
    S3_SECRET_KEY: process.env.S3_SECRET_KEY ?? "",
    S3_REGION: process.env.S3_REGION ?? "",
  },
  REDIS: {
    REDIS_PORT: Number(process.env.REDIS_PORT ?? 6379),
    REDIS_HOST: process.env.REDIS_HOST ?? "",
    REDIS_PASSWORD: process.env.REDIS_PASSWORD ?? "",
    REDIS_DB: Number(process.env.REDIS_DB ?? 1),
  },
  EMAIL_SERVICE: {
    EMAIL: String(process.env.EMAIL),
    PASSWORD: process.env.PASSWORD
  },
  HOST: process.env.HOST,
  WEB: {
    HOST: process.env.WEB_HOST,
  },
  FRONT_URL: process.env.FRONT_URL,
  SENDGRID_API_KEY: String(process.env.SENDGRID_API_KEY),
  FROM_EMAIL: String(process.env.FROM_EMAIL),
  THINKIFIC: {
    KEY: String(process.env.THINKIFIC_API_KEY ?? ""),
    SUBDOMAIN: String(process.env.THINKIFIC_API_SUBDOMAIN ?? ""),
    API_BASE_URL: String(process.env.THINKIFIC_API_BASE_URL ?? ""),
    ASSET_ACCESS_URL: String(process.env.THINKIFIC_ASSET_ACCESS_URL ?? ""),
    COURSE_URL: String(process.env.THINKIFIC_COURSE_URL ?? ""),
    BASE_URL: String(process.env.THINKIFIC_BASE_URL ?? ""),
    SSO_ERROR: String(process.env.THINKIFIC_SSO_ERROR ?? ""),
    CMS_SSO_ERROR: String(process.env.THINKIFIC_CMS_SSO_ERROR ?? ""),
  }
};
