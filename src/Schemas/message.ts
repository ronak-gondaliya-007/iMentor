import mongoose from "mongoose";
import paginate from 'mongoose-paginate'


let Messages = new mongoose.Schema({
    chId: {
        type: String
    },
    chType: {
        type: String,
        default: "Private"
    },
    senderId: {
        type: mongoose.Types.ObjectId,
        ref: 'User'
    },
    receiverId: {
        type: mongoose.Types.ObjectId,
        ref: 'User'
    },
    announcementId: {
        type: mongoose.Types.ObjectId,
        ref: 'Announcement'
    },
    groupId: {
        type: mongoose.Types.ObjectId,
        ref: 'Group'
    },
    msg_type: {
        type: String
    },
    message: {
        type: String
    },
    badge: {
        type: String
    },
    contentId: {
        type: mongoose.Types.ObjectId,
        ref: 'Contents'
    },
    reactions: [{
        type: String,
        default: ""
    }],
    messageFile: {
        type: String
    },
    messageFileKey: {
        type: String
    },
    duration: {
        type: String
    },
    read: {
        type: Boolean,
        default: false
    },
    isReminder: {
        type: Boolean
    },
    messageSortDate: {
        type: Date,
        default: Date.now()
    },
    sendTime: {
        type: Number,
        default: new Date().getTime()
    },
    serverTime: {
        type: Number,
        default: new Date().getTime()
    },
    isDel: { type: Boolean, default: false }
    // pendingTime: {
    //     type: Number,
    //     default: new Date().getTime()
    // },
    // isDelivered: {
    //     type: Number,
    //     default: 0
    // },
    // deliverTime: {
    //     type: Number,
    //     default: new Date().getTime()
    // },
}, { timestamps: true })

Messages.index({ senderId: 1 });
Messages.index({ receiverId: 1 });
Messages.plugin(paginate)

// Define a pre-save middleware
Messages.pre('save', function (next) {
    // Check if msg_type is "announcement"
    if (this.msg_type === "announcement") {
        this.isReminder = false; // Set isReminder to true
    }
    next();
});

export default Messages