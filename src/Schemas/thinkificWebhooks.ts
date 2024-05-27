import mongoose from "mongoose";
import paginate from "mongoose-paginate";

const ThinkificWebhooksSchema = new mongoose.Schema(
  {
    topic: {
      type: String,
      required: true,
      index: true
    },
    targetUrl: {
      type: String,
      required: true
    },
    webhookId: {
      type: String,
      required: true
    },
  },
  { timestamps: true }
);

ThinkificWebhooksSchema.plugin(paginate);

export default ThinkificWebhooksSchema;
