import mongoose from "mongoose";
import paginate from "mongoose-paginate";

let regionSchema = new mongoose.Schema(
  {
    region: {
      type: String,
    },
    city: {
      type: String,
    },
    assignedSchoolOrInstitute: {
      type: Array,
    },
    contactEmail: { type: String, require: true },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    isDel: {
      type: Boolean,
      default: false,
    },
    isIntroductoryMessage: { type: Boolean, default: false },
    introductoryMessage: { type: String },
    regionImported: { type: Boolean, default: false }
  },
  { timestamps: true }
);

regionSchema.plugin(paginate);

export default regionSchema;
