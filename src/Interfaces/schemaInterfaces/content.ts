import { Document } from "mongoose";

export interface contentInterface extends Document {
    fileName: string,
    category: string,
    type: string,
    contentFile?: string,
    contentLink?: string,
    thumbnailFile: string,
    partnerIdOrRegionId: String,
    partnerId?: string,
    regionId?: string,
    isArchived: boolean,
    createdBy: string,
    contentViewedCount: number,
}

export interface assignedContentInterface extends Document {
    assignedUserType: string,
    partnerId?: string,
    regionId?: string,
    partnerIdOrRegionId: string,
    isArchived: boolean,
    isDefault?: boolean
}

export interface RecommendedCourseInterface extends Document {
    courseId?: string,
    courseStatus?: string,
    userId: string,
    courseType: string,
    isArchived: boolean,
    isDefaultCourse?: boolean,
    enrollId?: string,
    bannerImageUrl?: string,
    courseCardImageUrl?: string,
    message?: string,
    contentId?: string,
    percentageCompleted: number,
    partnerIdOrRegionId?: string,
    partnerAdmin?: string,
    region?: string
}