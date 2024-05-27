import mongoose from "mongoose";
import { reminder_status } from "../utils/const";
import paginate from "mongoose-paginate-v2";

let reminderSchema = new mongoose.Schema(
    {
        userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        user_role: { type: String },
        title: { type: String },
        remind_time: { type: Date },
        type: { type: String },
        messageId: { type: mongoose.Schema.Types.ObjectId, ref: "Message" },
        note: { type: String },
        status: { type: String, enum: Object.values(reminder_status), default: reminder_status.PROCESS }
    },
    { timestamps: true }
);
reminderSchema.plugin(paginate);

export default reminderSchema;
