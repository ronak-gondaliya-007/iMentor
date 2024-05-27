import express, { Request, Response } from 'express';
import { mentorController } from '../Controller/mentor.controller';
import { auth } from '../middleware/auth';
import validate from '../middleware/validate';
import { addMentorValidator, deleteMentorValidator, getSingleMentorValidator, updateMentorValidator } from '../Validators/mentor';
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

router.post('/addMentor', auth, mentorController.addMentor);
router.post('/getMentors', auth, mentorController.getMentors);
router.post('/getSingleMentor', auth, validate(getSingleMentorValidator), mentorController.getSingleMentor);
router.post('/updateMentor', auth, mentorController.updateMentor);
router.post('/deleteMentor', auth, validate(deleteMentorValidator), mentorController.deleteMentor);
router.post('/getAllmentorStateAndCity', auth, mentorController.getAllmentorStateAndCity);
router.post('/approveAndRejectMentor', auth, mentorController.approveAndRejectMentor);
router.post('/uploadProfilePic', auth, upload.single('mentorProfilePic'), mentorController.uploadMentorProfilePic);
router.post('/getMatchingQuestion', auth, mentorController.getMatchingQuestion);
router.post('/getStateList', auth, mentorController.getStateList);
router.post('/sendRequestMail', auth, mentorController.sendRequestMail);
router.post('/getCurrentMentor', auth, mentorController.getCurretnMentor);
router.post('/sendMessageToMentor', auth, upload.array("uploadedFile", 2), mentorController.sendMessageToMentor);
router.post('/mentorLogin', auth, mentorController.mentorLogin);
router.post('/getMatchesList', auth, mentorController.getMatchesList);
router.post('/importMentorFromCSV', auth, uploadFile.single('mentorCSV'), mentorController.importMentorFromCSV);
router.post('/removeMentorProfilePic', auth, mentorController.removeMentorProfilePic);
router.post('/sendInvite', auth, mentorController.sendInvite);

export default router