import express from 'express';
import { auth } from '../../middleware/auth';
import validate from '../../middleware/validate';
import { contentController } from '../../Controller/Web/content.controller';
import { getContentURLValidation, getContentDetailValidation, shareContentValidation, incrementContentViewedCountValidation } from '../../Validators/Web/content';

let router = express.Router();

router.post('/getContentList', auth, contentController.getContentList);

router.post('/getContentURL', auth, validate(getContentURLValidation), contentController.getContentURL);

router.post('/getContentDetail', auth, validate(getContentDetailValidation), contentController.getContentDetail);

router.post('/shareContent', auth, validate(shareContentValidation), contentController.shareContent);

router.post('/incrementContentViewedCount', auth, validate(incrementContentViewedCountValidation), contentController.incrementContentViewedCount);

export default router;