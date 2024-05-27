import express, { Request, Response, NextFunction } from 'express';
import { eventController } from '../../Controller/Web/event.controller';
import { auth } from '../../middleware/auth';
import validate from '../../middleware/validate';
import {
    scheduleNewEventValidation, draftScheduleNewEventValidation, editScheduleEventValidation, updateScheduleEventValidation, deleteScheduleEventValidation, getScheduledEventValidation,
    scheduleEventListValidation, addInFavoriteEventValidation, eventGuestApprovalValidation
} from '../../Validators/Web/event';
import multer from 'multer';

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

router.post('/scheduleNewEvent', auth, function (req: Request, res: Response, next: NextFunction) {
    if (req.body.isDraft == true) {
        validate(draftScheduleNewEventValidation)
        next()
    } else {
        validate(scheduleEventListValidation)
        next()
    }
}, eventController.scheduleNewEvent);

router.get('/draftScheduleEvent', auth, eventController.draftScheduleEvent);

router.post('/editScheduleEvent', auth, validate(editScheduleEventValidation), eventController.editScheduleEvent);

router.post('/updateScheduleEvent', auth, validate(updateScheduleEventValidation), eventController.updateScheduleEvent);

router.post('/deleteScheduleEvent', auth, validate(deleteScheduleEventValidation), eventController.deleteScheduleEvent);

router.post('/getGuestList', auth, eventController.getGuestList);

router.post('/getInvitedGuestList', auth, eventController.getInvitedGuestList);

router.post('/getScheduledEvent', auth, validate(getScheduledEventValidation), eventController.getScheduledEvent);

router.post('/scheduleEventList', auth, validate(scheduleEventListValidation), eventController.scheduleEventList);

router.post('/addInFavoriteEvent', auth, validate(addInFavoriteEventValidation), eventController.addInFavoriteEvent);

router.post('/uploadEventAttachment', auth, upload.single('eventAttachment'), eventController.uploadEventAttachment);

router.post('/eventGuestApproval', auth, validate(eventGuestApprovalValidation), eventController.eventGuestApproval);

export default router;