import mongoose from 'mongoose';
import paginate from "mongoose-paginate";

let SessionSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Types.ObjectId,
        ref: 'User'
    },
    account: [{
        email: { type: String },
        token: { type: String },
        user: {
            type: mongoose.Types.ObjectId,
            ref: 'User'
        },
        default: { type: Boolean, default: false },
        role: { type: String },
    }]

}, { timestamps: true });

SessionSchema.plugin(paginate);

export default SessionSchema;