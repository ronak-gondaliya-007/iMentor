import { Document } from 'mongoose'

export interface badgeInterface extends Document {
    badgeName: string;
    badge: string;
    isDel: boolean;
    isSystem: boolean;
}