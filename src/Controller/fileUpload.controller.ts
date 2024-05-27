import { Request, Response } from "express";
import { statusCode, successMessage, uploadConstant } from "../utils/const";
import { uploadToS3, validateFile } from "../utils/uploadFile";
import { success, error } from "../utils/helpers/resSender";
import { logger } from "../utils/helpers/logger";
import path from "path";

export let fileUploadController = {

    imageUpload: async (req: Request, res: Response) => {
        try {

            const file = req.file;
            const maxSize = uploadConstant.PROFILE_PIC_FILE_SIZE;
            const extArr = uploadConstant.FILE_UPLOAD_EXT_ARR;


            // validate file
            let fileUpload = await validateFile(res, file, 'file', extArr, maxSize);
            console.log(fileUpload, "------------------", req.file);


            if (fileUpload) {
                res.status(statusCode.BAD_REQUEST).send(error(fileUpload, {}, statusCode.BAD_REQUEST));
                return
            }
            const uploadFile: any = await uploadToS3(file, req.body.fileType);

            let uploadedFile: any = {}

            if (uploadFile) {
                uploadedFile['location'] = uploadFile.Location;
                uploadedFile['key'] = uploadFile.key;
            }

            res.status(statusCode.OK).send(success(successMessage.UPLOAD_SUCCESS.replace(':attribute', "File"), uploadedFile))

        } catch (err) {
            logger.error(`There was an issue into upload file.: ${err}`)
            res.status(statusCode.FORBIDDEN).send(error("There was an issue into upload file", err))
        }
    },

    attachmentUpload: async (req: Request, res: Response) => {
        try {

            const file = req.file;
            const maxSize = uploadConstant.PROFILE_PIC_FILE_SIZE;
            const extArr = uploadConstant.CSV_FILE_EXT_ARR;

            // validate file
            let validateUplaodedFile = await validateFile(res, file, 'adminCSV', extArr, maxSize);

            if (validateUplaodedFile) {
                res.status(statusCode.BAD_REQUEST).send(error(validateUplaodedFile, {}, statusCode.BAD_REQUEST))
                return
            }

            const uploadFile: any = await uploadToS3(file, req.body.fileType);

            console.log(uploadFile);
            return

            let uploadedFile: any = {}

            if (uploadFile) {
                uploadedFile['location'] = uploadFile.Location;
                uploadedFile['key'] = uploadFile.key;
            }

            res.status(statusCode.OK).send(success(successMessage.UPLOAD_SUCCESS.replace(':attribute', "profile pic"), uploadedFile))

        } catch (err) {
            logger.error(`There was an issue into upload file.: ${err}`)
            res.status(statusCode.FORBIDDEN).send(error("There was an issue into upload file", err))
        }
    },

    contentDocUpload: async (req: Request, res: Response) => {
        try {

            const file = req.file;
            let extArr: any = uploadConstant.CONTENT_DOC_EXT_ARRAY;
            let maxSize: any = uploadConstant.CONTENT_DOC_FILE_SIZE;

            if (file && file.originalname) {
                const extension = path.extname(file.originalname).toLowerCase();
                const audioVideoExtention = uploadConstant.CONTENT_AUDIO_VIDEO_EXT_ARRAY;

                if (audioVideoExtention.includes(extension)) {
                    maxSize = uploadConstant.CONTENT_AUDIO_VIDEO_FILE_SIZE;
                    extArr = uploadConstant.CONTENT_AUDIO_VIDEO_EXT_ARRAY;
                }
            }

            // validate file
            let fileUpload = await validateFile(res, file, 'file', extArr, maxSize);
            console.log(fileUpload, "------------------", req.file);


            if (fileUpload) {
                res.status(statusCode.BAD_REQUEST).send(error(fileUpload, {}, statusCode.BAD_REQUEST));
                return
            }
            const uploadFile: any = await uploadToS3(file, 'Content');

            let uploadedFile: any = {}

            if (uploadFile) {
                uploadedFile['location'] = uploadFile.Location;
                uploadedFile['key'] = uploadFile.key;
            }

            res.status(statusCode.OK).send(success(successMessage.UPLOAD_SUCCESS.replace(':attribute', "File"), uploadedFile))

        } catch (err) {
            logger.error(`There was an issue into upload content file.: ${err}`)
            res.status(statusCode.FORBIDDEN).send(error("There was an issue into upload content file", err))
        }
    },
}
