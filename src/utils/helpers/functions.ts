import bcrypt from "bcrypt";
import config from "../config";
import jwt from "jsonwebtoken";
import crypto from "crypto-js";
import _ from "lodash";
import { find, findOne, findOneAndUpdate, insertOne, updateMany } from "../db";
import { logger } from "./logger";

export let encrypt = async function (password: string) {
  let salt = await bcrypt.genSalt(10);
  return await bcrypt.hash(password, salt);
};

export let decrypt = async (password: string, encryotedPassword: string) => {
  let decryptPassword = await bcrypt.compare(password, encryotedPassword);
  return decryptPassword;
};

export let generateToken = async (userObj: any) => {
  // const iat = Math.floor(Date.now() / 1000)
  // const exp = iat + 60 * 60 * 24;
  // const exp = iat + 60;
  let token = jwt.sign({
    _id: userObj._id, email: userObj.email, role: userObj.role, first_name: userObj.legalFname, last_name: userObj.legalLname, partnerAdmin: userObj.partnerAdmin, region: userObj.region,
    token: '', loginType: "Login" /* exp: exp */
  }, config.PRIVATE_KEY, { expiresIn: "10d" });
  return token;
};

export let generateTokenLoginAs = async (userObj: any) => {
  // const iat = Math.floor(Date.now() / 1000)
  // const exp = iat + 60 * 60 * 24;
  // const exp = iat + 60;
  let token = jwt.sign({
    _id: userObj._id, email: userObj.email, role: userObj.role, first_name: userObj.legalFname, last_name: userObj.legalLname, partnerAdmin: userObj.partnerAdmin, region: userObj.region,
    token: '', loginType: "LoginAs", /* exp: exp */
  }, config.PRIVATE_KEY, { expiresIn: "10d" });
  return token;
};

export let ascendingSorting = (a: any, b: any, property: string) => {
  if (a[property] < b[property]) {
    return -1;
  }
  if (a[property] > b[property]) {
    return 1;
  }
  return 0;
};

export let descendingSorting = (a: any, b: any, property: string) => {
  if (a[property] > b[property]) {
    return -1;
  }
  if (a[property] < b[property]) {
    return 1;
  }
  return 0;
};

export let generatePassword = (length: number) => {
  var charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*";

  var password = "";
  for (var i = 0; i < length; i++) {
    var randomIndex = Math.floor(Math.random() * charset.length);
    password += charset.charAt(randomIndex);
  }
  return password;
};

export let cryptoEncryption = (key: string, data: unknown) => {
  let cipherText = "";
  if (key && data) {
    cipherText = crypto.AES.encrypt(JSON.stringify(data), config.CRYPTO_PRIVATE_KEY).toString();
  }
  return cipherText;
};

export let cryptoDecryption = (data: string) => {
  let decryptedData = "";
  if (data) {
    // let bytes = crypto.AES.decrypt(data, config.CRYPTO_PRIVATE_KEY).toString()
    let bytes = crypto.AES.decrypt(data, config.CRYPTO_PRIVATE_KEY);
    // console.log(bytes);

    decryptedData = JSON.parse(bytes.toString(crypto.enc.Utf8));
  }
  return decryptedData;
};

export let generateOTP = () => {
  var min = 100000;
  var max = 999999;
  var num = Math.floor(Math.random() * (max - min + 1)) + min;
  return num;
};

export let uniqueIdGenerator = () => {
  return _.times(24, () => ((Math.random() * 0xf) << 0).toString(16)).join("");
};

export let calculateDaysOld = function (givenDate: any) {
  const currentDate = new Date();
  const givenDateTime = new Date(givenDate).getTime();
  const currentDateTime = currentDate.getTime();
  const timeDiff = currentDateTime - givenDateTime;
  return 60 - Math.floor(timeDiff / (1000 * 60 * 60 * 24));
};

export let ciEquals = (a: string, b: string) => {
  return typeof a === 'string' && typeof b === 'string'
    ? a.localeCompare(b, undefined, { sensitivity: 'accent' }) === 0
    : a === b;
}

export let formatePhoneNumber = (phoneNumberString: string) => {
  const numericOnly = phoneNumberString.replace(/\D/g, '');
  let formattedNumber
  if (phoneNumberString.length == 10) {
    formattedNumber = numericOnly.replace(/(\d{3})(\d{3})?(\d{4})?/, '($1)-$2-$3');
  } else if (phoneNumberString.length == 11) {
    formattedNumber = numericOnly.replace(/(\d{3})(\d{3})?(\d{5})?/, '($1)-$2-$3');
  }
  return formattedNumber
  console.log(formattedNumber, "----------phoneNumberString");

  return formattedNumber
}

export let capitalizeFirstLetter = (string: any) => {
  return string.charAt(0).toUpperCase() + string.slice(1);
}

/* Common function for update first message system badge in mentee or mentor */
export const updateFirstMessageSystemBadge = async (req: any) => {
  try {
    const payload = req.data;

    const getMessageList = await find({
      collection: "Message",
      query: { senderId: payload.user_id, receiverId: payload.receiverId }
    });

    if (getMessageList.length == 1) {

      const findBadgeId = await findOne({
        collection: "Badge",
        query: { badge: req.type, isSystem: true }
      });

      const updateUserBadge = await findOneAndUpdate({
        collection: "User",
        query: { _id: payload.user_id, role: payload.user_type, isDel: false },
        update: { $push: { badge: { badge_id: findBadgeId._id, achievedDate: new Date() } } },
        options: { new: true }
      });

    }

  } catch (err: any) {
    logger.error(`There was an issue into update system badge.: ${err}`)
  }
}

/* Common function for update matched system badge in mentee or mentor */
export const updateMatchedBadge = async (req: any) => {
  try {
    const payload = req.data;

    // If mentor first match with mentee than give matched badge
    const getMentorInfo = await find({
      collection: "PairInfo",
      query: { mentorId: payload.mentorId, isDel: false, isConfirm: true }
    });

    if (getMentorInfo.length == 1) {

      await insertOne({
        collection: "AchievedBadges",
        document: {
          receiverId: payload.mentorId,
          // badgeName: badges.MATCHED,
          // type: badge_type.SYSTEM,
          achievedDate: new Date()
        }
      });

    }

    // If mentee first match with mentor than give matched badge
    const getMenteeInfo = await find({
      collection: "PairInfo",
      query: { menteeId: payload.menteeId, isDel: false, isConfirm: true }
    });

    if (getMenteeInfo.length == 1) {

      await insertOne({
        collection: "AchievedBadges",
        document: {
          receiverId: payload.menteeId,
          // badgeName: badges.MATCHED,
          // type: badge_type.SYSTEM,
          achievedDate: new Date()
        }
      });

    }


  } catch (err: any) {
    logger.error(`There was an issue into update system badge.: ${err}`)
  }
}


export const isEmailAlreadyExists = async (email: any) => {
  let isEmailExists = true;
  const userEmail = await findOne({ collection: 'User', query: { email: email, isDel: false } })

  const partnerEmail = await findOne({
    collection: "Partner",
    query: { contactEmail: email, isDel: false },
  })

  const regionEmail = await findOne({
    collection: "Region",
    query: { contactEmail: email, isDel: false },
  })

  if (userEmail || partnerEmail || regionEmail) {
    isEmailExists = false
  }

  return isEmailExists
}

export const formateDate = (req: any, d: any) => {
  const time = req.body.time;
  var cdate: any = ""
  if (time == 'plus') {

    const timeString = req.body.timeString;
    const milliseconds = timeToMilliseconds(timeString);
    console.log(milliseconds);
    const date = d;
    let times = new Date(date).getTime();
    console.log(times);
    cdate = times + milliseconds;
  } else {
    const timeString = req.body.timeString;
    const milliseconds = timeToMilliseconds(timeString);
    console.log(milliseconds);
    const date = d;
    let times = new Date(date).getTime();
    console.log(times);
    cdate = times - milliseconds;
  }
  cdate = new Date(cdate).toISOString();

  cdate = cdate.split("T")
  return cdate[0]
}

function timeToMilliseconds(time: any) {
  const [hours, minutes] = time.split(':').map(Number);
  return (hours * 60 + minutes) * 60 * 1000;
}
