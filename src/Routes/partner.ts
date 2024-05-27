import express from "express";
import { partnerController } from "../Controller/partner.controller";
import validate from "../middleware/validate";
import multer from "multer";
import {
  addNewSchoolOrInstitute,
  addNewSchoolOrInstituteInApp,
  getPartner,
  partnerCreate,
  partnerDelete,
  partnerEdit,
  removeNewSchoolOrInstitute,
} from "../Validators/partner";

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "./uploads" + "/PartnerFile");
  },
  filename: function (req, file, cb) {
    cb(null, file.fieldname + "_" + Date.now());
  },
});
const upload = multer({ storage: storage });
let router = express.Router();

router.get("/schoolOrInstituteList", partnerController.SchoolOrInstitute);
router.get("/getPartner", validate(getPartner), partnerController.getPartner);
router.get("/filterOptions", partnerController.filterOptions);
router.post("/partnerList", partnerController.partnerList);
router.post("/addPartner", validate(partnerCreate), partnerController.createPartner);
router.post("/addNewSchoolOrInstitute", validate(addNewSchoolOrInstitute), partnerController.addNewSchoolOrInstitute);
router.post("/removeNewSchoolOrInstitute", validate(removeNewSchoolOrInstitute), partnerController.removeNewSchoolOrInstitute);
router.post(
  "/addNewSchoolOrInstituteInApp",
  validate(addNewSchoolOrInstituteInApp),
  partnerController.addNewSchoolOrInstituteInApp
);
router.post("/schoolOrInstituteModel", partnerController.SchoolOrInstituteListApis);
router.get("/getSchoolOrInstitute", partnerController.getSchoolOrInstitute);
router.post("/partnerDelete", validate(partnerDelete), partnerController.partnerListDelete);
router.post("/partnerEdit", validate(partnerEdit), partnerController.partnerEdit);
router.post("/bulkPartnerCreate", upload.single("PartnerFile"), partnerController.bulkPartnerCreate);


//region Opration added 


export default router;
