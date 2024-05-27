import { Document } from "mongoose";

export interface notificationManageInterface extends Document {
    user_id: string;
    deviceId: string;
    deviceType: string;
    systemNotification: boolean;
}
