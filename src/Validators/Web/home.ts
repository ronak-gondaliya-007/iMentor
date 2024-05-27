import { body, query } from "express-validator";
import { errorMessage } from "../../utils/const";

export let setNewReminderValidation = [
    body('title')
        .notEmpty()
        .withMessage(errorMessage.REQUIRED.replace(":attribute", "title")),
    body('remind_time')
        .notEmpty()
        .withMessage(errorMessage.REQUIRED.replace(":attribute", "remind_time")),
    body('note')
        .optional(),
    body('type')
        .optional(),
    body('messageId')
        .optional()
];

export let editReminderValidation = [
    body('reminderId')
        .notEmpty()
        .withMessage(errorMessage.REQUIRED.replace(":attribute", "reminderId"))
        .isMongoId()
        .withMessage("reminderId must be MongoId.")
];

export let updateReminderValidation = [
    body('reminderId')
        .notEmpty()
        .withMessage(errorMessage.REQUIRED.replace(":attribute", "reminderId"))
        .isMongoId()
        .withMessage("reminderId must be MongoId."),
    body('title')
        .optional(),
    body('remind_time')
        .optional(),
    body('note')
        .optional()
];

export let deleteReminderValidation = [
    body('reminderId')
        .notEmpty()
        .withMessage(errorMessage.REQUIRED.replace(":attribute", "reminderId"))
        .isMongoId()
        .withMessage("reminderId must be MongoId."),
    body('type')
        .optional(),
    body('messageId')
        .optional()
];