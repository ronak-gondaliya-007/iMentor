import { Request } from "express";
import { Model, Document } from "mongoose";

export interface userInterface extends Document {
  _id: string;
  role: string;
  email: string;
  legalFname: string;
  legalLname: string;
  primaryPhoneNo: string;
  secondaryPhoneNo: string;
  preferredFname: string;
  preferredLname: string;
  dob: Date;
  profilePic: string;
  profilePicKey: string;
  gender: string;
  isDel: boolean;
  address: address;
  status: string;
  isInvited: boolean;
  guardianFname: string;
  guardianLname: string;
  guardianEmail: string;
  guardianPhone: string;
  pronounceName: string;
  region: string;
  partnerAdmin: string;
  countryCode: string;
  rejectReason: string;
  rejectDate: Date;
  thinkificUserId?: string;
  userActivationDate: Date;
  isSharedThisNumber: boolean;
  isDisabled: boolean;
  isCompleted: boolean;
  isSaveAndExit: boolean;
  isSaveAndInvite: boolean;
  isField: boolean;
  resentInvitationDate: Date;
  preMatchStep: number;
  onboardingStep: number;
  scheduleOrientation: string;
  completeScreening: string;
  isParentBornInUnitedStates: boolean;
  isSameAddress: boolean;
  guardianAddress: address;
  isRegLinkExpired: boolean;
  isPasswordLinkExpired: boolean;
  createdBy: Date;
  calendarOfEvents: string;
  parentalConsent: boolean;
  userImported: boolean;
}

export interface address {
  streetAddress1: String,
  streetAddress2: String,
  city: String,
  state: String,
  zipCode: String,
  countryCode: string
}

export interface region {
  country: String,
  institute: Array<any>
}

export interface requestUser extends Request {
  user: userInterface,
  token: string
}

export interface partnerInterface extends Document { }
export interface appSettingsInterface extends Document { }