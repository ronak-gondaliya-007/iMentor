import express, { NextFunction, Request, Response } from 'express';
import { authController } from '../../Controller/Web/auth.controller';
import { auth } from '../../middleware/auth';
import validate from '../../middleware/validate';
import {
    registrationValidation, mentorLoginUserValidation, requestResetPasswordValidation, forgotPasswordValidation, updateMentorBasicInfoDraftValidation, updateMentorBasicInfoValidation, updateOnboardingDetailsValidation,
    getUserEmailValidation, loginViaTokenValidation, updateMenteeBasicInfoDraftValidation, updateMenteeBasicInfoValidation, createInquiryValidation, changePasswordValidation, userProfileUpdateValidation,
    updateDeviceInfoValidation, logoutValidation, updateMessageNotificationStatusValidation
} from '../../Validators/Web/auth';
import multer from 'multer';
import { userRoleConstant } from '../../utils/const';

let router = express.Router();

const upload = multer({ storage: multer.memoryStorage() });

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, "./uploads" + "/MentorFile");
    },
    filename: function (req, file, cb) {
        cb(null, file.fieldname + "_" + Date.now());
    },
});

const uploadFile = multer({ storage: storage });

router.post('/getUserEmail', validate(getUserEmailValidation), authController.getUserEmail);

router.post('/register', validate(registrationValidation), authController.registration);

router.get('/completeRegistration', auth, authController.completeRegistration);

router.post('/login', validate(mentorLoginUserValidation), authController.login);

router.post('/loginViaToken', validate(loginViaTokenValidation), authController.loginViaToken);

router.post('/logout', auth, validate(logoutValidation), authController.logout)

router.post('/requestResetPassword', validate(requestResetPasswordValidation), authController.requestResetPassword);

router.post('/forgotPassword', validate(forgotPasswordValidation), authController.forgotPassword);

router.post('/changePassword', auth, validate(changePasswordValidation), authController.changePassword);

router.post('/userProfileUpdate', auth, validate(userProfileUpdateValidation), authController.userProfileUpdate);

router.post('/updateUserBasicInfo', auth, function (req: any, res: Response, next: NextFunction) {
    if (req.body.isDraft == true) {
        if (req.user.role == userRoleConstant.MENTOR) {
            validate(updateMentorBasicInfoDraftValidation)
            next()
        } else if (req.user.role == userRoleConstant.MENTEE) {
            validate(updateMenteeBasicInfoDraftValidation)
            next()
        }
    } else {
        if (req.user.role == userRoleConstant.MENTOR) {
            validate(updateMentorBasicInfoValidation)
            next()
        } else if (req.user.role == userRoleConstant.MENTEE) {
            validate(updateMenteeBasicInfoValidation)
            next()
        }
    }
}, authController.updateUserBasicInfo);

router.post('/updateOnboardingDetails', auth, validate(updateOnboardingDetailsValidation), authController.updateOnboardingDetails);

router.get('/applicationComplete', auth, authController.applicationComplete);

router.post('/uploadUserProfilePic', auth, upload.single('mentorProfilePic'), authController.uploadUserProfilePic);

router.get('/getStateList', auth, authController.getStateList);

router.get('/getUserDetail', auth, authController.getUserDetail);

router.post('/schoolOrInstituteList', auth, authController.schoolOrInstituteList);

router.post('/createInquiry', validate(createInquiryValidation), authController.createInquiry);

router.post('/updateDeviceInfo', auth, validate(updateDeviceInfoValidation), authController.updateDeviceInfo);

router.post('/acceptCookies', auth, authController.acceptCookieForUser);

router.get('/all/schoolOrInstituteList', auth, authController.allSchoolOrInstituteList);

router.post('/addNewSchoolOrInstituteInApp', auth, authController.addNewSchoolOrInstituteInApp)

router.post('/updateMessageNotificationStatus', auth, validate(updateMessageNotificationStatusValidation), authController.updateMessageNotificationStatus)

export default router;