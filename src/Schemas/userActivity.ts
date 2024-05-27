import mongoose from "mongoose";
import paginate from "mongoose-paginate";

let UserActivitySchema = new mongoose.Schema(
    {
        userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        userIds: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
        eventId: { type: mongoose.Schema.Types.ObjectId, ref: "Event" },
        contentId: { type: mongoose.Schema.Types.ObjectId, ref: "Contents" },
        courseId: { type: mongoose.Schema.Types.ObjectId, ref: "ThinkificCourses" },
        audit: { type: String },
        endPoint: { type: String },
        requestType: { type: String },
        requestStatus: { type: Number },
        ipAddress: { type: String },
        ipDetails: { type: Object },
        deviceType: { type: String },
        osType: { type: String },
        isPostmanRequest: { type: Boolean, default: false },
        updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
        masterUserId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
        loginType: { type: String, required: true }
    },
    { timestamps: true }
);

UserActivitySchema.plugin(paginate);

export default UserActivitySchema;
