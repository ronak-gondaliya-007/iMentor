import { Document } from "mongoose";

export interface regionInterface extends Document {
    region: string;
    city: string;
    assignedSchoolInstitution: Array<any>;
}