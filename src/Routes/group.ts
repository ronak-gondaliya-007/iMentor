import express, { Request, Response } from "express";
import { groupController } from "../Controller/group.controller.";
import { auth } from "../middleware/auth";
import validate from "../middleware/validate";
import { addGroupValidator, getSingleGroupValidator, updateGroupValidator, deleteGroupValidator, archiveGroupValidator } from "../Validators/group";
let router = express.Router();

router.post('/addGroup', validate(addGroupValidator), groupController.addGroup);
router.post('/getGroup', groupController.getGroup);
router.post('/getSingleGroup', validate(getSingleGroupValidator), groupController.getSingleGroup);
router.post('/updateGroup', /* validate(updateGroupValidator) */ groupController.updateGroup);
router.post('/deleteGroup', validate(deleteGroupValidator), groupController.deleteGroup);
router.post('/archievedGroup', validate(archiveGroupValidator), groupController.archievedGroup);
router.post('/sendMessageInGroup', groupController.sendMessageInGroup);
router.post('/groupMemeberList', groupController.groupMemeberList);
router.post("/addNewSchoolOrInstitute", /* validate(addNewSchoolOrInstitute) */ groupController.addNewSchoolOrInstitute);
router.post("/removeNewSchoolOrInstitute",/*  validate(removeNewSchoolOrInstitute) */ groupController.removeNewSchoolOrInstitute);
router.get('/filterOptionList', groupController.filterOptionList);
router.post("/schoolOrInstituteList", groupController.SchoolOrInstitute);

export default router;
