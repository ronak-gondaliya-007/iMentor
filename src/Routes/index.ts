import express from "express";
import script from "./script";
import adminRoute from "./admin";
import partnerRoute from "./partner";
import matcheRoute from "./matche";
import menteeRoute from "./mentee";
import { auth } from "../middleware/auth";
import mentorRoute from "./mentor";
import regionRoute from "./region";
import contentRoute from "./content";
import groupRoute from "./group";
import announcementRoute from "./announcement";
import eventRoute from './event'
import fileUplaodRoute from './fileUpload'
import webhookRoute from './webhook';
import thinkificWebhookRoute from './thinkificWebhooks';
import activityRoute from './activity';
import notesRoute from './notes';
import pairScript from './pair-script';

let router = express.Router();

router.use("/development", script);
router.use("/admin", adminRoute);
router.use("/partner", auth, partnerRoute);
router.use("/mentor", auth, mentorRoute);
router.use("/matche", auth, matcheRoute);
router.use("/mentee", auth, menteeRoute);
router.use("/region", auth, regionRoute);
router.use("/content", auth, contentRoute);
router.use("/group", auth, groupRoute);
router.use("/announcement", auth, announcementRoute)
router.use('/event', auth, eventRoute)
router.use('/file', fileUplaodRoute)
router.use('/webhook', webhookRoute)
router.use('/thinkificWebhooks', auth, thinkificWebhookRoute)
router.use('/activity', auth, activityRoute)
router.use('/note', auth, notesRoute)
router.use('/pair-script', pairScript)

export default router;
