export const userRoleConstant = Object.freeze({
  I_SUPER_ADMIN: "Super Admin",
  I_LOCAL_ADMIN: "IM Local Admin",
  P_SUPER_ADMIN: "Partner Super Admin",
  P_LOCAL_ADMIN: "Partner Local Admin",
  MENTOR: "Mentor",
  MENTEE: "Mentee",
});

export const userRoleArray = ["Super Admin", "IM Local Admin", "Partner Super Admin", "Partner Local Admin", "Mentor", "Mentee",]

export let userStatusConstant = Object.freeze({
  ACTIVE: "Active",
  PENDING: "Pending",
  REJECT: "Reject",
  inProgress: "In Progress",
  invited: 'Invited',
  draft: 'Draft',
  Matched: 'Matched',
  Completed: 'Pre-Match Pending',
  Not_Started: 'Not Started',
  Matching: 'Matching',
  MATCHED_NOT_REGISTERED: 'Matched Not Registered'
});

export let categoryOfQuestion = Object.freeze({
  PERSONALITY_AND_INTERESTS: "Personality & Interests",
  CREEAR_AND_EXPERIENCE: "Career & Experience",
  EDUCATION_INFORMATION: "Education Information",
});

export let quentionType = Object.freeze({
  SINGLE_CHOICE: "Single Choice",
  MULTI_CHOICE: "Multi Choice",
  DROP_DOWN: "Drop Down Option",
  DROP_DOWN_MULTI_SELECT: 'Drop Down Multi Select'
});

export let quentionStatus = ["Active", "Draft", "Archived"];

export let questionState = Object.freeze({
  ACTIVE: "Active",
  ARCHIVE: "Archive",
  DRAFT: "Draft"
});

export let errorMessage = Object.freeze({
  REQUIRED: "The :attribute field is required.",
  INVALID: "The selected :attribute is invalid.",
  NUMERIC: "The :attribute must be a number.",
  DATE: "The :attribute must be a date.",
  BETWEEN: "The :attribute must be between :min to :max.",
  NOT_EXISTS: ":attribute does not exist.",
  ALPHA_NUMERIC: "The :attribute field must be contains only alpha numeric value.",
  MIN: "The :attribute must be at least :min characters.",
  BOOLEAN: "The :attribute must be a true or false.",
  IN: "The :attribute must be one of :values.",
  INVALID_FORMAT: "The :attribute must be in :format format.",
  GRATER: "The :attribute must be greater than :another.",
  ALREADY_EXISTS: "This :attribute is already exists.",
  ARRAY: "The :attribute must be an array.",
  OBJECT: "The :attribute must be an object.",
  EXACT: `The length of :attribute must be :value.`,
  GRATER_OR_EQUAL: "The :attribute must be :another or greater.",
  FILE_TYPE: "The type of :attribute must be :values.",
  MAX_FILE_SIZE: "Please select a :attribute which has a size upto :value.",
  MAX: "The length :attribute may not be greater than :value.",
  IMAGE_DIMENSTIONS: "The dimenstions of :attribute must be :format.",
  MAX_UPLOAD_FILE: "The maximum :attribute may not be greater than :value.",
  PLEASE_VALID: "Please enter valid :attribute.",
  INSUFFICIENT_BALANCE: ":attribute not enough balance.",
  MAXIMUM: "The :attribute may not be greater than :value.",
  NOT_SAME: "The :attribute must be different.",
  NOT_SAME_VALUE: "The :attribute1 and :attribute2 must be different.",
  MINIMUM: "The :attribute may not be smaller than :value.",
  ALREADY: "This :attribute is already :value.",
  MIN_AMOUNT: "Please add minimum :min amount to apply this :value.",
  INVALID_OR_EXPIRE: "The selected :attribute is invalid or expired.",
  IS_NOT_SAME: "The :attribute is not :value.",
  MAX_STRING: "The :attribute may not be greater than :max characters.",
  LIMIT_EXCEED: "You have reached your maximum limit of :value.",
  PLEASE_ADD_BEFORE: "Please add :attribute before :action :value.",
  ARRAY_WITH_MIN: "The :attribute must be an array and contains atleast :min elements.",
  FLAG_OFF: "The :attribute feature is disable.",
  ALREADY_IN_USE: "This :attribute already in used.",
  MINIMUM_AMOUNT: "Please add minimum :min amount.",
  SOMETHING_WENT_WRONG: "Something went wrong in :attribute.",
  CANCEL_DELETE_ACCOUNT: "The :attribute cancel account deletion time period is expired.",
  PENDING: "You can not :action this :attribute because some pending :value.",
  PLEASE_DO_BEFORE: "Please :action :attribute before :action2 :value.",
  REJECT: ":attribute has been rejected.",
  ACTION: `:attribute can't perform this action`,
  EXPIRED: ":attribute is expired.",
  NOT_ACCESS: 'You have not right to perfome this action.',
  NOT_PERFOME_ACTION: `:attribute can't :action.`,
  ATLEAST_VALUE: 'Please select atleast :value.',
  UNABLE_SET_DEFAULT_TRAINING: 'Unable to change default for this training at this point. Please contact support.',
  UNABLE_ARCHIVE: 'Unable to archive this :attribute at this point. Please contact support.',
  UNABLE_UNASSIGN_TRAINING: 'Unable to unassign this training at this point. Please contact support.',
  UNABLE_REMOVE: 'Unable to remove this :attribute at this point. Please contact support.',
});

export let successMessage = Object.freeze({
  CREATE_SUCCESS: ":attribute has been created successfully.",
  UPDATE_SUCCESS: ":attribute has been updated successfully.",
  FETCH_SUCCESS: ":attribute has been fetched successfully.",
  DELETE_SUCCESS: ":attribute has been deleted successfully.",
  ARCHIVE_SUCCESS: ":attribute has been archived!.",
  UNARCHIVE_SUCCESS: ":attribute has been unarchived successfully.",
  CHECKED_SUCCESS: ":attribute has been checked successfully.",
  BLOCK_SUCCESS: ":attribute has been blocked successfully.",
  UNBLOCK_SUCCESS: ":attribute has been unblocked successfully.",
  SEND_SUCCESS: ":attribute has been sent successfully.",
  DEDUCT_SUCCESS: ":attribute has been deducted successfully.",
  SUBMIT_SUCCESS: ":attribute has been submited successfully.",
  ADD_SUCCESS: "The :attribute has been successfully added.",
  RESOLVE_SUCCESS: ":attribute has been resolved successfully.",
  LINK_SUCCESS: ":attribute has been linked successfully.",
  UNLINK_SUCCESS: ":attribute has been unlinked successfully.",
  VERIFY_SUCCESS: ":attribute has been verified successfully.",
  UPLOAD_SUCCESS: ":attribute has been uploaded successfully.",
  CANCEL_SUCCESS: ":attribute has been canceled successfully.",
  ACTIVE_SUCCESS: ":attribute has been activated successfully.",
  DEACTIVE_SUCCESS: ":attribute has been deactivated successfully.",
  READ_SUCCESS: ":attribute has been readed successfully.",
  TURN_ON_SUCCESS: ":attribute has been turned on successfully.",
  TURN_OFF_SUCCESS: ":attribute has been turned off successfully.",
  REFUND_SUCCESS: ":attribute has been refunded successfully.",
  APPROVE_SUCESS: ":attribute has been approved successfully.",
  REMOVE: ":attribute has been successfully removed.",
  DISABLE_SUCCESS: ":attribute was successfully disabled!",
  ACTIVATE_SUCCESS: ":attribute has been successfully activated.",
  DECLINE_SUCCESS: ":attribute has been successfully declined.",
  ASSIGN_SUCCESS: ":attribute has been successfully assigned.",
  RECOMMENDED_SUCCESS: ":attribute has been successfully recommended.",
  DRAFT_MESSAGE: ":attribute saved as a draft.",
  SAVE_SUCCESS: ":attribute have been saved.",
  NOT_FOUND: ":attribute has been not found.",
  FEVORITE_SUCCESS: ":attribute has been favorited successfully.",
  UNASSIGN_SUCCESS: ":attribute has been successfully unassigned.",
  REMOVE_SUCCESS: ":attribute has been removed successfully.",
  REJECT_SUCCESS: ":attribute has been rejected successfully.",
  ACCEPTED_SUCCESS: ":attribute has been accepted successfully"
});

export let figmaSuccessMessage = Object.freeze({
  CREATE_SUCCESS: ":attribute was successfully created",
  REMOVE_SUCCESS: ":attribute was successfully removed",
  RECOMMENDED_SUCCESS: "Recommendation has been sent!",
});

export let statusCode = Object.freeze({
  CONTINUE: 100,
  OK: 200,
  CREATED: 201,
  ACCEPTED: 202,
  NON_AUTHORITATIVE_INFORMATION: 203,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  PAYMENT_REQUIRED: 402,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  METHOD_NOT_ALLOWED: 405,
  NOT_ACCEPTABLE: 406,
  PROXY_AUTHENTICATION_REQUIRED: 407,
  REQUEST_TIMEOUT: 408,
  CONFLICT: 409,
  GONE: 410,
  LENGTH_REQUIRED: 411,
  PAYLOAD_TOO_LARGE: 413,
  URI_TOO_LONG: 414,
  UNSUPPORTED_MEDIA_TYPE: 415,
  RANGE_NOT_SATISFIABLE: 416,
  EXPECTATION_FAILED: 417,
  IM_A_TEAPOT: 418,
  MISDIRECTED_REQUEST: 421,
  UNPROCESSABLE_ENTITY: 422,
  LOCKED: 423,
  FAILED_DEPENDENCY: 424,
  TOO_EARLY: 425,
  UPGRADE_REQUIRED: 426,
  PRECONDITION_REQUIRED: 428,
  TOO_MANY_REQUESTS: 429,
  REQUEST_HEADER_FIELDS_TOO_LARGE: 431,
  UNAVAILABLE_FOR_LEGAL_REASONS: 451,
  INTERNAL_SERVER_ERROR: 500,
  NOT_IMPLEMENTED: 501,
  BAD_GATEWAY: 502,
  SERVICE_UNAVAILABLE: 503,
  GATEWAY_TIMEOUT: 504,
  HTTP_VERSION_NOT_SUPPORTED: 505,
  VARIANT_ALSO_NEGOTIATES: 506,
  INSUFFICIENT_STORAGE: 507,
  LOOP_DETECTED: 508,
  BANDWIDTH_LIMIT_EXCEEDED: 509,
  NOT_EXTENDED: 510,
  NETWORK_AUTHENTICATION_REQUIRED: 511,
});

export let uploadConstant = Object.freeze({
  PROFILE_PIC_FILE_SIZE: 5, // 5 MB
  PROFILE_PIC_EXT_ARRAY: ['.jpg', '.jpeg', '.png'],
  CSV_FILE_EXT_ARR: ['.csv'],
  EVENT_THUMBNAIL_EXT_ARRAY: ['.jpg', '.jpeg', '.png'],
  FILE_UPLOAD_EXT_ARR: ['.jpg', '.jpeg', '.png', '.doc', '.docx', '.csv', '.xlsx', '.ppt', '.pdf', '.mp3', '.mp4', '.pptx', '.heic'],
  CONTENT_DOC_FILE_SIZE: 25, // 25 MB,
  CONTENT_DOC_EXT_ARRAY: ['.jpg', '.jpeg', '.png', '.pdf', '.doc', '.xlsx', '.xls'],
  CONTENT_AUDIO_VIDEO_FILE_SIZE: 250, // 250 MB,
  CONTENT_AUDIO_VIDEO_EXT_ARRAY: ['.mp3', '.mp4',],
});

export let messageConstant = Object.freeze({
  mentorMessage: 'Mentor Message',
  menteeMessage: "Mentee Message",
  groupMessage: 'Group Message',
  announcementMessage: 'Announcement',
  rejectMessage: 'Reject Message'
});

export let eventStatusConstant = Object.freeze({
  PENDING: "Pending",
  APPROVED: "Approved",
  DECLINED: "Declined"
})

export let eventAcceptenceTypeConstant = Object.freeze({
  ATTENDED: "Attended",
  NOSHOW: "Did Not Attend",
  UNTRACKED: "Untracked"
})

export let eventTypeConstant = Object.freeze({
  REGULAR: "Regular",
  ORIENTATION: "Orientation",
  SCREENING: "Screening"
})

export let defaultProfilePicConstant = Object.freeze({
  USER_PROFILE_PIC: "https://artoon-imentor-data-dev.s3.amazonaws.com/iMentor/defaultProfilePic/file-1691823332144-iStock-476085198.jpg"
});

export const ContentConstants = Object.freeze({
  TRAINING_KEYWORD: 'I Mentor Training',
  COURSES_TYPE_ARRAY: ['Training', 'Project'],
  RECOMMENDED_COURSES_TYPE_ARRAY: ['Training', 'Project', 'Content'],
  COURSES_TYPE: {
    training: 'Training',
    project: 'Project',
    content: 'Content'
  },
  ALLOWED_ALL_COURSES_USERS: ['Super Admin'],
  ASSIGNED_USER_TYPES_ARRAY: ['Partner', 'Region'],
  ASSIGNED_USER_TYPES: {
    partner: 'Partner',
    region: 'Region'
  },
  RECOMMENDED_MESSAGE: 'New recommended',
  CONTENT_CATEGORY_ARRAY: ['Read', 'Audio', 'Video', 'Link'],
  CONTENT_CATEGORY: {
    read: 'Read',
    audio: 'Audio',
    video: 'Video',
    link: 'Link'
  },
  CONTENT_TYPE_ARRAY: ['Case Study', 'Training', 'Webinar', 'Tutorial', 'Article'],
  ASSIGNED_COURSE_STATUS: {
    published: 'published',
    draft: 'draft'
  }
})

export let msg_Type = Object.freeze({
  MESSAGE: "Message",
  INTRO_MESSAGE: "IntroMessage",
  EVENT: "Event",
  MEDIA: "Media",
  PROJECT: "Project",
  FILE: "File",
  ANNOUNCEMENT: "Announcement",
  PRE_MATCH_ANNOUNCEMENT: "Pre-Match Announcement",
  BADGE: "Badge",
  TRAINING: "Training",
  CONTENT: "Content",
  LINK: "Link"
});

export let messageUploadConstant = Object.freeze({
  MESSAGE_FILE_SIZE: 5, // 5 MB
  MESSAGE_EXT_ARRAY: [".jpg", ".jpeg", ".png", ".pdf", ".word", ".ppt", ".xlsx", ".mp3", ".webm", ".csv"],
});

export let statusType = Object.freeze({
  INVITED: "Invited", // Sent Invitation
  DRAFT: "Draft",// Before Send Invitation
  NOT_STARTED: "Not Started", // After Signup Successful
  IN_PROGRESS: "In Progress", // Onboarding Steps not complete
  COMPLETED: "Pre-Match Pending", // Application Completed
  MATCHING: "Matching", // After Step 4 Complete
  MATCHED: "Matched", // Pair Create
  MATCHED_NOT_REGISTERED: "Matched Not Registered"
});

export let announcement_msg = Object.freeze({
  PRE_MATCH_ANNOUNCE: "Welcome to iMentor, We match mentors and mentees based on shared interests, experiences and goals. Complete Pre-Match To Do List to meet your perfect matches."
});

export let notificationMessage = Object.freeze({
  eventApproval: "has created the event. Please check their approval request.",
  eventApproved: "Your administrator has approved the event request.",
  eventNotApproved: "Your administrator has rejected the event request.",
  eventInvitation: "invited you to an Event",
  sendReminder: "Reminder: ",
  announcement: "Admin posted an Announcement",
  updateAnnouncement: "Admin update posted an Announcement",
  deleteAnnouncement: "Admin delete posted an Announcement",
  project: "Admin assigned you a Project",
  training: "Admin assigned you a Training",
  completedProject: "completed the assigned Project",
  sendMessage: "sent you a message.",
  reactMessage: "reacted on your :attribute.",
  matched: "You have been matched. Click here to view more.",
  invitationApproved: "has accepted the event.",
  invitationDeclined: "has declined the event."
});

export let notificationType = Object.freeze({
  EVENT_APPROVAL: "eventApproval",
  EVENT_DECLINE: "eventDecline",
  EVENT_APPROVED: "eventApproved",
  EVENT_INVITED: "eventInvited",
  REMINDER: "Reminder",
  COURSE_COMPLETED: "CourseCompleted",
  ANNOUNCEMENT: "Announcement",
  MATCHED: "Matched",
  MESSAGE: "Message",
  REACTION: "Reaction",
  INVITATION_APPROVED: "InvitationApproved",
  INVITATION_DECLINE: "InvitationDeclined",
  EVENT: "Event",
  ASSIGNED_PROJECT: "AssignProject",
  ASSIGNED_TRAINING: "AssignTraining"
});

export let reminder_status = Object.freeze({
  PROCESS: "Process",
  COMPLETED: "Completed",
  FAILED: "Failed",
  DELETED: "Deleted"
});

export let uploadEventConstant = Object.freeze({
  FILE_SIZE: 5, // 5 MB
  EVENT_ATTACHMENT_EXT_ARRAY: [".jpg", ".jpeg", ".png", ".pdf"],
  EVENT_THUMBNAIL_EXT_ARRAY: [".jpg", ".jpeg", ".png"],
});

export let event_status = Object.freeze({
  PENDING: "Pending",
  APPROVED: "Approved",
  DECLINED: "Declined"
});

export let course_type = Object.freeze({
  PROJECT: "Project",
  TRAINING: "Training",
  CONTENT: "Content"
});

export let badge_type = Object.freeze({
  SYSTEM: "System",
  CUSTOM: "Custom"
});

export let badges = Object.freeze({
  MATCHED: "Matched",
  FMS: "First Message Sent",
  FER: "First Event RVSP",
  FTM: "First Time Meeting",
  AC: "Application Completed",
  PC: "Project Completed",
  HFM: "High Five: Messages",
  HFMU: "High Five: Meeting Up"
});

export const announcementTypeConstant = Object.freeze({
  GROUP: "Group",
  PAIR: "Pair",
  MENTOR: "Mentor",
  MENTEE: "Mentee",
  MIX: "Mix"
});

export const questionConst = Object.freeze({
  School_Question: "At what schools (colleges and graduate schools) did you study?"
})

export const User_Activity = Object.freeze({
  CREATE_PARTNER: 'Create New Partner',
  CREATE_BULK_PARTNER: 'Create Bulk New Partners',
  PARTNER_LOGO_UPDATED: 'Partner Logo Updated',
  PARTNER_DATA_UPDATED: 'Partner Detail Updated',
  ADD_NEW_SCHOOL: 'Add New School & Institute',
  REMOVE_NEW_SCHOOL: 'Removed School & Institute',
  CREATE_REGION: 'Create New Region',
  CREATE_BULK_REGION: 'Create Bulk New Regions',
  REGION_LOGO_UPDATED: 'Region Logo Updated',
  REGION_DATA_UPDATED: 'Region Detail Updated',
  CREATE_NEW_MENTOR: 'Create New Mentor',
  MENTOR_LOGO_UPDATED: 'Mentor Logo Updated',
  MENTOR_DATA_UPDATED: 'Mentor Detail Updated',
  MENTOR_DELETED: 'Mentor User Deleted',
  MULTIPLE_MENTOR_DELETED: 'Multiple Mentor User Deleted',
  MENTOR_INQUIRY_REQUEST_STATUS_UPDATED: 'Mentor Inquiry Request Status Updated',
  SEND_MESSAGE_TO_MENTOR: 'Send Message Mentor',
  MENTOR_GHOST_LOGIN: 'Ghost Login Mentor',
  CREATE_BULK_MENTOR: 'Create Bulk Mentors',
  CREATE_NEW_MENTEE: 'Create New Mentee',
  MENTEE_LOGO_UPDATED: 'Mentee Logo Updated',
  MENTEE_DATA_UPDATED: 'Mentee Detail Updated',
  MENTEE_ACTIVATED: 'Mentee User Activated',
  MULTIPLE_MENTEE_ACTIVATED: 'Multiple Mentees User Activated',
  MENTEE_DEACTIVATED: 'Mentee User Deactivated',
  MULTIPLE_MENTEE_DEACTIVATED: 'Multiple Mentees User Deactivated',
  MENTEE_DELETED: 'Mentee User Deleted',
  MULTIPLE_MENTEE_DELETED: 'Multiple Mentees User Deleted',
  SEND_MESSAGE_TO_MENTEE: 'Send Message Mentee',
  MENTEE_GHOST_LOGIN: 'Ghost Login Mentee',
  CREATE_BULK_MENTEE: 'Create Bulk Mentees',
  SELECTED_PAIR: 'Mentor Mentee Create Pair',
  UNSELECTED_PAIR: 'Break Mentor Mentee Pair',
  CREATE_BULK_PAIR: 'Create Bulk Mentor/Mentee Pairs.',
  SEND_MESSAGE_PAIR: 'Send Message Mentor/Mentee Pair',
  SEND_MESSAGE_MENTORS: 'Send Message Pair Mentors',
  SEND_MESSAGE_MENTEES: 'Send Message Pair Mentees',
  CREATE_PS_ADMIN_USER: 'Create Partner Super Admin',
  CREATE_SUPER_ADMIN_USER: 'Create Super Admin',
  CREATE_IML_ADMIN_USER: 'Create IM Local Admin',
  REGISTER_ADMIN: 'Register as a :attributes',
  LOGIN: 'Login as a :attributes',
  ADMIN_USER_DELETED: ':attributes User Deleted',
  ADMIN_USER_UPDATED: ':attributes User Updated',
  CREATE_BULK_ADMINS: 'Create Bulk Admins',
  CHANGE_PASSWORD: ':attributes User Password Changed',
  CREATE_NEW_EVENT: 'Create New Event',
  APPROVED_NEW_EVENT: 'Aporoved New Event',
  REJECTED_NEW_EVENT: 'Rejected New Event',
  EVENT_UPDATED: 'Event Updated',
  EVENT_DELETED: 'Event Deleted',
  EVENT_GUEST_INVITATION_UPDATE: 'Event Guest Invitation Status Changed as a :attributes',
  EVENT_GUEST_ATTENDANCE_UPDATE: 'Event Guest Attendance Status Changed as a :attributes',
  CONTENT_ARCHIVED: 'Content Archived',
  CONTENT_UNARCHIVED: 'Content Unarchived',
  CONTENT_REMOVED: 'Content Removed',
  COURSE_ARCHIVED: 'Course Archived',
  COURSE_UNARCHIVED: 'Course Unarchived',
  CREATE_NEW_CONTENT: 'Create New Content',
  SET_DEFAULT_COURSE: 'Set as a Default Course',
  CONTENT_UPDATED: 'Content Updated',
});