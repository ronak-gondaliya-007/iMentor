import mongoose from "mongoose";
import paginate from "mongoose-paginate";

let groupSchema = new mongoose.Schema(
    {
        groupName: {
            type: String,
        },
        region: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Region",
        },
        partner: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Partner",
        },
        assignedSchoolOrInstitute: {
            type: Array,
        },
        groupMember: [{
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
        }],
        groupAdmin: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
        },
        isArchived: {
            type: Boolean,
            default: false,
        },
        isDel: {
            type: Boolean,
            default: false
        }
    },
    { timestamps: true }
);
groupSchema.plugin(paginate);

export default groupSchema;