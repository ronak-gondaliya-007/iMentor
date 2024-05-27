import express from "express";
import {
    lessonCompletedWebhook,
    courseUpdatedWebhook,
    productUpdatedWebhook,
    productDeletedWebhook
} from "../services/thinkific/thinkific.service";

let router = express.Router();

router.post("/thinkific/lessonCompleted", lessonCompletedWebhook);
router.post("/thinkific/courseUpdated", courseUpdatedWebhook);
router.post("/thinkific/productUpdated", productUpdatedWebhook);
router.post("/thinkific/productDeleted", productDeletedWebhook);

export default router;