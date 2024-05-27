import mongoose from "mongoose";
import paginate from "mongoose-paginate";

let announcementSchema = new mongoose.Schema(
    {
        message: {
            type: String,
        },
        sendTo: [{
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
        }],
        groups: [{
            type: mongoose.Schema.Types.ObjectId,
            ref: "Group",
        }],
        pairs: [{
            type: mongoose.Schema.Types.ObjectId,
            ref: "PairInfo",
        }],
        sendToType: {
            type: String
        },
        sendFrom: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
        },
        isDraft: {
            type: Boolean
        },
        isIntroductory: {
            type: Boolean
        },
        isDelete: {
            type: Boolean,
            default: false
        },
        partnerId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Partner",
            index: true
        },
        regionId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Region",
            index: true
        },
        partnerIdOrRegionId: {
            type: mongoose.Schema.Types.ObjectId,
            required: true
        },
    },
    { timestamps: true }
);
announcementSchema.plugin(paginate);

export default announcementSchema;