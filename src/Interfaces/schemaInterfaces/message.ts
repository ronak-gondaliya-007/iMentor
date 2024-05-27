import { Document } from "mongoose";


export interface messageInterface extends Document {
    senderId: string;
    receiverId: string;
    chId: string;
    message: string;
    msg_type: string;
    duration: string;
    badge: string;
    contentId: string;
    messageFile: string;
    messageFileKey: string;
    read: boolean;
    // isDelivered: number;
}