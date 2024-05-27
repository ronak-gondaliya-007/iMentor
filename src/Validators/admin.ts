import { body, validationResult } from "express-validator";
import { errorMessage } from "../utils/const";

export let addUserValidation = [
  body('fname')
    .notEmpty()
    .withMessage(errorMessage.REQUIRED.replace(":attribute", "fname")),
  body('email')
    .notEmpty()
    .withMessage(errorMessage.REQUIRED.replace(":attribute", "email"))
    .isEmail()
    .withMessage(errorMessage.REQUIRED.replace(":attribute", "email")),
  // body('role')
  //   .notEmpty()
  //   .withMessage(errorMessage.REQUIRED.replace(":attribute", "role"))

]

export let adminLoginUserValidation = [
  body('email')
    .notEmpty()
    .withMessage(errorMessage.REQUIRED.replace(":attribute", "email")),
  body('password')
    .notEmpty()
    .withMessage(errorMessage.REQUIRED.replace(":attribute", "password"))
]

export let getMultipleUserValidation = [
  body('users')
    .isArray()
    .withMessage(errorMessage.ARRAY.replace(':attribute', "users"))
    .isArray({ min: 1 })
    .withMessage("Atleast one element required in array.")
]

export let adminUserListValidation = [
  body('search')
    .optional({ nullable: true }),
  body('adminType')
    .optional({ nullable: true }),
  body('status')
    .optional({ nullable: true })
    .isArray()
    .withMessage(errorMessage.ARRAY.replace(":attribute", "status")),
  body('regionOrPartner')
    .optional({ nullable: true })
    .isArray()
    .withMessage(errorMessage.ARRAY.replace(":attribute", "regionOrPartner")),
  body('sort')
    .optional({ nullable: true })
    .isObject()
    .withMessage(errorMessage.OBJECT.replace(":attribute", "sort"))
]

export let deleteAdminsValidation = [
  body('users')
    .notEmpty()
    .withMessage(errorMessage.REQUIRED.replace(":attribute", 'users'))
    .isArray()
    .withMessage(errorMessage.ARRAY.replace(":attribute", 'users'))
]

// export let getAdminUserValidation = [
//   body('userId')
//     .notEmpty()
//     .withMessage(errorMessage.REQUIRED.replace(":attribute", 'userId'))
// ]

export let createPasswordValidation = [
  body('userId')
    .notEmpty()
    .withMessage(errorMessage.REQUIRED.replace(":attribute", "userId")),
  body('password')
    .notEmpty()
    .withMessage(errorMessage.REQUIRED.replace(":attribute", 'password')),
  body('confirmPassword')
    .notEmpty()
    .withMessage(errorMessage.REQUIRED.replace(":attribute", 'confirmPassword'))
]

export let checkUser = [
  body('email')
    .notEmpty()
    .withMessage(errorMessage.REQUIRED.replace(":attribute", "email"))
    .isEmail()
    .withMessage("Email should be in proper format."),
]

export let registerAdminValidation = [
  body('email')
    .notEmpty()
    .withMessage(errorMessage.REQUIRED.replace(":attribute", "email"))
    .isEmail()
    .withMessage("Email should be in proper format."),
  body('password')
    .notEmpty()
    .withMessage(errorMessage.REQUIRED.replace(":attribute", 'password')),
  body('confirmPassword')
    .notEmpty()
    .withMessage(errorMessage.REQUIRED.replace(":attribute", 'confirmPassword'))
]

export let changePasswordValidation = [
  body('userId')
    .notEmpty()
    .withMessage(errorMessage.REQUIRED.replace(":attribute", "userId")),
  body('currentPassword')
    .notEmpty()
    .withMessage(errorMessage.REQUIRED.replace(":attribute", "currentPassword")),
  body('newPassword')
    .notEmpty()
    .withMessage(errorMessage.REQUIRED.replace(":attribute", "newPassword")),
]