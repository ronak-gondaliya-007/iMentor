import { Document } from "mongoose";

export interface UserActivityInterface extends Document {
    userId: string;
    endPoint: string;
    requestType: string;
    ipAddress: string;
    ipDetails: object;
    deviceType: string;
    osType: string;
    updated: string;
    updatedBy: string;
    masterUserId: string;
    loginType: string;
};
