import express, { NextFunction, Request, Response } from 'express';
import { mentorController } from '../../Controller/Web/mentor.controller';
import { uploadMessageFile } from '../../Controller/Web/message.controller';
import { auth } from '../../middleware/auth';
import validate from '../../middleware/validate';
import {
    getMenteeUserValidation, mentorPreMatchToDoListValidation, getMenteeListValidation, getTimeSlotValidation, deleteMenteeValidation, getPreMatchEventListValidation
} from '../../Validators/Web/mentor';
import multer from 'multer';

let router = express.Router();

const upload = multer({ storage: multer.memoryStorage() });

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, "./uploads" + "/MentorFile");
    },
    filename: function (req, file, cb) {
        cb(null, file.fieldname + "_" + Date.now());
    },
});

const uploadFile = multer({ storage: storage });

router.post('/questionList', auth, mentorController.questionList);

router.get('/getPreMatchDetail', auth, mentorController.getPreMatchDetail);

router.post('/mentorPreMatchToDoList', auth, validate(mentorPreMatchToDoListValidation), mentorController.mentorPreMatchToDoList);

router.get('/getMentorTraining', auth, mentorController.getMentorTraining);

router.post('/getPreMatchEventList', auth, validate(getPreMatchEventListValidation), mentorController.getPreMatchEventList);

router.post('/getTimeSlot', auth, validate(getTimeSlotValidation), mentorController.getTimeSlot);

router.post('/getMenteesList', auth, validate(getMenteeListValidation), mentorController.getMenteesList);

router.post('/getMenteeUserDetail', auth, validate(getMenteeUserValidation), mentorController.getMenteeUserDetail);

router.post('/deleteMentee', auth, validate(deleteMenteeValidation), mentorController.deleteMentee);

router.post('/uploadMessageFile', auth, upload.single('messageFile'), uploadMessageFile);

export default router;