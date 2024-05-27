import express from 'express';
import { auth } from '../middleware/auth';
import { notesController } from '../Controller/notes.controller';
let router = express.Router();

router.post('/addNote', notesController.addNote);

router.post('/getSingleNote', notesController.getSingleNote);

router.post('/getNote', notesController.getNote);

router.post('/updateNote', notesController.updateNote);

router.post('/deleteNote', notesController.deleteNote);

export default router