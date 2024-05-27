import { body, query } from "express-validator";
import { errorMessage } from "../../utils/const";

export let getMenteeProgressDetailValidation = [
    body('userId')
        .notEmpty()
        .withMessage(errorMessage.REQUIRED.replace(":attribute", "userId"))
        .isMongoId()
        .withMessage("userId must be MongoId.")
];

export let givenBadgeListValidation = [
    body('userId')
        .notEmpty()
        .withMessage(errorMessage.REQUIRED.replace(":attribute", "userId"))
        .isMongoId()
        .withMessage("userId must be MongoId.")
];

export let sendBadgeValidation = [
    body('userId')
        .notEmpty()
        .withMessage(errorMessage.REQUIRED.replace(":attribute", "userId"))
        .isMongoId()
        .withMessage("userId must be MongoId."),
    body('badgeName')
        .notEmpty()
        .withMessage(errorMessage.REQUIRED.replace(":attribute", "badgeName")),
    body('message')
        .optional()
        .isString()
        .withMessage(errorMessage.REQUIRED.replace(":attribute", "message"))
];

export let menteeWiseProjectValidation = [
    body('userId')
        .notEmpty()
        .withMessage(errorMessage.REQUIRED.replace(":attribute", "userId"))
        .isMongoId()
        .withMessage("userId must be MongoId.")
];