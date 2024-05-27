import { Document } from "mongoose";

export interface achievedBadgesInterface extends Document {
    senderId: string;
    receiverId: string;
    badgeName: string;
    type: string;
    achievedDate: Date;
    message: string;
};
