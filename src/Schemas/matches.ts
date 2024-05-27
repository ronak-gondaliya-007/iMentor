import mongoose from "mongoose";
import { categoryOfQuestion, quentionType, questionState } from "../utils/const";
import paginate from "mongoose-paginate";

let matchesSchema = new mongoose.Schema(
  {
    question: String,
    alternateQuestion: {
      type: String
    },
    isAlternateQuestion: {
      type: Boolean, default: false
    },
    isDefaultQuestion: { type: Boolean, default: false }, //is this default question?.
    category: { type: String, enum: Object.values(categoryOfQuestion) },
    answer: [
      {
        _id: false,
        optionNum: Number,
        option: String,
      },
    ],
    queType: { type: String, enum: Object.values(quentionType) },
    isRequired: Boolean,
    status: { type: String, enum: Object.values(questionState) },
    weight: { type: Number },
    orderNum: { type: Number },
    option: [
      {
        optionNum: Number,
        option: String,
        subOptions: Array
      }
    ],
    isDel: { type: Boolean, default: false },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    partnerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Partner",
    },
    regionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Region",
    },
    isSOM: {
      type: Boolean,
      default: true
    }
  },
  { timestamps: true }
);

matchesSchema.plugin(paginate);

export default matchesSchema;
