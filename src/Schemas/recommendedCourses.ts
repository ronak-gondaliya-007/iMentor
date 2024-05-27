import mongoose from "mongoose";
import paginate from "mongoose-paginate";

const recommendedCourseSchema = new mongoose.Schema(
  {
    thinkificCourseId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ThinkificCourses",
    },
    courseId: {
      type: String,
      index: true
    },
    courseStatus: {
      type: String,
      index: true
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      index: true
    },
    courseType: {
      type: String,
      required: true
    },
    isArchived: {
      type: Boolean,
      default: false
    },
    isDefaultCourse: {
      type: Boolean,
      default: false
    },
    enrollId: {
      type: String
    },
    contentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Contents",
      index: true
    },
    bannerImageUrl: {
      type: String
    },
    courseCardImageUrl: {
      type: String
    },
    message: {
      type: String,
      default: ""
    },
    percentageCompleted: {
      type: Number,
      default: 0
    },
    partnerIdOrRegionId: {
      type: mongoose.Schema.Types.ObjectId,
      index: true
    },
    partnerAdmin: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Partner"
    },
    region: {
      type: mongoose.Types.ObjectId,
      ref: 'Region'
    },
    isRead: {
      type: Boolean,
      default: false
    }
  },
  { timestamps: true }
);

recommendedCourseSchema.plugin(paginate);

export default recommendedCourseSchema;
