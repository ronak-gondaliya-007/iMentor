import { Document } from "mongoose";

export interface ThinkificWebhooksInterface extends Document {
    topic: string,
    targetUrl: string,
    webhookId: string
}