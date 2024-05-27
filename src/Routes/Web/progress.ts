import express from "express";
import { progressController } from "../../Controller/Web/progress.controller";
import { mentorController } from "../../Controller/Web/mentor.controller";
import { auth } from "../../middleware/auth";
import validate from "../../middleware/validate";
import { getMenteeListValidation } from '../../Validators/Web/mentor';
import { getMenteeProgressDetailValidation, sendBadgeValidation, menteeWiseProjectValidation, givenBadgeListValidation } from '../../Validators/Web/progress';

let router = express.Router();

router.post("/getMenteesList", auth, validate(getMenteeListValidation), mentorController.getMenteesList);

router.post("/getMenteeProgressDetail", auth, validate(getMenteeProgressDetailValidation), progressController.getMenteeProgressDetail);

router.post("/givenBadgeList", auth, validate(givenBadgeListValidation), progressController.givenBadgeList);

router.post("/sendBadge", auth, validate(sendBadgeValidation), progressController.sendBadge);

router.get("/menteesAllProject", auth, progressController.menteesAllProject);

router.post("/menteeWiseProject", auth, validate(menteeWiseProjectValidation), progressController.menteeWiseProject);

export default router;
