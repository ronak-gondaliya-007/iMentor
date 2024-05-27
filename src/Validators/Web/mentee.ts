import { body, query } from "express-validator";
import { errorMessage } from "../../utils/const";

export let getMentorListValidation = [
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

export let getMentorUserDetailValidation = [
    body('userId')
        .notEmpty()
        .withMessage(errorMessage.REQUIRED.replace(":attribute", "userId"))
        .isMongoId()
        .withMessage("userId must be MongoId.")
];

export let menteePreMatchToDoListValidation = [
    body('schedule_id')
        .optional(),
    body('reschedule')
        .isBoolean()
        .withMessage(errorMessage.REQUIRED.replace(":attribute", "reschedule")),
    body('step')
        .isNumeric()
        .withMessage(errorMessage.REQUIRED.replace(":attribute", "step")),
    body('isAgree')
        .isBoolean()
        .optional(),
    body('isDraft')
        .isBoolean()
        .withMessage(errorMessage.REQUIRED.replace(":attribute", "isDraft")),
];
