import express from 'express';
import multer from 'multer';
import { auth } from '../middleware/auth';
import { eventController } from '../Controller/event.controller';
let router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

router.post('/createEvent', eventController.createEvent);

router.post('/uploadAttachments', upload.single('eventAttachments'), eventController.uploadAttachmentsInEvent);

router.post('/myEvents', eventController.myEvents);

router.post('/allEvents', eventController.allEventList);

router.get('/guestList', eventController.guestListing);

router.post('/pendingApprove/list', eventController.pendingApprovalEventList);

router.post("/approveOrDecline", eventController.approveOrDeclineEvent)

router.post('/editEvent', eventController.editEvent)

router.post('/deleteEvent', eventController.deleteEvent)

router.get('/getEvent', eventController.getEvent)

router.post('/eventGuestCsv', eventController.eventGuestCSV)

router.post('/approveOrDecline/guestInvitation', eventController.approveOrDeclineEventGuestList)

router.post('/updateAttendanceStatus', eventController.updateAttendanceStatus)

router.post('/getGuestListForEvent', eventController.getGuestListForEvent)

router.post('/eventCSV', eventController.eventCSV)

router.post('/eventGuestList', eventController.eventGuestListV2)


export default router