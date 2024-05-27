import mongoose from "mongoose";
import paginate from "mongoose-paginate";
import { userRoleConstant } from "../utils/const";

let Notification = new mongoose.Schema(
    {
        from: { type: mongoose.SchemaTypes.ObjectId, ref: 'User' },
        from_type: {
            type: String,
            enum: Object.values(userRoleConstant),
            default: ''
        },
        to: { type: mongoose.SchemaTypes.ObjectId, ref: 'User' },
        to_type: {
            type: String,
            enum: Object.values(userRoleConstant),
            default: ''
        },
        type: { type: String },
        dataId: { type: mongoose.SchemaTypes.ObjectId },
        content: { type: String },
        courseId: { type: String },
        courseType: { type: String },
        read: { type: Boolean, default: false },
        isDel: { type: Boolean, default: false }
    },
    { timestamps: true }
);

Notification.plugin(paginate);

export default Notification;
