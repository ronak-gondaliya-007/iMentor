import mongoose from "mongoose";
import paginate from "mongoose-paginate";

let appSettings = new mongoose.Schema(
  {
    key: { type: String, require: true, unique: true },
    value: { type: Array, require: true },
  },
  { timestamps: true }
);

appSettings.plugin(paginate);

export default appSettings;
