import { Document } from "mongoose";

export interface AWSWbhook extends Document {
    email: string;
}