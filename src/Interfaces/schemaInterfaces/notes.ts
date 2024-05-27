import { Document } from "mongoose";

export interface noteInterface extends Document {
    createBy: string;
    createFor: string;
    createForPair: string;
    note: string;
}