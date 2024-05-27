import mongoose from "mongoose";
import paginate from "mongoose-paginate-v2";

let UserSchema = new mongoose.Schema(
  {
    role: {
      type: String,
      require: true,
    },
    email: {
      type: String,
      sparse: true
    },
    recoveryEmail: {
      type: String,
    },
    password: {
      type: String,
    },
    preferredFname: {
      type: String,
    },
    preferredLname: {
      type: String,
    },
    legalFname: {
      type: String,
      require: true,
    },
    legalLname: {
      type: String,
    },
    pronounciationName: {
      type: String
    },
    dob: {
      type: Date
    },
    profilePic: {
      type: String,
    },
    profilePicKey: {
      type: String
    },
    gender: {
      type: String,
    },
    isDel: {
      type: Boolean,
      default: false,
    },
    primaryPhoneNo: {
      type: String,
    },
    primaryPhoneNoCountryCode: {
      type: String,
    },
    secondaryPhoneNo: {
      type: String,
    },
    secondaryPhoneNoCountryCode: {
      type: String,
    },
    address: {
      streetAddress1: { type: String },
      streetAddress2: { type: String },
      city: { type: String },
      state: { type: String },
      zipCode: { type: String },
      countryCode: { type: String }
    },
    status: {
      type: String,
    },
    isInvited: {
      type: Boolean,
      default: false,
    },
    guardianFname: {
      type: String
    },
    guardianLname: {
      type: String
    },
    guardianEmail: {
      type: String,
    },
    guardianPhone: {
      type: String,
    },
    guardianSecondaryPhoneNo: {
      type: String
    },
    guardianPhoneNoCountryCode: {
      type: String,
    },
    isSameAddress: { type: Boolean, default: false },
    isParentBornInUnitedStates: { type: Boolean },
    guardianAddress: {
      streetAddress1: { type: String },
      streetAddress2: { type: String },
      city: { type: String },
      state: { type: String },
      zipCode: { type: String },
      countryCode: { type: String }
    },
    pronounceName: {
      type: String,
    },
    region: {
      type: mongoose.Types.ObjectId,
      ref: 'Region',
      index: true
    },
    partnerAdmin: { type: mongoose.Schema.Types.ObjectId, ref: "Partner", index: true },
    countryCode: { type: String },
    otp: { type: Number },
    rejectReason: {
      type: String
    },
    rejectDate: {
      type: Date
    },
    isSharedThisNumber: { type: Boolean },
    isDisabled: { type: Boolean, default: false },
    isCompleted: { type: Boolean, default: false },
    isSaveAndExit: { type: Boolean, default: false },
    isSaveAndInvite: { type: Boolean, default: false },
    isField: { type: Boolean, default: false },
    resentInvitationDate: { type: Date },
    onboardingStep: { type: Number, default: 0 },
    preMatchStep: { type: Number, default: 0 },
    scheduleOrientation: { type: mongoose.Schema.Types.ObjectId, ref: "Event" },
    completeScreening: { type: mongoose.Schema.Types.ObjectId, ref: "Event" },
    calendarOfEvents: { type: mongoose.Schema.Types.ObjectId, ref: "Event" },
    parentalConsent: { type: Boolean, default: false },
    isRegLinkExpired: { type: Boolean, default: false },
    isPasswordLinkExpired: { type: Boolean, default: false },
    thinkificUserId: { type: String },
    createdBy: {
      type: mongoose.Types.ObjectId,
      ref: 'User'
    },
    userActivationDate: {
      type: Date
    },
    requestMoreInfoDate: {
      type: Date
    },
    totalLogin: {
      type: Number,
      default: 0
    },
    pairImported: {
      type: Boolean,
      default: false
    },
    userImported: {
      type: Boolean,
      default: false
    },
    isCookieAccepted: { type: Boolean, default: false }
  },
  { timestamps: true }
);


UserSchema.plugin(paginate);
export default UserSchema;
