import { body } from "express-validator";
import { replace } from "lodash";
import { errorMessage } from "../utils/const";

export let addGroupValidator = [
    body("groupName")
        .notEmpty()
        .withMessage(errorMessage.REQUIRED.replace(':attribute', 'groupName')),
    body("assignedSchoolOrInstitute")
        .notEmpty()
        .withMessage(errorMessage.REQUIRED.replace(':attribute', 'assignedSchoolOrInstitute')),
    body("groupMember")
        .optional({ nullable: true })
        .isArray()
        .withMessage(errorMessage.ARRAY.replace(':attribute', 'groupMember')),
    body("groupMember.pairs")
        .optional({ nullable: true })
        .isArray()
        .withMessage(errorMessage.ARRAY.replace(':attribute', 'groupMember.pairs')),
    body("groupMember.mentorAndMentees")
        .optional({ nullable: true })
        .isArray()
        .withMessage(errorMessage.ARRAY.replace(':attribute', 'groupMember.mentorAndMentees')),
    body("groupAdmin")
        .optional({ nullable: true })
        .isMongoId()
        .withMessage(errorMessage.INVALID.replace(':attribute', 'groupAdmin'))
]

export let getSingleGroupValidator = [
    body("groupId")
        .notEmpty()
        .withMessage(errorMessage.REQUIRED.replace(':attribute', 'groupId'))
        .isMongoId()
        .withMessage(errorMessage.INVALID.replace(':attribute', 'groupId')),
]

export let updateGroupValidator = [
    body("groupId")
        .notEmpty()
        .withMessage(errorMessage.REQUIRED.replace(':attribute', 'groupId'))
        .isMongoId()
        .withMessage(errorMessage.INVALID.replace(':attribute', 'groupId')),
    body("groupName")
        .notEmpty()
        .withMessage(errorMessage.REQUIRED.replace(':attribute', 'groupName')),
    body("assignedSchoolOrInstitute")
        .notEmpty()
        .withMessage(errorMessage.REQUIRED.replace(':attribute', 'assignedSchoolOrInstitute')),
    body("groupMember")
        .optional({ nullable: true })
        .isObject()
        .withMessage(errorMessage.OBJECT.replace(':attribute', 'groupMember')),
    body("groupMember.pairs")
        .optional({ nullable: true })
        .isArray()
        .withMessage(errorMessage.ARRAY.replace(':attribute', 'groupMember.pairs')),
    body("groupMember.mentorAndMentees")
        .optional({ nullable: true })
        .isArray()
        .withMessage(errorMessage.ARRAY.replace(':attribute', 'groupMember.mentorAndMentees')),
    body("groupAdmin")
        .optional({ nullable: true })
        .isMongoId()
        .withMessage(errorMessage.INVALID.replace(':attribute', 'groupAdmin'))
]

export let deleteGroupValidator = [
    body("groupId")
        .notEmpty()
        .withMessage(errorMessage.REQUIRED.replace(':attribute', 'groupId'))
        .isMongoId()
        .withMessage(errorMessage.INVALID.replace(':attribute', 'groupId')),
]

export let archiveGroupValidator = [
    body("groupId")
        .isArray()
        .withMessage(errorMessage.ARRAY.replace(":attrbute", "groupId"))
        .isArray({ min: 1 })
        .withMessage("Atleast one element required in array.")
]

