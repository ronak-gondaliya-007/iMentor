import { Document } from 'mongoose'

export interface eventGuestInterface extends Document {
    userId: string,
    eventId: string,
    status: string,
    isFavorite: boolean,
    isDel: boolean
}