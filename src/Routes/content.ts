import express from "express";
import { contentController } from "../Controller/content.controller";
import validate from "../middleware/validate";
import {
  getCourseList,
  assignCourse,
  getAssignedCourseUsers,
  recommendedCourse,
  createContent,
  setDefaultCourse,
  getAllContents,
  updateContent,
  archivedContent,
  archivedCourse,
  unAssignCourse,
  removeContent,
  getThinkificCoursesForDropdown,
  getContentURL,
  recommandUserList,
  getContent
} from '../Validators/content';
import roleMiddleware from '../middleware/role';
import { userRoleConstant } from "../utils/const";

let router = express.Router();

router.post(
  "/getAllContents",
  roleMiddleware([
    userRoleConstant.I_SUPER_ADMIN,
    userRoleConstant.P_SUPER_ADMIN,
    userRoleConstant.P_LOCAL_ADMIN,
    userRoleConstant.I_LOCAL_ADMIN
  ]),
  validate(getAllContents),
  contentController.getAllContents
);

router.post(
  "/getCourseList",
  roleMiddleware([
    userRoleConstant.I_SUPER_ADMIN,
    userRoleConstant.P_SUPER_ADMIN,
    userRoleConstant.P_LOCAL_ADMIN,
    userRoleConstant.I_LOCAL_ADMIN
  ]),
  validate(getCourseList),
  contentController.getCourseList
);

router.post(
  "/assignCourse",
  roleMiddleware([userRoleConstant.I_SUPER_ADMIN]),
  validate(assignCourse),
  contentController.assignCourse
);

router.post(
  "/getAssignedCourseUsers",
  roleMiddleware([userRoleConstant.I_SUPER_ADMIN]),
  validate(getAssignedCourseUsers),
  contentController.getAssignedCourseUsers
);

router.post(
  "/recommendedCourse",
  roleMiddleware([
    userRoleConstant.P_SUPER_ADMIN,
    userRoleConstant.P_LOCAL_ADMIN,
    userRoleConstant.I_LOCAL_ADMIN
  ]),
  validate(recommendedCourse),
  contentController.recommendedCourse
);

router.post(
  "/",
  roleMiddleware([
    userRoleConstant.P_SUPER_ADMIN,
    userRoleConstant.P_LOCAL_ADMIN,
    userRoleConstant.I_LOCAL_ADMIN
  ]),
  validate(createContent),
  contentController.createContent
);

router.post(
  "/setDefaultCourse",
  roleMiddleware([
    userRoleConstant.P_SUPER_ADMIN,
    userRoleConstant.P_LOCAL_ADMIN,
    userRoleConstant.I_LOCAL_ADMIN
  ]),
  validate(setDefaultCourse),
  contentController.setDefaultCourse
);

router.post(
  '/recommandUserList',
  roleMiddleware([
    userRoleConstant.P_SUPER_ADMIN,
    userRoleConstant.P_LOCAL_ADMIN,
    userRoleConstant.I_LOCAL_ADMIN
  ]),
  validate(recommandUserList),
  contentController.recommandUserList
);

router.post(
  "/updateContent",
  roleMiddleware([
    userRoleConstant.P_SUPER_ADMIN,
    userRoleConstant.P_LOCAL_ADMIN,
    userRoleConstant.I_LOCAL_ADMIN
  ]),
  validate(updateContent),
  contentController.updateContent
);

router.post(
  "/archivedContent",
  roleMiddleware([
    userRoleConstant.P_SUPER_ADMIN,
    userRoleConstant.P_LOCAL_ADMIN,
    userRoleConstant.I_LOCAL_ADMIN
  ]),
  validate(archivedContent),
  contentController.archivedContent
);

router.post(
  "/archivedCourse",
  roleMiddleware([
    userRoleConstant.I_SUPER_ADMIN
  ]),
  validate(archivedCourse),
  contentController.archivedCourse
);

router.post(
  "/unAssignCourse",
  roleMiddleware([userRoleConstant.I_SUPER_ADMIN]),
  validate(unAssignCourse),
  contentController.unAssignCourse
);

router.post(
  "/removeContent",
  roleMiddleware([
    userRoleConstant.P_SUPER_ADMIN,
    userRoleConstant.P_LOCAL_ADMIN,
    userRoleConstant.I_LOCAL_ADMIN
  ]),
  validate(removeContent),
  contentController.removeContent
);

router.post(
  "/getThinkificCoursesForDropdown",
  roleMiddleware([
    userRoleConstant.I_SUPER_ADMIN,
    userRoleConstant.P_SUPER_ADMIN,
    userRoleConstant.P_LOCAL_ADMIN,
    userRoleConstant.I_LOCAL_ADMIN
  ]),
  validate(getThinkificCoursesForDropdown),
  contentController.getThinkificCoursesForDropdown
);

router.post(
  "/getContentURL",
  roleMiddleware([
    userRoleConstant.I_SUPER_ADMIN,
    userRoleConstant.P_SUPER_ADMIN,
    userRoleConstant.P_LOCAL_ADMIN,
    userRoleConstant.I_LOCAL_ADMIN
  ]),
  validate(getContentURL),
  contentController.getContentURL
);

router.post(
  "/getContent",
  roleMiddleware([
    userRoleConstant.P_SUPER_ADMIN,
    userRoleConstant.P_LOCAL_ADMIN,
    userRoleConstant.I_LOCAL_ADMIN
  ]),
  validate(getContent),
  contentController.getContent
);

export default router;
