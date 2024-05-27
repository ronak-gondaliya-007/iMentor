import { body } from "express-validator";
import { errorMessage } from "../utils/const";

export let addMentorValidator = [
    body("fname")
        .notEmpty()
        .withMessage(errorMessage.REQUIRED.replace(':attribute', 'fname'))
        .isLength({ max: 20 })
        .withMessage(errorMessage.MAX.replace(':attribute', 'fname').replace(':max', '10')),
    body("lname")
        .notEmpty()
        .withMessage(errorMessage.REQUIRED.replace(':attribute', 'lname'))
        .isLength({ max: 20 })
        .withMessage(errorMessage.MAX.replace(':attribute', 'lname').replace(':max', '10')),
    body("preferredFname")
        .notEmpty()
        .withMessage(errorMessage.REQUIRED.replace(':attribute', 'preferredFname'))
        .isLength({ max: 20 })
        .withMessage(errorMessage.MAX.replace(':attribute', 'preferredFname').replace(':max', '10')),
    body("preferredLname")
        .notEmpty()
        .withMessage(errorMessage.REQUIRED.replace(':attribute', 'preferredLname'))
        .isLength({ max: 20 })
        .withMessage(errorMessage.MAX.replace(':attribute', 'preferredLname').replace(':max', '10')),
    body("email")
        .notEmpty()
        .isEmail()
        .withMessage(errorMessage.REQUIRED.replace(':attribute', 'email')),
    body("recoveryEmail")
        .notEmpty()
        .isEmail()
        .withMessage(errorMessage.REQUIRED.replace(':attribute', 'recoveryEmail')),
    body("primaryPhoneNo")
        .notEmpty()
        .withMessage(errorMessage.REQUIRED.replace(':attribute', 'primaryPhoneNo')),
    body("secondaryPhoneNo")
        .notEmpty()
        .withMessage(errorMessage.REQUIRED.replace(':attribute', 'secondaryPhoneNo')),
    body("address")
        .notEmpty()
        .withMessage(errorMessage.REQUIRED.replace(':attribute', 'address'))
        .isObject()
        .withMessage(errorMessage.OBJECT.replace(':attribute', 'address')),
    body("address.streetAddress1")
        .notEmpty()
        .withMessage(errorMessage.REQUIRED.replace(':attribute', 'address.streetAddress1')),
    body("address.streetAddress2")
        .optional({ nullable: true }),
    body("address.city")
        .notEmpty()
        .withMessage(errorMessage.REQUIRED.replace(':attribute', 'address.city'))
        .isLength({ max: 10 })
        .withMessage(errorMessage.MAX.replace(':attribute', 'address.city').replace(':max', '10')),
    body("address.state")
        .notEmpty()
        .withMessage(errorMessage.REQUIRED.replace(':attribute', 'address.state')),
    body("address.zipCode")
        .notEmpty()
        .withMessage(errorMessage.REQUIRED.replace(':attribute', 'address.zipCode'))
        .isInt(),
    body("demographicInformation")
        .optional({ nullable: true })
        .isObject()
        .withMessage(errorMessage.OBJECT.replace(':attribute', 'demographicInformation')),
    body("employerInformation")
        .optional({ nullable: true })
        .isObject()
        .withMessage(errorMessage.OBJECT.replace(':attribute', 'employerInformation')),
    body("programInformation")
        .optional({ nullable: true })
        .isObject()
        .withMessage(errorMessage.OBJECT.replace(':attribute', 'programInformation')),
    body("preloadMentees")
        .optional({ nullable: true })
        .isArray()
        .withMessage(errorMessage.OBJECT.replace(':attribute', 'preloadMentees')),
    body("references")
        .optional({ nullable: true })
        .isArray()
        .withMessage(errorMessage.OBJECT.replace(':attribute', 'references')),
    body("legalStatus")
        .optional({ nullable: true })
        .isObject()
        .withMessage(errorMessage.OBJECT.replace(':attribute', 'legalStatus')),
    body("physicalAndEmotionalCondition")
        .optional({ nullable: true })
        .isObject()
        .withMessage(errorMessage.OBJECT.replace(':attribute', 'physicalAndEmotionalCondition')),

];

export let updateMentorValidator = [
    body("mentorId")
        .notEmpty()
        .withMessage(errorMessage.REQUIRED.replace(":attribute", "mentorId"))
        .isMongoId()
        .withMessage(errorMessage.INVALID.replace(':attribute', 'mentorId')),
    body("fname")
        .notEmpty()
        .withMessage(errorMessage.REQUIRED.replace(':attribute', 'fname'))
        .isLength({ max: 20 })
        .withMessage(errorMessage.MAX.replace(':attribute', 'fname').replace(':max', '10')),
    body("lname")
        .notEmpty()
        .withMessage(errorMessage.REQUIRED.replace(':attribute', 'lname'))
        .isLength({ max: 20 })
        .withMessage(errorMessage.MAX.replace(':attribute', 'lname').replace(':max', '10')),
    body("preferredFname")
        .notEmpty()
        .withMessage(errorMessage.REQUIRED.replace(':attribute', 'preferredFname'))
        .isLength({ max: 20 })
        .withMessage(errorMessage.MAX.replace(':attribute', 'preferredFname').replace(':max', '10')),
    body("preferredLname")
        .notEmpty()
        .withMessage(errorMessage.REQUIRED.replace(':attribute', 'preferredLname'))
        .isLength({ max: 20 })
        .withMessage(errorMessage.MAX.replace(':attribute', 'preferredLname').replace(':max', '10')),
    body("recoveryEmail")
        .notEmpty()
        .isEmail()
        .withMessage(errorMessage.REQUIRED.replace(':attribute', 'recoveryEmail')),
    body("primaryPhoneNo")
        .notEmpty()
        .withMessage(errorMessage.REQUIRED.replace(':attribute', 'primaryPhoneNo')),
    body("secondaryPhoneNo")
        .notEmpty()
        .withMessage(errorMessage.REQUIRED.replace(':attribute', 'secondaryPhoneNo')),
    body("address")
        .notEmpty()
        .withMessage(errorMessage.REQUIRED.replace(':attribute', 'address'))
        .isObject()
        .withMessage(errorMessage.OBJECT.replace(':attribute', 'address')),
    body("address.streetAddress1")
        .notEmpty()
        .withMessage(errorMessage.REQUIRED.replace(':attribute', 'address.streetAddress1')),
    body("address.streetAddress2")
        .optional({ nullable: true }),
    body("address.city")
        .notEmpty()
        .withMessage(errorMessage.REQUIRED.replace(':attribute', 'address.city'))
        .isLength({ max: 10 })
        .withMessage(errorMessage.MAX.replace(':attribute', 'address.city').replace(':max', '10')),
    body("address.state")
        .notEmpty()
        .withMessage(errorMessage.REQUIRED.replace(':attribute', 'address.state')),
    body("address.zipCode")
        .notEmpty()
        .withMessage(errorMessage.REQUIRED.replace(':attribute', 'address.zipCode'))
        .isInt(),
    body("demographicInformation")
        .optional({ nullable: true })
        .isObject()
        .withMessage(errorMessage.OBJECT.replace(':attribute', 'demographicInformation')),
    body("employerInformation")
        .optional({ nullable: true })
        .isObject()
        .withMessage(errorMessage.OBJECT.replace(':attribute', 'employerInformation')),
    body("programInformation")
        .optional({ nullable: true })
        .isObject()
        .withMessage(errorMessage.OBJECT.replace(':attribute', 'programInformation')),
    body("preloadMentees")
        .optional({ nullable: true })
        .isArray()
        .withMessage(errorMessage.OBJECT.replace(':attribute', 'preloadMentees')),
    body("references")
        .optional({ nullable: true })
        .isArray()
        .withMessage(errorMessage.OBJECT.replace(':attribute', 'references')),
    body("legalStatus")
        .optional({ nullable: true })
        .isObject()
        .withMessage(errorMessage.OBJECT.replace(':attribute', 'legalStatus')),
    body("physicalAndEmotionalCondition")
        .optional({ nullable: true })
        .isObject()
        .withMessage(errorMessage.OBJECT.replace(':attribute', 'physicalAndEmotionalCondition')),
];

export let getSingleMentorValidator = [
    body('mentorId')
        .notEmpty()
        .withMessage(errorMessage.REQUIRED.replace(":attribute", "mentorId"))
        .isMongoId()
        .withMessage(errorMessage.INVALID.replace(':attribute', 'mentorId')),
];

export let deleteMentorValidator = [
    body('mentorId')
        .notEmpty()
        .withMessage(errorMessage.REQUIRED.replace(":attribute", "mentorId"))
        .isArray()
        .withMessage(errorMessage.INVALID.replace(':attribute', 'mentorId')),
];

export let approveAndRejectMentorValidator = [
    body('mentorId')
        .notEmpty()
        .withMessage(errorMessage.REQUIRED.replace(":attribute", "mentorId"))
        .isMongoId()
        .withMessage(errorMessage.INVALID.replace(':attribute', 'mentorId')),
    body('status')
        .notEmpty()
        .withMessage(errorMessage.REQUIRED.replace(":attribute", "status")),
    body('rejectReason')
        .optional({ nullable: true })
];