import { Document } from "mongoose";

export interface reminderInterface extends Document {
    userId: string,
    user_role: string,
    title: string,
    remind_time: Date,
    note: string,
    type: string;
    messageId: string,
    status: string,
}
