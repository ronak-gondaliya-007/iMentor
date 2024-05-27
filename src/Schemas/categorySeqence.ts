import mongoose from "mongoose";
import { categoryOfQuestion, quentionType, questionState } from "../utils/const";
import paginate from "mongoose-paginate";

let categorySeq = new mongoose.Schema(
  {
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    category: {
      type: Array,
      default: ["Personality & Interests", "Career & Experience", "Edcutions Informations"],
    },
  },
  { timestamps: true }
);

categorySeq.plugin(paginate);

export default categorySeq;
