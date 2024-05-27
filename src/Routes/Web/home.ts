import express from "express";
import { homeController } from "../../Controller/Web/home.controller";
import { auth } from "../../middleware/auth";
import validate from '../../middleware/validate';
import { setNewReminderValidation, editReminderValidation, updateReminderValidation, deleteReminderValidation } from '../../Validators/Web/home';

let router = express.Router();

router.get("/getAnnouncementMessage", auth, homeController.getAnnouncementMessage);

router.post('/setNewReminder', auth, validate(setNewReminderValidation), homeController.setNewReminder);

router.post('/editReminder', auth, validate(editReminderValidation), homeController.editReminder);

router.post('/updateReminder', auth, validate(updateReminderValidation), homeController.updateReminder);

router.post('/deleteReminder', auth, validate(deleteReminderValidation), homeController.deleteReminder);

router.get('/getReminders', auth, homeController.getReminders);

router.get('/getCalenderEventList', auth, homeController.getCalenderEventList);

router.post('/getDateWiseCalenderEventList', auth, homeController.getDateWiseCalenderEventList);

router.get("/projectAssignedList", auth, homeController.projectAssignedList);

export default router;
