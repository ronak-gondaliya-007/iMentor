import express from "express";
import { matcheController } from "../Controller/matches.controller";
import multer from 'multer';
let router = express.Router();

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, "./uploads" + "/QuestionCsv");
    },
    filename: function (req, file, cb) {
        cb(null, file.fieldname + "_" + Date.now());
    },
});
const upload = multer({ storage: storage });

const pairStorage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, "./uploads" + "/PairCsv");
    },
    filename: function (req, file, cb) {
        cb(null, file.fieldname + "_" + Date.now());
    },
});
const pairUpload = multer({ storage: pairStorage });

router.post("/addQuestions", matcheController.addQuestion);
router.post("/questionList", matcheController.questionList);
router.post("/questionUpdate", matcheController.updateQuestion);
router.post("/archiveQuestion", matcheController.archiveQuestion);
router.post("/deleteQuestion", matcheController.deleteQuestion);
router.post("/getQuestion", matcheController.getQuestion);
router.post("/changeOrderQuestion", matcheController.changeOrder);
router.post("/doMatching", matcheController.doMatching);
router.post("/pairList", matcheController.pairListig);
router.get("/getPair", matcheController.getPair);
router.post("/doPairOperation", matcheController.doPairOperation);
router.post('/dragAndDrop', matcheController.dragAndDrop);
router.post('/PairFilterOption', matcheController.filterOption);
router.post('/filters', matcheController.filters);
router.post('/sendMessageToPair', matcheController.sendMessageToPair);
router.post('/attendedEventsOfPairs', matcheController.attendedEventsOfPairs)
router.post('/conversation', matcheController.conversation)
router.post('/importQuestionFromCSV', upload.single('csv'), matcheController.importQuestionFromCSV);
router.post("/pairProjects", matcheController.pairProjects)
router.post('/contentAccessed', matcheController.contentAccessed)
router.post('/getArchievedPairDetail', matcheController.getArchievedPairDetail);
router.post('/importPairFromCsv', pairUpload.single('pairCsv'), matcheController.uploadPairCsv);
router.post("/pairProjects/v2", matcheController.pairProjectV2);
router.post("/pairList/v2", matcheController.pairListV2);

export default router;
