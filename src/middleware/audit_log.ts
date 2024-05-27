import jwt from "jsonwebtoken";
import config from "../utils/config";
import { insertOne } from "../utils/db";
import CryptoJS from "crypto-js";

const SECRET_KEY: any = process.env.CRYPTO_SECRET_KEY;

async function decryption(data: string) {
  var bytes = CryptoJS.AES.decrypt(decodeURIComponent(data), SECRET_KEY);
  var cryptoBytes = bytes.toString(CryptoJS.enc.Utf8);
  var decryptedData = cryptoBytes ? JSON.parse(cryptoBytes) : null;
  return decryptedData;
}

export let auditLog = async function (req: any, data: any) {
  try {

    let auditLog: any = {};
    auditLog.requestStatus = data?.code;

    if (!data?.data?.isCsv) {
      data.data.result = data.data[Object.keys(data.data)[0]];
      delete data.data[Object.keys(data.data)[0]];

      if(data?.data?.result?.eventId){
        auditLog.eventId = data.data?.result?.eventId;
      }
      if(data?.data?.result?.contentId){
        auditLog.contentId = data.data?.result?.contentId;
      }
    }

    if (data?.data?.auditIds && data?.data?.auditIds?.length > 1) {
      auditLog.userIds = data?.data?.auditIds;
    } else {
      auditLog.userId = data?.data?.auditIds ?? data.data?.result?._id;
    }

    let token = req.headers["x-auth-token"];
    let master_token = req.headers["x-auth-mastertoken"];

    auditLog.audit = data.data?.audit;
    auditLog.endPoint = req.headers["origin"] + req.originalUrl;
    auditLog.requestType = req.method;

    token = jwt.verify(token, config.PRIVATE_KEY);
    auditLog.updatedBy = token?._id;

    master_token = jwt.verify(master_token, config.PRIVATE_KEY);
    auditLog.masterUserId = master_token?._id;

    let ipInformation = await decryption(req.headers['ipinformation']);
    auditLog.ipAddress = req.headers['ipaddress'];
    auditLog.ipDetails = ipInformation;

    auditLog.loginType = token?.loginType ?? "Login";

    // Get OS type
    let OsType: string;
    const userAgent = req.headers['user-agent'];
    if (userAgent.indexOf('Win') !== -1) {
      OsType = 'Windows';
    } else if (userAgent.indexOf('Mac') !== -1) {
      OsType = 'MacOS';
    } else if (userAgent.indexOf('Linux') !== -1) {
      OsType = 'Linux';
    } else {
      OsType = 'Other';
    }
    auditLog.osType = OsType;

    // Get device type
    let DeviceType: string;
    const isMobile = /iPhone|iPad|iPod|Android/i.test(req.headers['sec-ch-ua-platform']);
    DeviceType = isMobile ? 'Mobile' : 'Desktop';
    auditLog.deviceType = DeviceType;

    // Get postman request or not
    let PostmanRequest: boolean = false;
    if (req.headers['postman-token']) {
      PostmanRequest = true;
    }
    auditLog.isPostmanRequest = PostmanRequest;

    // Store audit information in the database
    const auditLogsInDB = await insertOne({
      collection: 'UserActivity',
      document: auditLog
    });

    // Return the result of the database insertion or any other relevant information
    return {
      success: true,
      message: 'Audit log stored successfully',
      data: auditLogsInDB
    };

  } catch (err) {
    console.log("Audit log error ===========> ", err);
    return {
      success: false,
      message: 'Error storing audit log',
      error: err
    };
  }
};