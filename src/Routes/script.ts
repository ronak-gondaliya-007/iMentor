import express from "express";
import { scriptControllors } from "../Controller/script.controller";
import { auth } from "../middleware/auth";

let router = express.Router();

router.get("/mongooseTest", scriptControllors.mongoose);
router.get("/SchoolOrInstitute", scriptControllors.SchoolOrInstitute);
router.get("/AddChapterIdsIntoAssignedCourses", scriptControllors.AddChapterIdsIntoAssignedCourses);
router.get("/AddPercentageCompletedIntoRecommededCourse", scriptControllors.AddPercentageCompletedIntoRecommededCourse);
router.get("/AddPartnerIdOrRegionIdIntoRecommededCourse", scriptControllors.AddPartnerIdOrRegionIdIntoRecommededCourse);
router.get("/AddContentViewedCountIntoContent", scriptControllors.AddContentViewedCountIntoContent);
router.get("/mentorMatchingQuestionAnswerM2", scriptControllors.mentorMatchingQuestionAnswerM2);
router.get("/menteeMatchingQuestionAnswerM2", scriptControllors.menteeMatchingQuestionAnswerM2);
router.get("/matchingQuestionAnswerM2", scriptControllors.matchingQuestionAnswerM2);
// router.get("/careerQuestionAnswerSetEmptyArrayM2", scriptControllors.careerQuestionAnswerSetEmptyArrayM2);

export default router;
