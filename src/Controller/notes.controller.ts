import { Request, Response, request } from "express";
import { distinct, find, findOne, findOneAndUpdate, insertMany, insertOne, updateMany, paginate, aggregate, ObjectId, deleteMany, findOneAndDelete, deleteOne } from "../utils/db";
import { success, error } from "../utils/helpers/resSender";
import { logger } from "../utils/helpers/logger";
import { requestUser } from "../Interfaces/schemaInterfaces/user";
import { errorMessage, statusCode, userRoleConstant } from "../utils/const";

export let notesController = {
    addNote: async (req: any, res: Response) => {
        try {
            let request = req as requestUser;

            const { note, createdFor, createdForPair } = req.body;
            const createdBy = request.user._id;

            let query: any = {
                createdBy: createdBy,
                note: note
            }

            if (createdForPair) {
                query['createdForPair'] = createdForPair

            } else {
                query['createdFor'] = createdFor
            }

            if (request.user.role == userRoleConstant.P_SUPER_ADMIN || request.user.role == userRoleConstant.P_LOCAL_ADMIN) {
                query['partner'] = request.user.partnerAdmin
            } else if (request.user.role == userRoleConstant.I_LOCAL_ADMIN) {
                query['region'] = request.user.region
            } else {
                // res.status(statusCode.UNAUTHORIZED).send(error(errorMessage.ACTION.replace(":attribute", request.user.role), {}, statusCode.UNAUTHORIZED));
                // return

                let getPartnerOrRegion = await findOne({ collection: 'User', query: { _id: createdFor, isDel: false, role: { $in: [userRoleConstant.MENTOR, userRoleConstant.MENTEE] } } });
                console.log(getPartnerOrRegion);
                // return false
                if (!getPartnerOrRegion) {
                    res.status(statusCode.BAD_REQUEST).send(error(errorMessage.NOT_EXISTS.replace(":attribute", 'User'), {}, statusCode.BAD_REQUEST))
                }
                if (getPartnerOrRegion.partnerAdmin) {
                    query['partner'] = getPartnerOrRegion.partnerAdmin
                } else if (getPartnerOrRegion.region) {
                    query['region'] = getPartnerOrRegion.region
                }
            }

            // let isNoteExists = await findOne({ collection: 'Notes', query: { createdBy: createdBy, createdFor: createdFor } });
            let message = ''
            // if (isNoteExists) {
            //     isNoteExists = await findOneAndUpdate({
            //         collection: 'Notes', query: { createdBy: createdBy, createdFor: createdFor },
            //         update: { $set: query }
            //     })

            //     message = "Note updated successfully."
            // } else {
            const isNoteExists = await insertOne({
                collection: 'Notes', document: query
            })

            message = "Note added successfully."
            // }

            res.send(success(message, isNoteExists, statusCode.OK))
        } catch (err) {
            logger.error(`There was an issue into create note.: ${err} `)
            res.status(statusCode.FORBIDDEN).send(error(err))
        }
    },

    getSingleNote: async (req: any, res: Response) => {
        try {
            let request = req as requestUser;

            const { _id /* createdFor, createdForPair */ } = req.body;
            const createdBy = request.user._id;

            // let query: any = {
            //     createdBy: createdBy
            // };

            // if (createdForPair) {
            //     query['createdForPair'] = createdForPair

            // } else {
            //     query['createdFor'] = createdFor
            // }

            let isNoteExists = await findOne({ collection: 'Notes', query: { _id: _id }, populate: { path: 'createdBy createdFor', select: 'legalFname legalLname preferredFname preferredLname profilePic' } });

            res.send(success("Note fetch successfully.", isNoteExists, statusCode.OK))
        } catch (err) {
            logger.error(`There was an issue into create note.: ${err} `)
            res.status(statusCode.FORBIDDEN).send(error(err))
        }
    },

    getNote: async (req: any, res: Response) => {
        try {
            let request = req as requestUser;

            const { createdFor, search, createdForPair } = req.body;
            let query: any = {}

            if (createdForPair) {
                query = {
                    createdForPair: createdForPair
                };
            } else {
                query = {
                    createdFor: createdFor
                };
            }

            if (search) {
                query['note'] = { $regex: new RegExp("" + search + "", "i") }
            }

            if (request.user.role == userRoleConstant.P_SUPER_ADMIN || request.user.role == userRoleConstant.P_LOCAL_ADMIN) {
                query['partner'] = request.user.partnerAdmin
            } else if (request.user.role == userRoleConstant.I_LOCAL_ADMIN) {
                query['region'] = request.user.region
            } else {
                if (createdFor) {
                    let getPartnerOrRegion = await findOne({ collection: 'User', query: { _id: createdFor, isDel: false, role: { $in: [userRoleConstant.MENTOR, userRoleConstant.MENTEE] } } });
                    if (!getPartnerOrRegion) {
                        res.status(statusCode.BAD_REQUEST).send(error(errorMessage.NOT_EXISTS.replace(":attribute", 'User'), {}, statusCode.BAD_REQUEST))
                    }
                    if (getPartnerOrRegion.partnerAdmin) {
                        query['partner'] = getPartnerOrRegion.partnerAdmin
                    } else if (getPartnerOrRegion.region) {
                        query['region'] = getPartnerOrRegion.region
                    }
                }
            }

            let isNoteExists = await find({ collection: 'Notes', query: query, populate: { path: 'createdBy createdFor', select: 'legalFname legalLname preferredFname preferredLname profilePic' } });

            res.send(success("Note fetch successfully.", isNoteExists, statusCode.OK))
        } catch (err) {
            logger.error(`There was an issue into create note.: ${err} `)
            res.status(statusCode.FORBIDDEN).send(error(err))
        }
    },

    updateNote: async (req: any, res: Response) => {
        try {

            const { noteId, note } = req.body;

            let updateNote = await findOneAndUpdate({
                collection: 'Notes', query: {
                    _id: noteId
                }, update: {
                    $set: {
                        note: note
                    }
                }
            });

            res.send(success("Note updated successfully.", updateNote, statusCode.OK))
        } catch (err) {
            logger.error(`There was an issue into update note.: ${err}`)
            res.status(statusCode.FORBIDDEN).send(error(err))
        }
    },

    deleteNote: async (req: any, res: Response) => {
        try {
            let request = req as requestUser;

            let query: any = {
                _id: req.body.noteId
            };

            if (request.user.role == userRoleConstant.P_SUPER_ADMIN || request.user.role == userRoleConstant.P_LOCAL_ADMIN) {
                query['partner'] = request.user.partnerAdmin
            } else if (request.user.role == userRoleConstant.I_LOCAL_ADMIN) {
                query['region'] = request.user.region
            } /* else {
                res.status(statusCode.UNAUTHORIZED).send(error(errorMessage.ACTION.replace(":attribute", request.user.role), {}, statusCode.UNAUTHORIZED));
                return
            } */

            let isNoteExists = await deleteOne({ collection: 'Notes', query: query });

            res.send(success("Note delete successfully.", isNoteExists, statusCode.OK))
        } catch (err) {
            logger.error(`There was an issue into create note.: ${err} `)
            res.status(statusCode.FORBIDDEN).send(error(err))
        }
    },
}