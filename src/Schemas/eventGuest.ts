import mongoose from "mongoose";
import paginate from "mongoose-paginate";
import { eventAcceptenceTypeConstant, eventStatusConstant } from "../utils/const";

export let EventGuest = new mongoose.Schema({
    userId: {
        type: mongoose.Types.ObjectId,
        ref: 'User'
    },
    eventId: {
        type: mongoose.Types.ObjectId,
        ref: 'Event'
    },
    isActive: {
        type: Boolean,
        default: false
    },
    status: {
        type: String,
        enum: Object.values(eventStatusConstant),
        default: eventStatusConstant.PENDING
    },
    attendance: {
        type: String,
        enum: Object.values(eventAcceptenceTypeConstant),
        default: eventAcceptenceTypeConstant.UNTRACKED
    },
    isFavorite: {
        type: Boolean,
        default: false
    },
    isDel: {
        type: Boolean,
        default: false
    },
    isAttend: {
        type: Boolean,
        default: false
    }
}, { timestamps: true });


EventGuest.plugin(paginate);

export default EventGuest;