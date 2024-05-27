import { Document } from 'mongoose'

export interface answerByMentorsInterface extends Document {
    queAns: [{
        question: String,
        answer: Array<any>
    }],
    user: String
}