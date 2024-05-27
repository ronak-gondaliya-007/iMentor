import { body } from "express-validator";
import { errorMessage } from "../utils/const";

export let addRegionValidator = [
    body("region")
        .notEmpty()
        .withMessage(errorMessage.REQUIRED.replace(':attribute', 'region')),
    body("city")
        .optional({ nullable: true }),
    body("assignedSchoolInstitution")
        .optional({ nullable: true }),
    body("defaultTrainingId")
        .optional({ nullable: true })
        .isMongoId()
        .withMessage(errorMessage.INVALID.replace(":attribute", "defaultTrainingId")),
]