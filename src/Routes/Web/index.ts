import express from "express";
import authRoute from "./auth";
import mentorRoute from "./mentor";
import menteeRoute from "./mentee";
import eventRoute from "./event";
import homeRoute from "./home";
import progressRoute from "./progress";
import contentRoute from "./content";

let router = express.Router();

router.use("/auth", authRoute);
router.use("/mentor", mentorRoute);
router.use("/mentee", menteeRoute);
router.use("/event", eventRoute);
router.use("/home", homeRoute);
router.use("/progress", progressRoute);
router.use("/content", contentRoute);

export default router;
