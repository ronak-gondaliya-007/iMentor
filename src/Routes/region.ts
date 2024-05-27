import express, { Request, Response } from "express";
import { regionController } from "../Controller/region.controller";
import { auth } from "../middleware/auth";
import validate from "../middleware/validate";
import { addRegionValidator } from "../Validators/region";
import { addNewSchoolOrInstitute, removeNewSchoolOrInstitute } from "../Validators/partner";
import multer from "multer";
let router = express.Router();

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "./uploads" + "/PartnerFile");
  },
  filename: function (req, file, cb) {
    cb(null, file.fieldname + "_" + Date.now());
  },
});
const upload = multer({ storage: storage });

router.post("/addRegion", validate(addRegionValidator), regionController.addRegion);
router.post("/getRegion", regionController.getRegion);

router.get("/getOneRegion", regionController.getOneRegion);
router.post("/editRegion", regionController.regionEdit);
router.post("/addNewSchoolOrInstitute", validate(addNewSchoolOrInstitute), regionController.addNewSchoolOrInstitute);
router.post("/removeNewSchoolOrInstitute", validate(removeNewSchoolOrInstitute), regionController.removeNewSchoolOrInstitute);
router.get("/filterOptions", regionController.filterOptions);
router.post("/regionDelete", regionController.deleteRegion);
router.post("/schoolFileUpload", upload.single("SchoolFile"), regionController.schoolFileUpload);
router.post("/bulkRegionCreate", upload.single("regionFile"), regionController.bulkRegionCreate);
export default router;
