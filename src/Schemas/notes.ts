import mongoose from "mongoose";
import paginate from "mongoose-paginate";

let noteSchema = new mongoose.Schema(
    {
        note: { type: String },
        createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        createdFor: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        createdForPair: { type: mongoose.Schema.Types.ObjectId, ref: "PairInfo" },
        region: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Region",
        },
        partner: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Partner",
        },
    },
    { timestamps: true }
);

noteSchema.plugin(paginate);

export default noteSchema;
