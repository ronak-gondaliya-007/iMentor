import mongoose from "mongoose";
import paginate from "mongoose-paginate";

let achievedBadgesSchema = new mongoose.Schema(
    {
        senderId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            default: null
        },
        receiverId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            default: null
        },
        badgeName: {
            type: String
        },
        type: {
            type: String
        },
        achievedDate: {
            type: Date
        },
        message: {
            type: String
        }
    },
    { timestamps: true }
);
achievedBadgesSchema.plugin(paginate);

export default achievedBadgesSchema;
