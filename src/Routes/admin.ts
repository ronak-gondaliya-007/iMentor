import express, { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import { success, error } from "../utils/helpers/resSender"
import { findOne, insertOne } from '../utils/db';
import { encrypt, decrypt, generateToken } from '../utils/helpers/functions';
import multer from 'multer'
import { adminContrller } from '../Controller/admin.controller';
import { auth } from '../middleware/auth';;
import validate from '../middleware/validate';
import { addUserValidation, adminLoginUserValidation, adminUserListValidation, changePasswordValidation, checkUser, createPasswordValidation, deleteAdminsValidation, getMultipleUserValidation, registerAdminValidation } from '../Validators/admin';
let router = express.Router()

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, "./uploads" + "/UserCsv");
    },
    filename: function (req, file, cb) {
        cb(null, file.fieldname + "_" + Date.now());
    },
});
const upload = multer({ storage: storage });

router.post('/register/superAdmin', adminContrller.registration);

router.post('/login', validate(adminLoginUserValidation), adminContrller.login)

router.post('/addUser', auth, validate(addUserValidation), adminContrller.addUser)

router.get('/regionList', auth, adminContrller.regionListing)

router.post('/adminUserList', auth, validate(adminUserListValidation), adminContrller.adminUserList)

router.get("/filterList", adminContrller.filterList)

router.post('/deleteAdmin', auth, validate(deleteAdminsValidation), adminContrller.deleteAdmin)

router.get('/getAdminUser', adminContrller.getAdminUser)

router.post('/getMultiUser', validate(getMultipleUserValidation), adminContrller.getMultipleUserDetail);

router.put('/updateAdminUser', adminContrller.updateAdminUser)

router.get('/logout', auth, adminContrller.logoutAdminUser)

router.post('/resent/invitation', auth, adminContrller.resentInvitation)

router.post('/verifyOtp', adminContrller.verifyOTP)

router.post('/forgotPasswordInvitation', validate(checkUser), adminContrller.forgotPasswordInvitation)

router.post('/createPassword', validate(createPasswordValidation), adminContrller.createPassword)

router.post('/encrypt', adminContrller.encryptData)

router.post('/decrypt', adminContrller.decryptData)

router.post('/current/loggedIn/users', auth, adminContrller.currentLoggedInUsersList);

router.post('/loginAs', auth, adminContrller.loginAsAdminUser)

router.post('/remove/loggedInUser', auth, adminContrller.removeUserFromLoggedInUser)

router.post('/importUserFromCSV', auth, upload.single('adminCsv'), adminContrller.importUserFromCSV)

router.post('/sendMail', adminContrller.sendMailCheck)

router.get('/profileDetails', auth, adminContrller.getUserProfile);

router.post('/update/profileDetails', auth, adminContrller.updateProfileDetails)

router.post('/register', validate(registerAdminValidation), adminContrller.adminRegister);

router.post('/changePassword', auth, validate(changePasswordValidation), adminContrller.changePassword)
export default router