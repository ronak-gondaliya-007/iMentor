import * as AWS from "aws-sdk";
import path from "path";
import * as fs from "fs";
import { statusCode, errorMessage } from "./const";

const BUCKET_NAME = process.env.AWS_BUCKET_NAME;
const ACCESS_KEY = process.env.AWS_ACCESS_KEY;
const SECRET_SECRET = process.env.AWS_SECRET_KEY;

const s3bucket = new AWS.S3({
  accessKeyId: ACCESS_KEY,
  secretAccessKey: SECRET_SECRET
});

const isValidExtenstion = async (mimetype: string, allowedExtension: string[]): Promise<boolean> => {
  if (allowedExtension.includes(mimetype)) {
    return true;
  } else {
    return false;
  }
};

const isValidFileSize = async (fileSize: number, maxSize: number): Promise<boolean> => {
  if (fileSize <= maxSize) {
    return true;
  } else {
    return false;
  }
};

const validateFile = async (
  responseObj: any,
  file: any,
  fieldName: string,
  allowedExtension: string[],
  maxSizeInMb?: number,
) => {
  let error = '';
  let isValidFile = true;
  responseObj.statusCode = statusCode.BAD_REQUEST

  if (!file) {
    isValidFile = false;
    error = errorMessage.REQUIRED.replace(':attribute', fieldName);
  } else if (file.fieldname != fieldName) {
    isValidFile = false;
    error = errorMessage.REQUIRED.replace(':attribute', fieldName);
  } else {
    // Validate extension
    if (allowedExtension.length > 0) {
      const extension = path.extname(file.originalname).toLowerCase();
      const isValidExt = await isValidExtenstion(extension, allowedExtension);

      if (!isValidExt) {
        isValidFile = false;
        // error = errorMessage.FILE_TYPE.replace(':attribute', fieldName)
        //   .replace(':values', `${allowedExtension.join('/')}`);
        error = "Kindly attach valid file."
      }
    }

    // validaate file size
    if (maxSizeInMb) {
      const isValidSize = await isValidFileSize(
        file.size,
        maxSizeInMb * 1024 * 1024
      );

      if (!isValidSize) {
        isValidFile = false;
        error = errorMessage.MAX_FILE_SIZE.replace(':attribute', fieldName)
          .replace(':value', `${maxSizeInMb.toString()} MB`);
      }
    }
  }

  if (!isValidFile) {
    return error
    throw new Error(error);
  }
};


const uploadToS3 = async (file: any, folderName: string, isLocalFile?: boolean) => {


  var truncatedFileName;
  if (file.originalname.length > 20) {

    // If it's longer, truncate it to 20 characters
    truncatedFileName = file.originalname.slice(0, 15).replace(/ /g, '_').split(".")[0];

    // Remove trailing hyphen if present
    if (truncatedFileName.endsWith('-')) {
      truncatedFileName = truncatedFileName.slice(0, -1) + "_" + Date.now() + '.' + file.originalname.split('.').pop();
    } else {
      truncatedFileName = truncatedFileName + "_" + Date.now() + '.' + file.originalname.split('.').pop();
    }

  } else {
    truncatedFileName = file.originalname.replace(/ /g, '_').split(".")[0] + "_" + Date.now() + '.' + file.originalname.split('.').pop()
  }

  let bodyData = file.buffer;

  if (isLocalFile) {
    bodyData = fs.readFileSync(file.path);
  }

  const params: any = {
    Bucket: BUCKET_NAME,
    Key: "iMentor/" + folderName + "/" + truncatedFileName,
    Body: bodyData,
    acl: 'public-read',
    contentType: file.mimetype
  };

  return new Promise((resolve, reject) => {
    s3bucket.upload(params, function (err: any, data: any) {
      if (err) {
        return reject(err);
      }

      return resolve(data);
    });
  });
}

export { validateFile, uploadToS3 }
