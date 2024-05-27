import { Document } from "mongoose";

export interface ThinkificCourseInterface extends Document {
    courseId: string,
    courseName: string,
    courseSlug: string,
    courseStatus?: string,
    chapterIds: string[],
    courseType: string,
    courseCardImageUrl?: string,
    productId?: string,
    payload: any,
    isArchived: boolean,
}