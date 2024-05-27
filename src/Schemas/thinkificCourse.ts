import mongoose from "mongoose";
import paginate from "mongoose-paginate";

const thinkificCourseSchema = new mongoose.Schema(
  {
    courseId: {
      type: String,
      required: true,
      index: true
    },
    courseName: {
      type: String,
      required: true,
    },
    courseSlug: {
      type: String,
      required: true,
    },
    courseStatus: {
      type: String,
      index: true
    },
    chapterIds: [{
      type: String
    }],
    courseType: {
      type: String,
      required: true
    },
    courseCardImageUrl: {
      type: String
    },
    productId: {
      type: String,
    },
    payload: {
      type: Object
    },
    isArchived: {
      type: Boolean,
      default: false
    },
  },
  { timestamps: true }
);

thinkificCourseSchema.plugin(paginate);

export default thinkificCourseSchema;
