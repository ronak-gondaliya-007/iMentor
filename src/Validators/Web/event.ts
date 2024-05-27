import { body, query } from "express-validator";
import { errorMessage } from "../../utils/const";

export let scheduleNewEventValidation = [
    body('event_name')
        .notEmpty()
        .withMessage(errorMessage.REQUIRED.replace(":attribute", "event_name")),
    body('location')
        .notEmpty()
        .withMessage(errorMessage.REQUIRED.replace(":attribute", "location")),
    body('isVirtual')
        .isBoolean()
        .optional(),
    body('start_date')
        .notEmpty()
        .withMessage(errorMessage.REQUIRED.replace(":attribute", "start_date")),
    body('end_date')
        .notEmpty()
        .withMessage(errorMessage.REQUIRED.replace(":attribute", "end_date")),
    body('guest')
        .isArray()
        .withMessage(errorMessage.REQUIRED.replace(":attribute", "guest")),
    body('description')
        .notEmpty()
        .withMessage(errorMessage.REQUIRED.replace(":attribute", "description")),
    body('isDraft')
        .isBoolean()
        .withMessage(errorMessage.REQUIRED.replace(":attribute", "isDraft")),
    body('attachments')
        .isArray()
        .withMessage(errorMessage.REQUIRED.replace(":attribute", "attachments")),
    body('thumbnail')
        .notEmpty()
        .withMessage(errorMessage.REQUIRED.replace(":attribute", "thumbnail")),
    body('attachmentskey')
        .isArray()
        .withMessage(errorMessage.REQUIRED.replace(":attribute", "attachmentskey")),
    body('thumbnailKey')
        .notEmpty()
        .withMessage(errorMessage.REQUIRED.replace(":attribute", "thumbnailKey")),
    body('additionalURL')
        .optional()
];

export let draftScheduleNewEventValidation = [
    body('event_name')
        .optional(),
    body('location')
        .optional(),
    body('isVirtual')
        .optional(),
    body('start_date')
        .optional(),
    body('end_date')
        .optional(),
    body('guest')
        .optional(),
    body('description')
        .optional(),
    body('isDraft')
        .isBoolean()
        .withMessage(errorMessage.REQUIRED.replace(":attribute", "isDraft")),
    body('attachments')
        .optional(),
    body('thumbnail')
        .optional(),
    body('attachmentskey')
        .optional(),
    body('thumbnailKey')
        .optional(),
    body('additionalURL')
        .optional()
];

export let editScheduleEventValidation = [
    body('event_id')
        .notEmpty()
        .withMessage(errorMessage.REQUIRED.replace(":attribute", "event_id"))
        .isMongoId()
        .withMessage("eventId must be MongoId.")
];

export let updateScheduleEventValidation = [
    body('event_id')
        .notEmpty()
        .withMessage(errorMessage.REQUIRED.replace(":attribute", "event_id"))
        .isMongoId()
        .withMessage("eventId must be MongoId."),
    body('event_name')
        .optional(),
    body('location')
        .optional(),
    body('isVirtual')
        .isBoolean()
        .optional(),
    body('start_date')
        .optional(),
    body('end_date')
        .optional(),
    body('guest')
        .optional(),
    body('description')
        .optional(),
    body('isDraft')
        .optional(),
    body('attachments')
        .optional(),
    body('thumbnail')
        .optional(),
    body('attachmentskey')
        .optional(),
    body('thumbnailKey')
        .optional(),
    body('additionalURL')
        .optional()
];

export let deleteScheduleEventValidation = [
    body('event_id')
        .notEmpty()
        .withMessage(errorMessage.REQUIRED.replace(":attribute", "event_id"))
        .isMongoId()
        .withMessage("eventId must be MongoId.")
];

export let getScheduledEventValidation = [
    body('eventId')
        .notEmpty()
        .withMessage(errorMessage.REQUIRED.replace(":attribute", "eventId"))
        .isMongoId()
        .withMessage("eventId must be MongoId.")
];

export let scheduleEventListValidation = [
    body('event_type')
        .optional(),
    body('isExpired')
        .optional(),
    body('page')
        .isNumeric()
        .optional(),
    body('limit')
        .isNumeric()
        .optional()
];

export let addInFavoriteEventValidation = [
    body('eventId')
        .notEmpty()
        .withMessage(errorMessage.REQUIRED.replace(":attribute", "eventId"))
        .isMongoId()
        .withMessage("eventId must be MongoId.")
];

export let eventGuestApprovalValidation = [
    body('eventId')
        .notEmpty()
        .withMessage(errorMessage.REQUIRED.replace(":attribute", "eventId"))
        .isMongoId()
        .withMessage("eventId must be MongoId."),
    body('isApproved')
        .notEmpty()
        .isBoolean()
        .withMessage(errorMessage.REQUIRED.replace(":attribute", "eventId"))
];