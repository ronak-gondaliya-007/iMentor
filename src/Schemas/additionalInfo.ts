import mongoose from "mongoose";
import paginate from "mongoose-paginate";

let additionalInfoSchema = new mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            unique: true,
            require: true
        },
        demographicInformation: {
            type: Object
        },
        employerInformation: {
            type: Object
        },
        programInformation: {
            type: Object
        },
        preloadMentees: {
            type: Array
        },
        references: [
            {
                fullName: {
                    type: String
                },
                email: {
                    type: String
                },
                phoneNumber: {
                    type: String
                },
                countryCode: {
                    type: String
                },
                relation: {
                    type: String
                },
                description: {
                    type: String
                }
            }
        ],
        legalStatus: {
            type: Object
        },
        physicalAndEmotionalCondition: {
            type: Object
        },
        education_level: {
            type: Object
        }
    },
    { timestamps: true }
);
additionalInfoSchema.plugin(paginate);

export default additionalInfoSchema;