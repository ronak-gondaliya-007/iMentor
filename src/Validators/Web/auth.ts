import { body, query } from "express-validator";
import { errorMessage } from "../../utils/const";

export let getUserEmailValidation = [
    body('userId')
        .notEmpty()
        .withMessage(errorMessage.REQUIRED.replace(":attribute", "userId"))
        .isMongoId()
        .withMessage("userId must be MongoId.")
];

export let registrationValidation = [
    body("email")
        .notEmpty()
        .isEmail()
        .withMessage(errorMessage.REQUIRED.replace(':attribute', 'email')),
    body('password')
        .notEmpty()
        .withMessage(errorMessage.REQUIRED.replace(":attribute", "password")),
    body('confirmPassword')
        .notEmpty()
        .withMessage(errorMessage.REQUIRED.replace(":attribute", "confirmPassword")),
];

export let mentorLoginUserValidation = [
    body('email')
        .notEmpty()
        .withMessage(errorMessage.REQUIRED.replace(":attribute", "email")),
    body('password')
        .notEmpty()
        .withMessage(errorMessage.REQUIRED.replace(":attribute", "password")),
];

export let loginViaTokenValidation = [
    query('token')
        .notEmpty()
        .withMessage('Token must not be empty.')
];

export let requestResetPasswordValidation = [
    body('email')
        .notEmpty()
        .withMessage(errorMessage.REQUIRED.replace(":attribute", "email"))
];

export let forgotPasswordValidation = [
    body('userId')
        .notEmpty()
        .withMessage(errorMessage.REQUIRED.replace(":attribute", "userId")),
    body('password')
        .notEmpty()
        .withMessage(errorMessage.REQUIRED.replace(":attribute", 'password')),
    body('confirmPassword')
        .notEmpty()
        .withMessage(errorMessage.REQUIRED.replace(":attribute", 'confirmPassword'))
];

export let changePasswordValidation = [
    body('newPassword')
        .notEmpty()
        .withMessage(errorMessage.REQUIRED.replace(":attribute", 'newPassword')),
    body('currentPassword')
        .notEmpty()
        .withMessage(errorMessage.REQUIRED.replace(":attribute", 'currentPassword'))
];

export let userProfileUpdateValidation = [
    body('first_name')
        .notEmpty()
        .withMessage(errorMessage.REQUIRED.replace(":attribute", 'first_name')),
    body('last_name')
        .notEmpty()
        .withMessage(errorMessage.REQUIRED.replace(":attribute", 'last_name')),
    body('phone_no')
        .notEmpty()
        .withMessage(errorMessage.REQUIRED.replace(":attribute", 'phone_no'))
];

export let updateMentorBasicInfoValidation = [
    body('mentorId')
        .notEmpty()
        .withMessage(errorMessage.REQUIRED.replace(":attribute", "mentorId")),
    body('fname')
        .notEmpty()
        .withMessage(errorMessage.REQUIRED.replace(":attribute", "fname")),
    body('lname')
        .notEmpty()
        .withMessage(errorMessage.REQUIRED.replace(":attribute", "lname")),
    body('preferredfname')
        .notEmpty()
        .withMessage(errorMessage.REQUIRED.replace(":attribute", "preferredfname")),
    body('preferredlname')
        .notEmpty()
        .withMessage(errorMessage.REQUIRED.replace(":attribute", "preferredlname")),
    body('pronounciationName')
        .optional(),
    body('dob')
        .notEmpty()
        .withMessage(errorMessage.REQUIRED.replace(":attribute", "dob")),
    body('email')
        .notEmpty()
        .withMessage(errorMessage.REQUIRED.replace(":attribute", "email")),
    body('recoveryEmail')
        .optional(),
    body('primaryPhoneNo')
        .notEmpty()
        .withMessage(errorMessage.REQUIRED.replace(":attribute", "primaryPhoneNo")),
    body('secondaryPhoneNo')
        .optional(),
    body('address.streetAddress1')
        .notEmpty()
        .withMessage(errorMessage.REQUIRED.replace(":attribute", "streetAddress1")),
    body('address.streetAddress2')
        .optional(),
    body('address.city')
        .notEmpty()
        .withMessage(errorMessage.REQUIRED.replace(":attribute", "city")),
    body('address.state')
        .notEmpty()
        .withMessage(errorMessage.REQUIRED.replace(":attribute", "state")),
    body('address.zipCode')
        .notEmpty()
        .withMessage(errorMessage.REQUIRED.replace(":attribute", "zipCode")),
    body('address.countryCode')
        .notEmpty()
        .withMessage(errorMessage.REQUIRED.replace(":attribute", "countryCode")),
    body('isDraft')
        .notEmpty()
        .isBoolean()
        .withMessage(errorMessage.REQUIRED.replace(":attribute", "isDraft")),
];

export let updateMenteeBasicInfoValidation = [
    body('mentorId')
        .notEmpty()
        .withMessage(errorMessage.REQUIRED.replace(":attribute", "mentorId")),
    body('fname')
        .notEmpty()
        .withMessage(errorMessage.REQUIRED.replace(":attribute", "fname")),
    body('lname')
        .notEmpty()
        .withMessage(errorMessage.REQUIRED.replace(":attribute", "lname")),
    body('preferredfname')
        .notEmpty()
        .withMessage(errorMessage.REQUIRED.replace(":attribute", "preferredfname")),
    body('preferredlname')
        .notEmpty()
        .withMessage(errorMessage.REQUIRED.replace(":attribute", "preferredlname")),
    body('pronounciationName')
        .optional(),
    body('dob')
        .notEmpty()
        .withMessage(errorMessage.REQUIRED.replace(":attribute", "dob")),
    body('email')
        .notEmpty()
        .withMessage(errorMessage.REQUIRED.replace(":attribute", "email")),
    body('recoveryEmail')
        .optional(),
    body('primaryPhoneNo')
        .notEmpty()
        .withMessage(errorMessage.REQUIRED.replace(":attribute", "primaryPhoneNo")),
    body('secondaryPhoneNo')
        .optional(),
    body('guardianFname')
        .notEmpty()
        .withMessage(errorMessage.REQUIRED.replace(":attribute", "guardianFname")),
    body('guardianLname')
        .notEmpty()
        .withMessage(errorMessage.REQUIRED.replace(":attribute", "guardianLname")),
    body('guardianEmail')
        .notEmpty()
        .withMessage(errorMessage.REQUIRED.replace(":attribute", "guardianEmail")),
    body('guardianPhone')
        .notEmpty()
        .withMessage(errorMessage.REQUIRED.replace(":attribute", "guardianPhone")),
    body('guardianSecondaryPhoneNo')
        .optional(),
    body('isSharedThisNumber')
        .notEmpty()
        .withMessage(errorMessage.REQUIRED.replace(":attribute", "isSharedThisNumber")),
    body('isSameAddress')
        .notEmpty()
        .withMessage(errorMessage.REQUIRED.replace(":attribute", "isSameAddress")),
    body('isParentBornInUnitedStates')
        .notEmpty()
        .withMessage(errorMessage.REQUIRED.replace(":attribute", "isParentBornInUnitedStates")),
    body('address.streetAddress1')
        .notEmpty()
        .withMessage(errorMessage.REQUIRED.replace(":attribute", "streetAddress1")),
    body('address.streetAddress2')
        .optional(),
    body('address.city')
        .notEmpty()
        .withMessage(errorMessage.REQUIRED.replace(":attribute", "city")),
    body('address.state')
        .notEmpty()
        .withMessage(errorMessage.REQUIRED.replace(":attribute", "state")),
    body('address.zipCode')
        .notEmpty()
        .withMessage(errorMessage.REQUIRED.replace(":attribute", "zipCode")),
    body('address.countryCode')
        .notEmpty()
        .withMessage(errorMessage.REQUIRED.replace(":attribute", "countryCode")),
    body('guardianAddress.streetAddress1')
        .notEmpty()
        .withMessage(errorMessage.REQUIRED.replace(":attribute", "streetAddress1")),
    body('guardianAddress.streetAddress2')
        .optional(),
    body('guardianAddress.city')
        .notEmpty()
        .withMessage(errorMessage.REQUIRED.replace(":attribute", "city")),
    body('guardianAddress.state')
        .notEmpty()
        .withMessage(errorMessage.REQUIRED.replace(":attribute", "state")),
    body('guardianAddress.zipCode')
        .notEmpty()
        .withMessage(errorMessage.REQUIRED.replace(":attribute", "zipCode")),
    body('isDraft')
        .notEmpty()
        .isBoolean()
        .withMessage(errorMessage.REQUIRED.replace(":attribute", "isDraft")),
];

export let updateMenteeBasicInfoDraftValidation = [
    body('mentorId')
        .notEmpty()
        .withMessage(errorMessage.REQUIRED.replace(":attribute", "mentorId")),
    body('fname')
        .optional(),
    body('lname')
        .optional(),
    body('preferredfname')
        .optional(),
    body('preferredlname')
        .optional(),
    body('pronounciationName')
        .optional(),
    body('dob')
        .optional(),
    body('email')
        .optional(),
    body('recoveryEmail')
        .optional(),
    body('primaryPhoneNo')
        .optional(),
    body('secondaryPhoneNo')
        .optional(),
    body('guardianFname')
        .optional(),
    body('guardianLname')
        .optional(),
    body('guardianEmail')
        .optional(),
    body('guardianPhone')
        .optional(),
    body('guardianSecondaryPhoneNo')
        .optional(),
    body('isSharedThisNumber')
        .optional(),
    body('isSameAddress')
        .optional(),
    body('isParentBornInUnitedStates')
        .optional(),
    body('address.streetAddress1')
        .optional(),
    body('address.streetAddress2')
        .optional(),
    body('address.city')
        .optional(),
    body('address.state')
        .optional(),
    body('address.zipCode')
        .optional(),
    body('address.countryCode')
        .optional(),
    body('guardianAddress.streetAddress1')
        .optional(),
    body('guardianAddress.streetAddress2')
        .optional(),
    body('guardianAddress.city')
        .optional(),
    body('guardianAddress.state')
        .optional(),
    body('guardianAddress.zipCode')
        .optional(),
    body('isDraft')
        .notEmpty()
        .isBoolean()
        .withMessage(errorMessage.REQUIRED.replace(":attribute", "isDraft")),
];

export let updateMentorBasicInfoDraftValidation = [
    body('mentorId')
        .notEmpty(),
    body('fname')
        .optional(),
    body('lname')
        .optional(),
    body('preferredfname')
        .optional(),
    body('preferredlname')
        .optional(),
    body('pronounciationName')
        .optional(),
    body('dob')
        .optional(),
    body('email')
        .optional(),
    body('recoveryEmail')
        .optional(),
    body('primaryPhoneNo')
        .optional(),
    body('secondaryPhoneNo')
        .optional(),
    body('address.streetAddress1')
        .optional(),
    body('address.streetAddress2')
        .optional(),
    body('address.city')
        .optional(),
    body('address.state')
        .optional(),
    body('address.zipCode')
        .optional(),
    body('address.countryCode')
        .optional(),
    body('isDraft')
        .notEmpty()
        .isBoolean()
        .withMessage(errorMessage.REQUIRED.replace(":attribute", "isDraft")),
];

export let updateOnboardingDetailsValidation = [
    body('mentorId')
        .notEmpty()
        .withMessage(errorMessage.REQUIRED.replace(":attribute", "mentorId")),
    body('programInfromation')
        .optional(),
    body('employerInformation')
        .optional(),
    body('demographicInformation')
        .optional(),
    body('preloadMentees')
        .optional(),
    body('references')
        .optional(),
    body('legalStatus')
        .optional(),
    body('physicalAndEmotionalCondition')
        .optional(),
    body('education_levels')
        .optional(),
    body('queAns')
        .optional(),
    body('step')
        .isNumeric()
        .withMessage(errorMessage.REQUIRED.replace(":attribute", "step")),
    body('isDraft')
        .isBoolean()
        .withMessage(errorMessage.REQUIRED.replace(":attribute", "isDraft")),
];

export let createInquiryValidation = [
    body('legalFname')
        .notEmpty()
        .withMessage(errorMessage.REQUIRED.replace(":attribute", "legalFname")),
    body('legalLname')
        .notEmpty()
        .withMessage(errorMessage.REQUIRED.replace(":attribute", "legalLname")),
    body('gender')
        .notEmpty()
        .withMessage(errorMessage.REQUIRED.replace(":attribute", "gender")),
    body('email')
        .notEmpty()
        .withMessage(errorMessage.REQUIRED.replace(":attribute", "email")),
    body('primaryPhoneNo')
        .notEmpty()
        .withMessage(errorMessage.REQUIRED.replace(":attribute", "primaryPhoneNo")),
    body('city')
        .notEmpty()
        .withMessage(errorMessage.REQUIRED.replace(":attribute", "city")),
    body('state')
        .notEmpty()
        .withMessage(errorMessage.REQUIRED.replace(":attribute", "state")),
    body('partnerAdmin')
        .notEmpty()
        .withMessage(errorMessage.REQUIRED.replace(":attribute", "partnerAdmin"))
];

export let updateDeviceInfoValidation = [
    body('deviceId')
        .notEmpty()
        .withMessage(errorMessage.REQUIRED.replace(":attribute", "deviceId")),
    body('deviceType')
        .notEmpty()
        .withMessage(errorMessage.REQUIRED.replace(":attribute", "deviceType")),
    body('systemNotification')
        .isBoolean()
        .withMessage(errorMessage.REQUIRED.replace(":attribute", "systemNotification")),
];

export let logoutValidation = [
    body('deviceId')
        .notEmpty()
        .withMessage(errorMessage.REQUIRED.replace(":attribute", "deviceId")),
    body('deviceType')
        .notEmpty()
        .withMessage(errorMessage.REQUIRED.replace(":attribute", "deviceType")),
];

export let updateMessageNotificationStatusValidation = [
    body('isEnable')
        .isBoolean()
        .withMessage(errorMessage.REQUIRED.replace(":attribute", "isEnable"))
];