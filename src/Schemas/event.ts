import mongoose from "mongoose";
import paginate from 'mongoose-paginate'
import { eventStatusConstant, eventTypeConstant } from "../utils/const";


const EventSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Types.ObjectId,
        ref: 'User'
    },
    event_name: {
        type: String
    },
    event_type: {
        type: String,
        enum: Object.values(eventTypeConstant)
    },
    location: {
        type: String
    },
    isVirtual: {
        type: Boolean,
        default: false
    },
    meet_link: {
        type: String
    },
    start_date: {
        type: Date
    },
    end_date: {
        type: Date
    },
    description: {
        type: String
    },
    attachments: {
        type: Array
    },
    attachmentsKey: {
        type: Array
    },
    thumbnail: {
        type: String
    },
    thumbnailKey: {
        type: String
    },
    partnerId: {
        type: mongoose.Types.ObjectId,
        ref: 'Partner'
    },
    regionId: {
        type: mongoose.Types.ObjectId,
        ref: 'Region'
    },
    guest: [{
        type: mongoose.Types.ObjectId,
        ref: 'User'
    }],
    additionalURL: { type: String },
    status: { type: String },
    isDraft: { type: Boolean, default: false },
    isDel: { type: Boolean, default: false },
    isActive: { type: Boolean, default: false },
    approval: {
        type: String,
        enum: Object.values(eventStatusConstant),
        default: eventStatusConstant.PENDING
    },
    rejectReason: { type: String },
    additionalUrl: { type: String },
    isScheduled: { type: Boolean, default: false },
    groupId: [{
        type: mongoose.Types.ObjectId,
        ref: 'Group'
    }],
    pairId: [{
        type: mongoose.Types.ObjectId,
        ref: 'PairInfo'
    }],
    mentorMenteeId: [{
        type: mongoose.Types.ObjectId,
        ref: 'User'
    }],
}, { timestamps: true })

EventSchema.plugin(paginate)

export default EventSchema