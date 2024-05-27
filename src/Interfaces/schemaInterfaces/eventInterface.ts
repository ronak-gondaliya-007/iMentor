import { Document } from 'mongoose'

export interface eventInterface extends Document {
    userId: string,
    event_name: string,
    location: string,
    isVirtual: boolean,
    meet_link: string,
    start_date: Date,
    end_date: Date,
    description: string,
    attachments: string,
    attachmentsKey: string,
    status: string,
    isDraft: boolean,
    isDel: boolean,
    isActive: boolean,
    thumbnail: string,
    thumbnailKey: string,
    additionalURL: string
}