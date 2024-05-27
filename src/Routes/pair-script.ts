import express from "express";
import { pairScriptControllors } from "../Controller/pairScript.controller";
import { auth } from "../middleware/auth";
import roleMiddleware from '../middleware/role';
import { userRoleConstant } from "../utils/const";
let router = express.Router();

router.post('/getPartnerData',
    auth,
    roleMiddleware([
        userRoleConstant.I_SUPER_ADMIN,
        userRoleConstant.P_SUPER_ADMIN
    ]),
    pairScriptControllors.getPartnerData);

export default router;
