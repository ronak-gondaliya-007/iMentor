import express from 'express';
import { auth } from '../middleware/auth';
import { activityController } from '../Controller/activity.controller';
import validate from '../middleware/validate';
let router = express.Router()

router.post("/activityFeed", activityController.activityFeed);

router.post("/activityFeedProgressBar", activityController.activityFeedProgressBar)

// router.post('/pairReport', activityController.pairReport)

router.get('/filterOption', activityController.filterOption)

router.post('/pairReport', activityController.pairReportV2)


export default router