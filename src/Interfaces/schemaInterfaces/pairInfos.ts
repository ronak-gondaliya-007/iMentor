import { Document } from "mongoose";

export interface pairinfosInterface extends Document {
  menteeId: string;
  mantorId: string;
  SOM: Number;
  location: string;
  school: string;
  partnerId: string;
}
