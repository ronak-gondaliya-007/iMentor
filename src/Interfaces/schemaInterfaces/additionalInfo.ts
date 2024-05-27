import { Document } from "mongoose";

export interface additionalInfoInterface extends Document {
    userId: string;
    demographicInformation: object;
    employerInformation: object;
    programInformation: object;
    preloadMentees: Array<any>;
    references: Array<any>;
    legalStatus: object;
    physicalAndEmotionalCondition: object;
}