import express from "express";
import roleMiddleware from '../middleware/role';
import { ThinkificWebhookController } from "../Controller/thinkificWebhook.controller";
import validate from "../middleware/validate";
import { userRoleConstant } from "../utils/const";
import {
  createWebhook
} from '../Validators/thinkificWebhooks';

let router = express.Router();

router.post(
  "/createWebhook",
  roleMiddleware([userRoleConstant.I_SUPER_ADMIN]),
  validate(createWebhook),
  ThinkificWebhookController.createWebhook
);

export default router;