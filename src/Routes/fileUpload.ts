import express from 'express';
import multer from 'multer';
import { fileUploadController } from '../Controller/fileUpload.controller';
let router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

router.post('/fileUpload', upload.single('file'), fileUploadController.imageUpload)
router.post('/contentDocUpload', upload.single('file'), fileUploadController.contentDocUpload)

export default router