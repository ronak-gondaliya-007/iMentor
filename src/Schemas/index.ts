import * as mongoose from "mongoose";
import { appSettingsInterface, partnerInterface, userInterface } from "../Interfaces/schemaInterfaces/user";
import SessionSchema from "./session";
import partnerSchema from "./partner";
import appSettings from "./appSettings";
import additionalInfoSchema from "./additionalInfo";
import { additionalInfoInterface } from "../Interfaces/schemaInterfaces/additionalInfo";
import matchesSchema from "./matches";
import { matchesInterface } from "../Interfaces/schemaInterfaces/matchesInterface";
import UserSchema from "./user";
import { PaginateModel } from "mongoose";
import { pairinfosInterface } from "../Interfaces/schemaInterfaces/pairInfos";
import pairInfos from "./pairInfos";
import AnswerByMentors from "./answerByMentors";
import { answerByMentorsInterface } from "../Interfaces/schemaInterfaces/answerByMentorInterface";
import { AWSWbhook } from "../Interfaces/schemaInterfaces/awsWebhook";
import awsWebhookSchema from "./awsWebhook";
import { answerByMenteesInterface } from "../Interfaces/schemaInterfaces/answerByMenteesInterface";
import AnswerByMenteesSchema from "./answerByMentees";
import Messages from "./message";
import { messageInterface } from "../Interfaces/schemaInterfaces/message";
import { regionInterface } from "../Interfaces/schemaInterfaces/region";
import Region from "./region";
import categorySeq from "./categorySeqence";
import { groupInterface } from "../Interfaces/schemaInterfaces/group";
import groupSchema from "./group";
import announcementSchema from "./announcement";
import { announcementInterface } from "../Interfaces/schemaInterfaces/announcement";
import EventSchema from "./event";
import EventGuestSchema from "./eventGuest";
import { eventInterface } from "../Interfaces/schemaInterfaces/eventInterface";
import { eventGuestInterface } from "../Interfaces/schemaInterfaces/eventGuestInterface";
import AssignedCoursesSchema from './assignedCourses';
import {
  assignedContentInterface,
  RecommendedCourseInterface,
  contentInterface
} from "../Interfaces/schemaInterfaces/content";
import ContentSchema from './content';
import RecommendedCourseSchema from './recommendedCourses';
import achievedBadgesSchema from "./achievedBadges";
import { achievedBadgesInterface } from "../Interfaces/schemaInterfaces/achivedBadges";
import { notificationInterface } from "../Interfaces/schemaInterfaces/notification";
import Notification from "./notification";
import badgeSchema from "./badge";
import { badgeInterface } from "../Interfaces/schemaInterfaces/badge";
import reminderSchema from "./reminder";
import { reminderInterface } from "../Interfaces/schemaInterfaces/reminder";
import { ThinkificWebhooksInterface } from "../Interfaces/schemaInterfaces/thinkificWebhooks";
import ThinkificWebhooksSchema from "./thinkificWebhooks";
import { ThinkificCourseInterface } from '../Interfaces/schemaInterfaces/thinkificCourse';
import thinkificCourseSchema from './thinkificCourse';
import noteSchema from './notes';
import { noteInterface } from '../Interfaces/schemaInterfaces/notes';
import NotificationManageSchema from './notificationManage.model';
import { notificationManageInterface } from '../Interfaces/schemaInterfaces/notificationManage';
import { UserActivityInterface } from "../Interfaces/schemaInterfaces/userActivity";
import UserActivitySchema from "./userActivity";

export default {
  User: mongoose.model<userInterface & mongoose.Document>("User", UserSchema) as PaginateModel<any>,
  Session: mongoose.model("Session", SessionSchema) as PaginateModel<any>,
  Partner: mongoose.model<partnerInterface>("Partner", partnerSchema) as PaginateModel<any>,
  AppSetting: mongoose.model<appSettingsInterface>("AppSetting", appSettings) as PaginateModel<any>,
  AdditionalInfo: mongoose.model<additionalInfoInterface>("AdditionalInfo", additionalInfoSchema) as PaginateModel<any>,
  Matches: mongoose.model<matchesInterface>("Matches", matchesSchema) as PaginateModel<any>,
  PairInfo: mongoose.model<pairinfosInterface>("PairInfo", pairInfos) as PaginateModel<any>,
  AnswerByMentors: mongoose.model<answerByMentorsInterface>('AnswerByMentor', AnswerByMentors) as PaginateModel<any>,
  AWSWebhook: mongoose.model<AWSWbhook>('AWSWebhook', awsWebhookSchema) as PaginateModel<any>,
  AnswerByMentee: mongoose.model<answerByMenteesInterface>('AnswerByMentee', AnswerByMenteesSchema) as PaginateModel<any>,
  Messages: mongoose.model<messageInterface>('Messages', Messages) as PaginateModel<any>,
  Region: mongoose.model<regionInterface>('Region', Region) as PaginateModel<any>,
  categorySeq: mongoose.model('categorySeq', categorySeq) as PaginateModel<any>,
  Group: mongoose.model<groupInterface>('Group', groupSchema) as PaginateModel<any>,
  Announcement: mongoose.model<announcementInterface>('Announcement', announcementSchema) as PaginateModel<any>,
  Event: mongoose.model<eventInterface>('Event', EventSchema) as PaginateModel<any>,
  EventGuest: mongoose.model<eventGuestInterface>('EventGuest', EventGuestSchema) as PaginateModel<any>,
  AssignedCourses: mongoose.model<assignedContentInterface>('AssignedCourses', AssignedCoursesSchema) as PaginateModel<any>,
  RecommendedCourses: mongoose.model<RecommendedCourseInterface>('RecommendedCourses', RecommendedCourseSchema) as PaginateModel<any>,
  Contents: mongoose.model<contentInterface>('Contents', ContentSchema) as PaginateModel<any>,
  AchievedBadges: mongoose.model<achievedBadgesInterface>("AchievedBadges", achievedBadgesSchema) as PaginateModel<any>,
  Notification: mongoose.model<notificationInterface>("Notification", Notification) as PaginateModel<any>,
  Badge: mongoose.model<badgeInterface>("Badge", badgeSchema) as PaginateModel<any>,
  Reminder: mongoose.model<reminderInterface>('Reminder', reminderSchema) as PaginateModel<any>,
  ThinkificWebhooks: mongoose.model<ThinkificWebhooksInterface>('ThinkificWebhooks', ThinkificWebhooksSchema) as PaginateModel<any>,
  ThinkificCourses: mongoose.model<ThinkificCourseInterface>('ThinkificCourses', thinkificCourseSchema) as PaginateModel<any>,
  Notes: mongoose.model<noteInterface>('Note', noteSchema) as PaginateModel<any>,
  NotificationManage: mongoose.model<notificationManageInterface>('NotificationManage', NotificationManageSchema) as PaginateModel<any>,
  UserActivity: mongoose.model<UserActivityInterface>('UserActivity', UserActivitySchema) as PaginateModel<any>,
};
