import { body } from "express-validator";
import { errorMessage, ContentConstants } from "../utils/const";

export const createWebhook = [
  body('topic')
    .notEmpty()
    .withMessage(errorMessage.REQUIRED.replace(":attribute", "topic")),
  body('targetUrl')
    .notEmpty()
    .withMessage(errorMessage.REQUIRED.replace(":attribute", "targetUrl"))
];

export const getCourseList = [
  body('courseType')
    .notEmpty()
    .withMessage(errorMessage.REQUIRED.replace(":attribute", "courseType"))
    .isIn(ContentConstants.COURSES_TYPE_ARRAY)
    .withMessage(errorMessage.IN.replace(":attribute", "courseType")
    .replace(':values', '[Training, Project]')),
  body('search')
    .optional({ nullable: true }),
  body('page')
    .optional({ nullable: true })
    .isNumeric()
    .withMessage(errorMessage.NUMERIC.replace(":attribute", "page")),
  body('limit')
    .optional({ nullable: true })
    .isNumeric()
    .withMessage(errorMessage.NUMERIC.replace(":attribute", "limit"))
];