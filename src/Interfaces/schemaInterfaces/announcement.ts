import { Document } from "mongoose";

export interface announcementInterface extends Document {
    message: string;
    sendFrom: string;
    sendTo: Array<any>;
    sendToType: string;
    isDraft: boolean;
    isDelete: boolean;
    isIntroductory: boolean;
    partnerId: string;
    regionId: string;
    partnerIdOrRegionId: string
}