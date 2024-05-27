import mongoose from "mongoose";
import paginate from "mongoose-paginate";

const assignedContentSchema = new mongoose.Schema(
  {
    thinkificCourseId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ThinkificCourses",
    },
    assignedUserType: {
      type: String,
      required: true
    },
    partnerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Partner",
      index: true
    },
    courseType:{
      type:String,
      default:"Project"
    },
    regionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Region",
      index: true
    },
    partnerIdOrRegionId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true
    },
    isArchived: {
      type: Boolean,
      default: false
    },
    isDefaultCourse: {
      type: Boolean,
      default: false
    }
  },
  { timestamps: true }
);

assignedContentSchema.plugin(paginate);

export default assignedContentSchema;
