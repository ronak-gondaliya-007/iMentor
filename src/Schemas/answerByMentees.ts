import mongoose from "mongoose";
import paginate from "mongoose-paginate";
import { userStatusConstant } from "../utils/const";

const AnswerByMenteesSchema = new mongoose.Schema(
  {
    queAns: [
      {
        question: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Matches",
        },
        answer: { type: Array },
      },
    ],
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    status: {
      type: String,
      default: userStatusConstant.PENDING
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    isConfirm: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

AnswerByMenteesSchema.plugin(paginate);

export default AnswerByMenteesSchema;
