import express from "express";
import { auth } from "../middleware/auth";
import { menteeController } from "../Controller/mentees.controller";
import { activeMenteesValidation, addMenteesValidation, deleteMenteeValidation, disableMenteesValidation, menteesListValidation } from "../Validators/mentees";
import validate from "../middleware/validate";
import multer from 'multer'

let router = express.Router();

const upload = multer({ storage: multer.memoryStorage() });

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, "./uploads" + "/MenteeFile");
    },
    filename: function (req, file, cb) {
        cb(null, file.fieldname + "_" + Date.now());
    },
});
const uploadFile = multer({ storage: storage });

router.post('/addMentee', auth, menteeController.addMentee)
router.post('/uploadProfilePic', auth, upload.single('menteeProfilePic'), menteeController.uploadProfilePicOfMentee)
router.post('/menteesList', auth, validate(menteesListValidation), menteeController.menteesList)
router.post('/menteesListV2', auth, validate(menteesListValidation), menteeController.menteesListV2)
router.post('/deleteMentees', auth, validate(deleteMenteeValidation), menteeController.deleteMentees)
router.post('/disableMentees', auth, validate(disableMenteesValidation), menteeController.disableMentees)
router.post('/activeMentees', auth, validate(activeMenteesValidation), menteeController.activeMentees)
router.get('/getMenteeUser', auth, menteeController.getMenteeUser);
router.post('/updateMentee', auth, menteeController.updateMentee);
router.post('/importFromCsv', auth, uploadFile.single('menteeCsv'), menteeController.importUserFromCSV);
router.post('/sendMessageToMentor', auth, upload.array("uploadedFile", 2), menteeController.sendMessageToMentee);
router.get('/filterListData', auth, menteeController.filterListData);
router.post('/removeMenteeProfilePic', auth, menteeController.removeMenteeProfilePic);
router.post('/loginAs', auth, menteeController.menteeLoginAs)
router.post('/sendInvite', auth, menteeController.sendInvite);
router.post("/getMatchList", auth, menteeController.getMatchList);
router.post("/getMatchingQuestion", auth, menteeController.getMatchingQuestion)

export default router;
