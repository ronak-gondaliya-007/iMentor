import { authController } from "../../Controller/Web/auth.controller";
import { PushNotification, sendNotification } from "../../Controller/Web/notification.controller";
import { msg_Type, notificationMessage, notificationType, reminder_status } from "../../utils/const";
import { countDocuments, distinct, findOneAndUpdate } from "../../utils/db";
import { Reminder } from "../Queues/reminder.queue";
import { Queue } from "aws-sdk/clients/lambda";

export async function queueProcess(job: any) {
    try {

        // Get the existing data from the job
        const existingData = job.data;

        // Modify the status value in the existing data
        const updatedData = {
            ...existingData,
            status: reminder_status.COMPLETED, // Set the status to "completed" or any desired value
        };

        // Update the job with the modified data
        await job.update(updatedData);

        // Send reminder popup
        const reminderUpdate = await findOneAndUpdate({
            collection: "Reminder",
            query: { _id: job.opts.jobId, userId: job.data.userId },
            update: {
                $set: {
                    status: reminder_status.COMPLETED
                }
            },
            options: { new: true }
        });

        if (reminderUpdate.type == msg_Type.ANNOUNCEMENT || reminderUpdate.type == msg_Type.PRE_MATCH_ANNOUNCEMENT) {
            await findOneAndUpdate({
                collection: "Messages",
                query: { _id: reminderUpdate.messageId },
                update: {
                    $set: {
                        isReminder: false
                    }
                },
                options: { new: true }
            });
        }

        const dataObj: any = {
            userId: reminderUpdate.userId,
            user_role: reminderUpdate.user_role,
            sendTo: [reminderUpdate.userId],
            type: notificationType.REMINDER,
            content: notificationMessage.sendReminder + reminderUpdate.title,
            dataId: reminderUpdate._id
        };
        sendNotification(dataObj);

        var isNotify = await distinct({
            collection: 'NotificationManage',
            field: 'deviceId',
            query: { user_id: reminderUpdate.userId?.toString() }
        });
        console.log("isNotify================>", isNotify);

        isNotify = isNotify.filter((device: any) => device !== '');
        isNotify = isNotify.filter((device: any) => device !== null);

        const badgeCounts = await countDocuments({
            collection: 'Notification',
            query: { to: reminderUpdate.userId, read: false }
        });

        if (isNotify.length) {

            var message = { //this may vary according to the message type (single recipient, multicast, topic, et cetera)
                registration_ids: isNotify,
                priority: "high",
                notification: {
                    title: "Reminder",
                    body: "Reminder" + " : " + reminderUpdate.title,
                    badge: badgeCounts,
                    sound: "default",
                },
                data: {
                    data: {}
                }
            };

            PushNotification(message)
        }

    } catch (err: any) {
        (global as any).io.to(job.data.userId).emit("response", (err?.message || "Something went wrong"));
    }
}

export async function failed(job: any, err: any) {

    // Get the existing data from the job
    const existingData = job.data;

    // Modify the status value in the existing data
    const updatedData = {
        ...existingData,
        status: reminder_status.FAILED, // Set the status to "failed" or any desired value
    };

    // Update the job with the modified data
    await job.update(updatedData);

    // Send reminder popup
    const updateStatus = await findOneAndUpdate({
        collection: "Reminder",
        query: { _id: job.opts.jobId, userId: job.data.userId },
        update: {
            $set: {
                status: reminder_status.FAILED
            }
        },
        options: { new: true }
    });

}

export async function reminderUpdateOrCancel(jobId: any) {

    const job = await Reminder.getJob(jobId);
    console.log(job?.data);

    if (job !== null) {
        await job.remove()
    }

    return job
}