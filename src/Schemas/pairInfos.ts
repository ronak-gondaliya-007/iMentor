import mongoose from "mongoose";
import paginate from "mongoose-paginate";

let pairInfoSchema = new mongoose.Schema(
  {
    menteeAns: [
      {
        _id: false,
        question: { type: mongoose.Schema.Types.ObjectId, ref: "Matches" },
        option: [
          {
            _id: false,
            optionNum: Number,
            option: String,
            answer: Boolean,
            matchAns: Boolean,
          },
        ],
        score: Number,
      },
    ],
    mentorAns: [
      {
        _id: false,
        question: { type: mongoose.Schema.Types.ObjectId, ref: "Matches" },
        option: [
          {
            _id: false,
            optionNum: Number,
            option: String,
            answer: Boolean,
            matchAns: Boolean,
          },
        ],
        score: Number,
      },
    ],
    menteeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    mentorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    partner: {
      type: String,
    },
    isUpdated: {
      type: Boolean,
      default: false
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
    partnerIdOrRegionId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true
    },
    SOM: Number,
    location: {
      type: String,
    },
    school: {
      type: Array,
    },
    isConfirm: {
      type: Boolean,
      default: false,
    },
    isArchive: {
      type: Boolean,
      default: false,
    },
    isDel: {
      type: Boolean,
      default: false,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User"
    },
    addOnDate: { // When Pair is selected date
      type: Date
    }
  },
  { timestamps: true }
);

pairInfoSchema.index({ menteeId: 1 });
pairInfoSchema.index({ mentorId: 1 });
pairInfoSchema.index({ partnerIdOrRegionId: 1 });
pairInfoSchema.index({ partnerId: 1 });
pairInfoSchema.index({ regionId: 1 });
pairInfoSchema.plugin(paginate);

export default pairInfoSchema;
