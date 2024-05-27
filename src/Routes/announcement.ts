import express, { Request, Response } from "express";
import { announcementController } from "../Controller/announcementMessage.controller";
import { auth } from "../middleware/auth";
let router = express.Router();

router.post("/addAnnouncementMessage", auth, announcementController.addAnnouncementMessage);
router.post("/getAnnouncementMessage", auth, announcementController.getAnnouncementMessage);
router.post("/getSingleAnnoucemnt", auth, announcementController.getSingleAnnoucemnt);
router.post("/updateAnnouncementMessage", auth, announcementController.updateAnnouncementMessage);
router.post("/deleteAnnouncementMessage", auth, announcementController.deleteAnnouncementMessage);
router.post("/getRecipientList", auth, announcementController.getRecipientList);
router.post("/sendMessage", auth, announcementController.sendMessage);
router.post("/changeDraftStatus", auth, announcementController.changeDraftStatus);
router.post("/addIntroductoryMessage", auth, announcementController.addIntroductoryMessage)

export default router;