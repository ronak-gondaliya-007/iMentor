import mongoose from "mongoose";
import paginate from "mongoose-paginate";

let badgeSchema = new mongoose.Schema(
    {
        badgeName: { type: String, unique: true, require: true },
        isDel: { type: Boolean, default: false },
        badge: { type: String },
        isSystem: { type: Boolean, default: true },
        type: { type: String, default: "" },
    },
    { timestamps: true }
);
badgeSchema.plugin(paginate);

export default badgeSchema;
