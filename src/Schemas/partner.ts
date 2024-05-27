import mongoose from "mongoose";
import paginate from "mongoose-paginate";

let partnerSchema = new mongoose.Schema(
  {
    partnerName: { type: String },
    assignedSchoolOrInstitute: { type: [String] },
    region: { type: String },
    isDel: { type: Boolean, default: false },
    logo: { type: String },
    contactEmail: { type: String, require: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    isIntroductoryMessage: { type: Boolean, default: false },
    introductoryMessage: { type: String },
    partnerImported: { type: Boolean, default: false }
  },
  { timestamps: true }
);

partnerSchema.plugin(paginate);

export default partnerSchema;
