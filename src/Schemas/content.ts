import mongoose from "mongoose";
import paginate from "mongoose-paginate";

const ContentSchema = new mongoose.Schema(
  {
    fileName: {
      type: String,
      required: true
    },
    category: {
      type: String,
      required: true
    },
    type: {
      type: String,
      required: true
    },
    contentFile: {
      type: String
    },
    contentLink: {
      type: String
    },
    thumbnailFile: {
      type: String,
      required: true
    },
    partnerIdOrRegionId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true
    },
    partnerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Partner",
      index: true
    },
    regionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Region",
      index: true
    },
    isArchived: {
      type: Boolean,
      default: false
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      index: true
    },
    isRead: {
      type: Boolean,
      default: false
    },
    contentViewedCount: {
      type: Number,
      default: 0
    }
  },
  { timestamps: true }
);

ContentSchema.plugin(paginate);

export default ContentSchema;
