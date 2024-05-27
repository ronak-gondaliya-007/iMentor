import { body, query } from "express-validator";
import { errorMessage } from "../../utils/const";

export let getTimeSlotValidation = [
    body('startDate')
        .notEmpty()
        .withMessage(errorMessage.REQUIRED.replace(":attribute", "startDate")),
    body('endDate')
        .notEmpty()
        .withMessage(errorMessage.REQUIRED.replace(":attribute", "endDate")),
    body('type')
        .notEmpty()
        .withMessage(errorMessage.REQUIRED.replace(":attribute", "type"))
];

export let getPreMatchEventListValidation = [
    body('type')
        .notEmpty()
        .withMessage(errorMessage.REQUIRED.replace(":attribute", "type"))
];

export let mentorPreMatchToDoListValidation = [
    body('schedule_id')
        .notEmpty()
        .withMessage(errorMessage.REQUIRED.replace(":attribute", "schedule_id")),
    body('reschedule')
        .isBoolean()
        .withMessage(errorMessage.REQUIRED.replace(":attribute", "reschedule")),
    body('step')
        .isNumeric()
        .withMessage(errorMessage.REQUIRED.replace(":attribute", "step")),
    body('isDraft')
        .isBoolean()
        .withMessage(errorMessage.REQUIRED.replace(":attribute", "isDraft")),
];

export let getMenteeListValidation = [
    body('sort')
        .optional({ nullable: true }),
    body('order')
        .optional({ nullable: true }),
    body('page')
        .optional({ nullable: true })
        .isNumeric()
        .withMessage("Page must be numeric."),
    body('limit')
        .optional({ nullable: true })
        .isNumeric()
        .withMessage("limit must be numeric.")
];

export let getMenteeUserValidation = [
    body('userId')
        .notEmpty()
        .withMessage(errorMessage.REQUIRED.replace(":attribute", "userId"))
        .isMongoId()
        .withMessage("userId must be MongoId.")
];

export let deleteMenteeValidation = [
    body('menteeId')
        .notEmpty()
        .withMessage(errorMessage.REQUIRED.replace(":attribute", "menteeId"))
        .isMongoId()
        .withMessage("userId must be MongoId.")
];