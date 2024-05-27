import { body, param, query } from "express-validator";
import { errorMessage } from "../utils/const";

export let partnerCreate = [
  body("partnerName")
    .notEmpty()
    .withMessage("Partner Name Is Required !"),
  body("defaultTrainingId")
    .optional({ nullable: true })
    .isMongoId()
    .withMessage(errorMessage.INVALID.replace(":attribute", "defaultTrainingId")),
  
];

export let getPartner = [
  query("id")
    .notEmpty()
    .withMessage(errorMessage.REQUIRED.replace(":attribute", "id"))
    .isMongoId()
    .withMessage(errorMessage.INVALID.replace(":attribute", "id")),
];
export let addNewSchoolOrInstitute = [
  body("id")
    .notEmpty()
    .withMessage(errorMessage.REQUIRED.replace(":attribute", "id"))
    .isMongoId()
    .withMessage(errorMessage.INVALID.replace(":attribute", "id")),
  body("SchoolOrInstitute")
    .notEmpty()
    .withMessage(errorMessage.REQUIRED.replace(":attribute", "SchoolOrInstitute"))
    .isArray()
    .withMessage(errorMessage.INVALID.replace(":attribute", "SchoolOrInstitute")),
];
export let removeNewSchoolOrInstitute = [
  body("id")
    .notEmpty()
    .withMessage(errorMessage.REQUIRED.replace(":attribute", "id"))
    .isMongoId()
    .withMessage(errorMessage.INVALID.replace(":attribute", "id")),
  body("SchoolOrInstitute")
    .notEmpty()
    .withMessage(errorMessage.REQUIRED.replace(":attribute", "SchoolOrInstitute"))
    .isArray()
    .withMessage(errorMessage.INVALID.replace(":attribute", "SchoolOrInstitute")),
];
export let addNewSchoolOrInstituteInApp = [
  body("SchoolOrInstitute").notEmpty().withMessage(errorMessage.REQUIRED.replace(":attribute", "SchoolOrInstitute")),
];
export let partnerDelete = [
  body("id")
    .notEmpty()
    .withMessage(errorMessage.REQUIRED.replace(":attribute", "id"))
    .isArray()
    .withMessage(errorMessage.INVALID.replace(":attribute", "id")),
];
export let partnerEdit = [
  body("id").notEmpty().withMessage(errorMessage.REQUIRED.replace(":attribute", "id")),
  body("partnerName").notEmpty().withMessage(errorMessage.REQUIRED.replace(":attribute", "partnerName")),
  body("assignedSchoolOrInstitute")
    .notEmpty()
    .withMessage(errorMessage.REQUIRED.replace(":attribute", "assignedSchoolOrInstitute"))
    .isArray()
    .withMessage(errorMessage.INVALID.replace(":attribute", "assignedSchoolOrInstitute")),
  body("defaultTrainingId")
    .optional({ nullable: true })
    .isMongoId()
    .withMessage(errorMessage.INVALID.replace(":attribute", "defaultTrainingId")),
];
