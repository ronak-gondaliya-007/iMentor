import mongoose from "mongoose";
import paginate from "mongoose-paginate";

const awsWebhookSchema = new mongoose.Schema(
    {
        email: {
            type: String
        }
    },
    { timestamps: true }
);
awsWebhookSchema.plugin(paginate);

export default awsWebhookSchema;