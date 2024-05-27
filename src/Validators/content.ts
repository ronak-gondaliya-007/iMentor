import { body } from "express-validator";
import { errorMessage, ContentConstants } from "../utils/const";

export const getAllContents = [
  body('search')
    .optional({ nullable: true }),
  body('isArchived')
    .optional({ nullable: true }),
];

export const getCourseList = [
  body('courseType')
    .notEmpty()
    .withMessage(errorMessage.REQUIRED.replace(":attribute", "courseType"))
    .isIn(ContentConstants.COURSES_TYPE_ARRAY)
    .withMessage(errorMessage.IN.replace(":attribute", "courseType")
      .replace(':values', '[Training, Project]')),
  body('search')
    .optional({ nullable: true }),
  body('page')
    .optional({ nullable: true })
    .isNumeric()
    .withMessage(errorMessage.NUMERIC.replace(":attribute", "page")),
  body('limit')
    .optional({ nullable: true })
    .isNumeric()
    .withMessage(errorMessage.NUMERIC.replace(":attribute", "limit"))
];

export const assignCourse = [
  body('courseType')
    .notEmpty()
    .withMessage(errorMessage.REQUIRED.replace(":attribute", "courseType"))
    .isIn(ContentConstants.COURSES_TYPE_ARRAY)
    .withMessage(errorMessage.IN.replace(":attribute", "courseType")
      .replace(':values', '[Training, Project]')),
  body('assignedUserType')
    .notEmpty()
    .withMessage(errorMessage.REQUIRED.replace(":attribute", "assignedUserType"))
    .isIn(ContentConstants.ASSIGNED_USER_TYPES_ARRAY)
    .withMessage(errorMessage.IN.replace(":attribute", "assignedUserType")
      .replace(':values', '[Partner, Region]')),
  body('courseIds')
    .notEmpty()
    .withMessage(errorMessage.REQUIRED.replace(":attribute", "courseIds"))
    .isArray({ min: 1 })
    .withMessage(errorMessage.ARRAY_WITH_MIN.replace(':attribute', 'courseIds')
      .replace(':min', '1')),
  body('userIds')
    .notEmpty()
    .withMessage(errorMessage.REQUIRED.replace(':attribute', 'userIds'))
    .isArray({ min: 1 })
    .withMessage(errorMessage.ARRAY_WITH_MIN.replace(':attribute', 'userIds')
      .replace(':min', '1')),
  body('userIds.*')
    .isMongoId()
    .withMessage(errorMessage.INVALID.replace(':attribute', 'userIds')),
];

export const getAssignedCourseUsers = [
  body('courseType')
    .notEmpty()
    .withMessage(errorMessage.REQUIRED.replace(":attribute", "courseType"))
    .isIn(ContentConstants.COURSES_TYPE_ARRAY)
    .withMessage(errorMessage.IN.replace(":attribute", "courseType")
      .replace(':values', '[Training, Project]')),
  body('thinkificCourseId')
    .notEmpty()
    .withMessage(errorMessage.REQUIRED.replace(":attribute", "thinkificCourseId"))
    .isMongoId()
    .withMessage(errorMessage.INVALID.replace(':attribute', 'thinkificCourseId')),
  body('assignedUserType')
    .optional({ nullable: true })
    .isIn(ContentConstants.ASSIGNED_USER_TYPES_ARRAY)
    .withMessage(errorMessage.IN.replace(":attribute", "assignedUserType")
      .replace(':values', '[Partner, Region]')),
];

export const recommendedCourse = [
  body('courseIds')
    .notEmpty()
    .withMessage(errorMessage.REQUIRED.replace(":attribute", "courseIds"))
    .isArray()
    .withMessage(errorMessage.ARRAY_WITH_MIN.replace(':attribute', 'courseIds').replace(":min", "1"))
    .custom(async courseIds => {
      const isAllUnique = await !courseIds.some((v: string, i: number) => courseIds.indexOf(v) < i);

      if (!isAllUnique) {
        const errMsg = errorMessage.NOT_SAME.replace(':attribute', 'courseIds');
        throw new Error(errMsg);
      }
    }),
  body('courseType')
    .notEmpty()
    .withMessage(errorMessage.REQUIRED.replace(":attribute", "courseType"))
    .isIn(ContentConstants.RECOMMENDED_COURSES_TYPE_ARRAY)
    .withMessage(errorMessage.IN.replace(":attribute", "courseType")
      .replace(':values', '[Training, Project, Content]')),
  body('mentorMenteesIds')
    .optional({ nullable: true })
    .isArray()
    .withMessage(errorMessage.ARRAY.replace(':attribute', 'mentorMenteesIds'))
    .custom(async mentorMenteesIds => {
      const isAllUnique = await !mentorMenteesIds.some((v: string, i: number) => mentorMenteesIds.indexOf(v) < i);

      if (!isAllUnique) {
        const errMsg = errorMessage.NOT_SAME.replace(':attribute', 'mentorMenteesIds');
        throw new Error(errMsg);
      }
    }),
  body('mentorMenteesIds.*')
    .isMongoId()
    .withMessage(errorMessage.INVALID.replace(':attribute', 'mentorMenteesIds')),
  body('groupIds')
    .optional({ nullable: true })
    .isArray()
    .withMessage(errorMessage.ARRAY.replace(':attribute', 'groupIds'))
    .custom(async groupIds => {
      const isAllUnique = await !groupIds.some((v: string, i: number) => groupIds.indexOf(v) < i);

      if (!isAllUnique) {
        const errMsg = errorMessage.NOT_SAME.replace(':attribute', 'groupIds');
        throw new Error(errMsg);
      }
    }),
  body('groupIds.*')
    .isMongoId()
    .withMessage(errorMessage.INVALID.replace(':attribute', 'groupIds')),
  body('pairIds')
    .optional({ nullable: true })
    .isArray()
    .withMessage(errorMessage.ARRAY.replace(':attribute', 'pairIds'))
    .custom(async pairIds => {
      const isAllUnique = await !pairIds.some((v: string, i: number) => pairIds.indexOf(v) < i);

      if (!isAllUnique) {
        const errMsg = errorMessage.NOT_SAME.replace(':attribute', 'pairIds');
        throw new Error(errMsg);
      }
    }),
  body('pairIds.*')
    .isMongoId()
    .withMessage(errorMessage.INVALID.replace(':attribute', 'pairIds')),
  body('message')
    .optional({ nullable: true }),
];

export const createContent = [
  body('fileName')
    .notEmpty()
    .withMessage(errorMessage.REQUIRED.replace(":attribute", "fileName")),
  body('category')
    .notEmpty()
    .withMessage(errorMessage.REQUIRED.replace(":attribute", "category"))
    .isIn(ContentConstants.CONTENT_CATEGORY_ARRAY)
    .withMessage(errorMessage.IN.replace(":attribute", "category")
      .replace(':values', '[Read, Audio, Video, Link]')),
  body('type')
    .notEmpty()
    .withMessage(errorMessage.REQUIRED.replace(":attribute", "type"))
    .isIn(ContentConstants.CONTENT_TYPE_ARRAY)
    .withMessage(errorMessage.IN.replace(":attribute", "type")
      .replace(':values', '[Case Study, Training, Webinar, Tutorial, Article]')),
  body('contentFile')
    .if(body('category').not().equals(ContentConstants.CONTENT_CATEGORY.link))
    .notEmpty()
    .withMessage(errorMessage.REQUIRED.replace(":attribute", "contentFile")),
  body('contentLink')
    .if(body('category').equals(ContentConstants.CONTENT_CATEGORY.link))
    .notEmpty()
    .withMessage(errorMessage.REQUIRED.replace(":attribute", "contentLink")),
  body('thumbnailFile')
    .notEmpty()
    .withMessage(errorMessage.REQUIRED.replace(":attribute", "thumbnailFile"))
];

export const setDefaultCourse = [
  body('thinkificCourseId')
    .notEmpty()
    .withMessage(errorMessage.REQUIRED.replace(":attribute", "thinkificCourseId"))
];

export const updateContent = [
  body('contentId')
    .notEmpty()
    .withMessage(errorMessage.REQUIRED.replace(":attribute", "contentId"))
    .isMongoId()
    .withMessage(errorMessage.INVALID.replace(':attribute', 'contentId')),
  body('fileName')
    .notEmpty()
    .withMessage(errorMessage.REQUIRED.replace(":attribute", "fileName")),
  body('category')
    .notEmpty()
    .withMessage(errorMessage.REQUIRED.replace(":attribute", "category"))
    .isIn(ContentConstants.CONTENT_CATEGORY_ARRAY)
    .withMessage(errorMessage.IN.replace(":attribute", "category")
      .replace(':values', '[Read, Audio, Video, Link]')),
  body('type')
    .notEmpty()
    .withMessage(errorMessage.REQUIRED.replace(":attribute", "type"))
    .isIn(ContentConstants.CONTENT_TYPE_ARRAY)
    .withMessage(errorMessage.IN.replace(":attribute", "type")
      .replace(':values', '[Case Study, Training, Webinar, Tutorial, Article]')),
  body('contentFile')
    .if(body('category').not().equals(ContentConstants.CONTENT_CATEGORY.link))
    .notEmpty()
    .withMessage(errorMessage.REQUIRED.replace(":attribute", "content file")),
  body('contentLink')
    .if(body('category').equals(ContentConstants.CONTENT_CATEGORY.link))
    .notEmpty()
    .withMessage(errorMessage.REQUIRED.replace(":attribute", "content link")),
  body('thumbnailFile')
    .notEmpty()
    .withMessage(errorMessage.REQUIRED.replace(":attribute", "thumbnail file"))
];

export const archivedContent = [
  body('contentId')
    .notEmpty()
    .withMessage(errorMessage.REQUIRED.replace(':attribute', 'contentId'))
    .isMongoId()
    .withMessage(errorMessage.INVALID.replace(':attribute', 'contentId')),
  body('isArchived')
    .notEmpty()
    .withMessage(errorMessage.REQUIRED.replace(':attribute', 'isArchived'))
    .isBoolean()
    .withMessage(errorMessage.BOOLEAN.replace(":attribute", "isArchived")),
];

export const archivedCourse = [
  body('thinkificCourseId')
    .notEmpty()
    .withMessage(errorMessage.REQUIRED.replace(':attribute', 'thinkificCourseId'))
    .isMongoId()
    .withMessage(errorMessage.INVALID.replace(':attribute', 'thinkificCourseId')),
  body('isArchived')
    .notEmpty()
    .withMessage(errorMessage.REQUIRED.replace(':attribute', 'isArchived'))
    .isBoolean()
    .withMessage(errorMessage.BOOLEAN.replace(":attribute", "isArchived")),
];

export const unAssignCourse = [
  body('thinkificCourseId')
    .notEmpty()
    .withMessage(errorMessage.REQUIRED.replace(':attribute', 'thinkificCourseId'))
    .isMongoId()
    .withMessage(errorMessage.INVALID.replace(':attribute', 'thinkificCourseId')),
  body('assignedUserType')
    .notEmpty()
    .withMessage(errorMessage.REQUIRED.replace(":attribute", "assignedUserType"))
    .isIn(ContentConstants.ASSIGNED_USER_TYPES_ARRAY)
    .withMessage(errorMessage.IN.replace(":attribute", "assignedUserType")
      .replace(':values', '[Partner, Region]')),
  body('partnerIdOrRegionId')
    .notEmpty()
    .withMessage(errorMessage.REQUIRED.replace(':attribute', 'partnerIdOrRegionId'))
    .isMongoId()
    .withMessage(errorMessage.INVALID.replace(':attribute', 'partnerIdOrRegionId')),
];

export const removeContent = [
  body('contentId')
    .notEmpty()
    .withMessage(errorMessage.REQUIRED.replace(':attribute', 'contentId'))
    .isMongoId()
    .withMessage(errorMessage.INVALID.replace(':attribute', 'contentId'))
];

export const getThinkificCoursesForDropdown = [
  body('courseType')
    .notEmpty()
    .withMessage(errorMessage.REQUIRED.replace(":attribute", "courseType"))
    .isIn(ContentConstants.COURSES_TYPE_ARRAY)
    .withMessage(errorMessage.IN.replace(":attribute", "courseType")
      .replace(':values', '[Training, Project]')),
  body('isArchived')
    .optional({ nullable: true })
    .isBoolean()
    .withMessage(errorMessage.BOOLEAN.replace(":attribute", "isArchived")),
];

export let getContentURL = [
  body('courseId')
    .notEmpty()
    .withMessage(errorMessage.REQUIRED.replace(":attribute", "courseId"))
];

export const recommandUserList = [
  body('contentType')
    .optional({ nullable: true })
    .isIn(ContentConstants.RECOMMENDED_COURSES_TYPE_ARRAY)
    .withMessage(errorMessage.IN.replace(":attribute", "contentType")
      .replace(':values', '[Training, Project, Content]')),
  body('contentId')
    .optional({ nullable: true })
    .isMongoId()
    .withMessage(errorMessage.INVALID.replace(':attribute', 'contentId')),
];

export const getContent = [
  body('contentId')
    .notEmpty()
    .withMessage(errorMessage.REQUIRED.replace(":attribute", "contentId"))
    .isMongoId()
    .withMessage(errorMessage.INVALID.replace(':attribute', 'contentId')),
];

