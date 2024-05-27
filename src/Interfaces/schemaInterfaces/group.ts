import { Document } from "mongoose";

export interface groupInterface extends Document {
    groupName: string,
    region: string,
    assignedSchoolOrInstitute: string,
    groupMember: Array<any>,
    groupAdmin: string,
    isArchived: boolean
}