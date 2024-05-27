import { body } from "express-validator";
import { errorMessage } from "../../utils/const";

export let getContentURLValidation = [
    body('courseId')
        .notEmpty()
        .withMessage(errorMessage.REQUIRED.replace(":attribute", "courseId"))
];

export let getContentDetailValidation = [
    body('contentId')
        .notEmpty()
        .withMessage(errorMessage.REQUIRED.replace(":attribute", "contentId"))
];

export let shareContentValidation = [
    body('contentId')
        .notEmpty()
        .isMongoId()
        .withMessage(errorMessage.REQUIRED.replace(":attribute", "contentId")),
    body('user')
        .notEmpty()
        .isArray()
        .withMessage(errorMessage.REQUIRED.replace(":attribute", "user")),
    body('message')
        .optional()
];


export let incrementContentViewedCountValidation = [
    body('contentId')
        .notEmpty()
        .isMongoId()
        .withMessage(errorMessage.REQUIRED.replace(":attribute", "contentId"))
];