import { distinct, find, findOne, findOneAndUpdate, insertOne, updateMany } from "../../utils/db";
import { logger } from "../../utils/helpers/logger";
import { badge_type, badges, errorMessage, eventStatusConstant, event_status, notificationMessage, notificationType, statusCode, statusType } from "../const";
import { PushNotification } from '../../Controller/Web/notification.controller';
import { authController } from '../../Controller/Web/auth.controller';

/* When update schedule event add or remove guest common function */
export const updateGuestList = async (req: any) => {
    try {
        console.log(req);

        // Get old guest list
        const getEventGuest = await find({
            collection: "EventGuest",
            query: { eventId: req.event_id, isDel: false },
            project: { userId: 1 }
        });

        const oldGuest: any = [];
        getEventGuest.map((ele: any) => {
            oldGuest.push(ele.userId.toString());
        });

        // Find new guests (elements in newArr but not in oldArr)
        const newGuest = req.guest.filter((item: any) => !oldGuest.includes(item));

        // Find guests to be removed (elements in oldArr but not in newArr)
        const removableGuest = oldGuest.filter((item: any) => !req.guest.includes(item));

        for (let index = 0; index < newGuest.length; index++) {
            const element = newGuest[index];

            await insertOne({
                collection: "EventGuest",
                document: {
                    eventId: req.event_id,
                    userId: element,
                    isActive: req.status
                }
            });
        }

        for (let index = 0; index < removableGuest.length; index++) {
            const element = removableGuest[index];

            await findOneAndUpdate({
                collection: "EventGuest",
                query: { eventId: req.event_id },
                update: { $set: { isDel: true } },
                options: { new: true }
            });
        }

        // update already invited user invite status
        await updateMany({
            collection: "EventGuest",
            query: { eventId: req.event_id, isDel: false, isActive: true },
            update: { $set: { status: event_status.PENDING } },
            options: { new: true }
        });

    } catch (err: any) {
        logger.error(`There was an issue into update guest list.: ${err}`)
        // res.status(statusCode.FORBIDDEN).send(error("There was an issue into update guest list.", err.message, statusCode.FORBIDDEN))
    }
}

/* Common function for update matched system badge in mentee or mentor */
export const updateMatchedBadge = async (req: any) => {
    try {
        const payload = req.data;

        const isMentorMatched = await findOne({
            collection: "AchievedBadges",
            query: { senderId: null, receiverId: payload.mentorId, badgeName: badges.MATCHED }
        });

        if (!isMentorMatched) {
            // If mentor first match with mentee than give matched badge
            const getMentorInfo = await find({
                collection: "PairInfo",
                query: { mentorId: payload.mentorId, isDel: false, isConfirm: true }
            });

            if (getMentorInfo.length == 1) {

                await insertOne({
                    collection: "AchievedBadges",
                    document: {
                        receiverId: payload.mentorId,
                        badgeName: badges.MATCHED,
                        type: badge_type.SYSTEM,
                        achievedDate: new Date()
                    }
                });

            }
        }

        const isMenteeMatched = await findOne({
            collection: "AchievedBadges",
            query: { senderId: null, receiverId: payload.menteeId, badgeName: badges.MATCHED }
        });

        if (!isMenteeMatched) {
            // If mentee first match with mentor than give matched badge
            const getMenteeInfo = await find({
                collection: "PairInfo",
                query: { menteeId: payload.menteeId, isDel: false, isConfirm: true }
            });

            if (getMenteeInfo.length == 1) {

                await insertOne({
                    collection: "AchievedBadges",
                    document: {
                        receiverId: payload.menteeId,
                        badgeName: badges.MATCHED,
                        type: badge_type.SYSTEM,
                        achievedDate: new Date()
                    }
                });

            }
        }

    } catch (err: any) {
        logger.error(`There was an issue into update system badge.: ${err}`)
    }
}

/* Common function for update first message system badge in mentee or mentor */
export const updateMessageSystemBadge = async (req: any) => {
    try {
        const payload = req.data;
        const badgeType = req.type;

        const isFirstMessage = await findOne({
            collection: "AchievedBadges",
            query: { senderId: null, receiverId: payload._id, badgeName: badgeType }
        });

        if (!isFirstMessage) {

            const getMessageList = await find({
                collection: "Messages",
                query: { senderId: payload.user_id }
            });

            if (getMessageList.length == 1) {

                await insertOne({
                    collection: "AchievedBadges",
                    document: {
                        receiverId: payload.user_id,
                        badgeName: badges.FMS,
                        type: badge_type.SYSTEM,
                        achievedDate: new Date()
                    }
                });

            }

            if (getMessageList.length == 5) {

                await insertOne({
                    collection: "AchievedBadges",
                    document: {
                        receiverId: payload.user_id,
                        badgeName: badges.HFM,
                        type: badge_type.SYSTEM,
                        achievedDate: new Date()
                    }
                });

            }

        }

    } catch (err: any) {
        logger.error(`There was an issue into update system badge.: ${err}`)
    }
}

/* Common function for update first event system badge in mentee or mentor */
export const updateFirstEventSystemBadge = async (req: any) => {
    try {
        const payload = req.data;

        const isFirstEventCreated = await findOne({
            collection: "AchievedBadges",
            query: { senderId: null, receiverId: payload._id, badgeName: badges.FER }
        });

        if (!isFirstEventCreated) {

            const getEventList = await find({
                collection: "Event",
                query: { userId: payload._id }
            });

            if (getEventList.length == 1) {

                await insertOne({
                    collection: "AchievedBadges",
                    document: {
                        receiverId: payload._id,
                        badgeName: badges.FER,
                        type: badge_type.SYSTEM,
                        achievedDate: new Date()
                    }
                });

            }

        }

    } catch (err: any) {
        logger.error(`There was an issue into update system badge.: ${err}`)
    }
}

/* Common function for update first event system badge in mentee or mentor */
export const updateEventAttendSystemBadge = async (req: any) => {
    try {
        const payload = req.data;
        const badgeType = req.type;

        const isFirstEventAccept = await findOne({
            collection: "AchievedBadges",
            query: { senderId: null, receiverId: payload._id, badgeName: badgeType }
        });

        if (!isFirstEventAccept) {

            // const getEventGuestList = await find({
            //     collection: "EventGuest",
            //     query: { userId: payload._id, status: event_status.APPROVED }
            // });

            // if (getEventGuestList.length == 1) {

            await insertOne({
                collection: "AchievedBadges",
                document: {
                    receiverId: payload._id,
                    badgeName: badgeType,
                    type: badge_type.SYSTEM,
                    achievedDate: new Date()
                }
            });

            // }

        }

    } catch (err: any) {
        logger.error(`There was an issue into update system badge.: ${err}`)
    }
}

/* Common function for update application complete system badge in mentee or mentor */
export const updateApplicationCompleteSystemBadge = async (req: any) => {
    try {
        const payload = req.data;

        const isApplicationCompleted = await findOne({
            collection: "AchievedBadges",
            query: { senderId: null, receiverId: payload.userId, badgeName: badges.AC }
        });

        if (!isApplicationCompleted) {

            const getUserInfo = await find({
                collection: "User",
                query: { userId: payload.userId, onboardingStep: 5, status: statusType.COMPLETED, isDel: false }
            });

            if (getUserInfo) {

                await insertOne({
                    collection: "AchievedBadges",
                    document: {
                        receiverId: payload.userId,
                        badgeName: badges.AC,
                        type: badge_type.SYSTEM,
                        achievedDate: new Date()
                    }
                });

            }

        }

    } catch (err: any) {
        logger.error(`There was an issue into update application completed system badge.: ${err}`)
    }
}

/* Common function for update application complete system badge in mentee or mentor */
export const updateProjectCompleteSystemBadge = async (req: any) => {
    try {
        const payload = req.data;

        const isProjectCompleted = await findOne({
            collection: "AchievedBadges",
            query: { senderId: null, receiverId: payload._id, badgeName: badges.PC }
        });

        if (!isProjectCompleted) {

            await insertOne({
                collection: "AchievedBadges",
                document: {
                    receiverId: payload._id,
                    badgeName: badges.PC,
                    type: badge_type.SYSTEM,
                    achievedDate: new Date()
                }
            });

        }

    } catch (err: any) {
        logger.error(`There was an issue into update project completed system badge.: ${err}`)
    }
}