import express from 'express';
import { menteeController } from '../../Controller/Web/mentee.controller';
import { auth } from '../../middleware/auth';
import validate from '../../middleware/validate';
import { getMentorListValidation, getMentorUserDetailValidation, menteePreMatchToDoListValidation } from '../../Validators/Web/mentee';
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

router.get('/getPreMatchDetail', auth, menteeController.getPreMatchDetail);

router.post('/menteePreMatchToDoList', auth, validate(menteePreMatchToDoListValidation), menteeController.menteePreMatchToDoList);

router.post('/getMentorList', auth, validate(getMentorListValidation), menteeController.getMentorList);

router.post('/getMentorUserDetail', auth, validate(getMentorUserDetailValidation), menteeController.getMentorUserDetail);

export default router;