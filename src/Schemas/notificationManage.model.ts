const mongoose = require('mongoose')

const NotificationManage = new mongoose.Schema({
    user_id: { type: mongoose.SchemaTypes.ObjectId, ref: 'User' },
    deviceId: { type: String, default: null },
    deviceType: { type: String, default: null },
    messageNotification: { type: Boolean, default: false },
    systemNotification: { type: Boolean, default: false }

}, { timestamps: true });

NotificationManage.index({ "user_id": 1 })

export default NotificationManage;