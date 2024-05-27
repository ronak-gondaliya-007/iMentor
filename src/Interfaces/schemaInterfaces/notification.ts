import { Document } from "mongoose";

export interface notificationInterface extends Document {
    from: string;
    from_type: string;
    to: string;
    to_type: string;
    type: string;
    dataId: string;
    content: string;
    courseId?: string;
    courseType?: string;
    read: boolean;
}
