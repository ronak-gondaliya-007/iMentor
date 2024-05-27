import { Document } from 'mongoose'

export interface answerByMenteesInterface extends Document {
    queAns: [{
        question: String,
        answer: Array<any>
    }],
    user: String
}