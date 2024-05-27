import { body } from 'express-validator';
import { errorMessage } from '../utils/const';


export let addMenteesValidation = [
    body('fname')
        .notEmpty()
        .withMessage(errorMessage.REQUIRED.replace(':attribute', 'fname')),
    body('lname')
        .notEmpty()
        .withMessage(errorMessage.REQUIRED.replace(':attribute', 'lname')),
    body('email')
        .isEmail()
        .notEmpty()
        .withMessage(errorMessage.REQUIRED.replace(":attribute", 'email')),
    body('programInformation')
        .optional({ nullable: true })
        .isObject()
        .withMessage(errorMessage.OBJECT.replace(":attribute", "programInformation")),
    body('demographicInformation')
        .optional({ nullable: true })
        .isObject()
        .withMessage(errorMessage.OBJECT.replace(":attribute", "demographicInformation")),
    body('recoveryEmail')
        .optional({ nullable: true })
        .isEmail()
        .withMessage("Please enter valid recovery email.")
]

export let menteesListValidation = [
    body('search')
        .optional({ nullable: true })
        .isString()
        .withMessage("search must be string."),
    body('status')
        .optional({ nullable: true })
        .isArray()
        .withMessage(errorMessage.ARRAY.replace(':attribute', 'status')),
    body('location')
        .optional({ nullable: true })
        .isArray()
        .withMessage(errorMessage.ARRAY.replace(':attribute', 'location')),
    body('assignedMentor')
        .optional({ nullable: true })
        .isMongoId()
        .withMessage("assignedMentor must be mongo objectId."),
    body('sort')
        .optional({ nullable: true })
        .isObject()
        .withMessage(errorMessage.OBJECT.replace(":attribute", "sort")),
    body('page')
        .optional({ nullable: true })
        .isNumeric()
        .withMessage("Page must be numeric."),
    body('limit')
        .optional({ nullable: true })
        .isNumeric()
        .withMessage("limit must be numeric.")
]

export let deleteMenteeValidation = [
    body('userId')
        .notEmpty()
        .withMessage(errorMessage.REQUIRED.replace(":attribute", 'userId'))
        .isArray()
        .withMessage(errorMessage.ARRAY.replace(':attribute', 'userId'))
]

export let disableMenteesValidation = [
    body('userId')
        .notEmpty()
        .withMessage(errorMessage.REQUIRED.replace(":attribute", 'userId'))
        .isArray()
        .withMessage(errorMessage.ARRAY.replace(':attribute', 'userId'))
]

export let activeMenteesValidation = [
    body('userId')
        .notEmpty()
        .withMessage(errorMessage.REQUIRED.replace(":attribute", 'userId'))
        .isArray()
        .withMessage(errorMessage.ARRAY.replace(':attribute', 'userId'))
]

export let getMenteeUserValidation = [
    body('userId')
        .notEmpty()
        .withMessage(errorMessage.REQUIRED.replace(":attribute", "userId"))
        .isMongoId()
        .withMessage("userId must be MongoId.")
]