import * as AWS from "aws-sdk";
import path from "path";
import * as fs from "fs";
import { statusCode, errorMessage } from "../utils/const";
import { logger } from "../utils/helpers/logger";
import { find, findOne, findOneAndUpdate } from "../utils/db";

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

function insertSpacesBetweenWords(fieldName: any) {
    // Use regular expression to insert spaces between capital letters that divide two words
    let field = fieldName.replace(/([a-z])([A-Z])/g, '$1 $2');
    return field.toLowerCase()
}

const validateFile = async (responseObj: any, file: any, fieldName: string, allowedExtension: string[], maxSizeInMb?: number, mentor?: string) => {

    let error = '';
    let isValidFile = true;
    responseObj.statusCode = statusCode.BAD_REQUEST

    let field;
    field = insertSpacesBetweenWords(fieldName);

    console.log("fiedl", fieldName);
    console.log("mentorId", mentor);
    if (fieldName == "mentorProfilePic" && !file) {

        const userProfilePic = await findOne({
            collection: 'User',
            query: { _id: mentor },
        });
        console.log(userProfilePic);

        const removeUserProfilePic = await deleteUploadedS3URL({ objectKey: userProfilePic.profilePicKey !== "" ? userProfilePic.profilePicKey : userProfilePic.profilePic });
        console.log("removeUserProfilePic", removeUserProfilePic);

        const mentorUpdate = await findOneAndUpdate({
            collection: 'User',
            query: {
                _id: mentor
            },
            update: {
                $set: {
                    profilePicKey: "", profilePic: ""
                }
            },
            options: { new: true }
        });

        let response: any = {
            isEmpty: true,
            data: mentorUpdate
        }
        return response;

    }

    if (!file && fieldName != "mentorProfilePic") {
        console.log("if",);
        isValidFile = false;
        error = errorMessage.REQUIRED.replace(':attribute', field);
    } else if (file.fieldname != fieldName) {
        isValidFile = false;
        error = errorMessage.REQUIRED.replace(':attribute', field);
    } else {
        // Validate extension
        if (allowedExtension.length > 0) {
            let extension = path.extname(file.originalname).toLowerCase();
            if (extension.length === 1) {
                const fileNameParts = file.mimetype.split('/');
                extension = `.${fileNameParts[1]}`;
            }
            const isValidExt = await isValidExtenstion(extension, allowedExtension);

            if (!isValidExt) {
                isValidFile = false;
                error = errorMessage.FILE_TYPE.replace(':attribute', field)
                    .replace(':values', `${allowedExtension.join('/')}`);
            }
        }

        // Validate file size
        if (maxSizeInMb) {
            const isValidSize = await isValidFileSize(
                file.size,
                maxSizeInMb * 1024 * 1024
            );

            if (!isValidSize) {
                isValidFile = false;
                error = errorMessage.MAX_FILE_SIZE.replace(':attribute', field)
                    .replace(':value', `${maxSizeInMb.toString()} MB`);
            }
        }
    }

    if (!isValidFile) {
        return error
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

const deleteUploadedS3URL = async (req: any) => {
    try {
        const payload = req.objectKey;
        var objectKey;

        // Check if the objectKey is a URL before attempting to split
        if (payload?.startsWith('https://') || payload?.startsWith('http://')) {
            // Parse the S3 URL to extract the path (object key)
            const urlParts = payload.split('/');
            objectKey = urlParts.slice(3).join('/'); // Skip the protocol, domain, and bucket name
        } else {
            objectKey = payload;
        }

        // Define parameters for deleting the object
        const params: any = {
            Bucket: BUCKET_NAME,
            Key: objectKey,
        };

        // Delete the object from the S3 bucket
        s3bucket.deleteObject(params, (err: any, data: any) => {
            if (err) {
                logger.error('Error deleting object:', err);
            } else {
                console.log('Object deleted successfully:', data);
            }
        });

    } catch (err: any) {
        logger.error(`There was an issue into delete uploaded s3 url.: ${err}`);
    }
}

export { validateFile, uploadToS3, deleteUploadedS3URL }
