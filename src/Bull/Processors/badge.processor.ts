// import { badges, event_status } from "../../utils/const";
// import { findOne, findOneAndUpdate, find } from "../../utils/db";
// // import { updateEventAttendSystemBadge } from "../../utils/helpers/common";
// import { Badge } from "../Queues/badge.queue";

// export async function queueProcess(job: any) {
//     try {

//         // Get the existing data from the job
//         const existingData = job.data;
//         console.log("existingData", existingData);

//         const userDetail = await findOne({
//             collection: "User",
//             query: { _id: existingData.userId },
//             project: { "_id": 1, "role": 1 }
//         });

//         await findOneAndUpdate({
//             collection: "EventGuest",
//             query: { _id: job.opts.jobId, userId: job.data.userId, eventId: job.data.eventId, isActive: true, isDel: false, status: event_status.APPROVED },
//             update: { $set: { isAttend: true } },
//             options: { new: true }
//         });

//         const approvedEvents: any = await find({ collection: "EventGuest", query: { userId: existingData.userId, status: event_status.APPROVED, isAttend: true } });

//         // if (approvedEvents?.length > 0 && approvedEvents?.length < 4) {

//         //     // If sender send a event attend first time than set their badge
//         //     updateEventAttendSystemBadge({ data: userDetail, type: badges.FTM });

//         // } else if (approvedEvents?.length > 4) {

//         //     // If sender send a event attend first time than set their badge
//         //     updateEventAttendSystemBadge({ data: userDetail, type: badges.HFMU });

//         //     // Call the function to delete user jobs
//         //     deleteUserJobs(userDetail?._id?.toString());

//         // }


//     } catch (err: any) {
//         (global as any).io.to(job.data.userId).emit("response", (err?.message || "Something went wrong"));
//     }
// }

// export async function failed(job: any, err: any) {
//     console.log("Job failed with error:", err);
// }

// export async function badgeJobRemove(jobId: any) {

//     const job = await Badge.getJob(jobId);
//     console.log(job?.data);

//     if (job != undefined && job !== null) {
//         await job.remove()
//     }

//     return job
// }

// export async function deleteEventAllJob(eventId: any) {

//     const jobs = await Badge.getJobs(['active', 'waiting', 'completed', 'failed', 'delayed']);

//     // Filter jobs with the specified userId in their data
//     const filteredJobs = jobs.filter(job => job.data.eventId === eventId);

//     // Delete the filtered jobs
//     const deletePromises = filteredJobs.map(async (job) => {
//         await job.remove();
//     });

//     // Wait for all delete operations to complete
//     await Promise.all(deletePromises);
// }

// async function deleteUserJobs(userId: any) {

//     const jobs = await Badge.getJobs(['active', 'waiting', 'completed', 'failed', 'delayed']);

//     // Filter jobs with the specified userId in their data
//     const filteredJobs = jobs.filter(job => job.data.userId === userId);

//     // Delete the filtered jobs
//     const deletePromises = filteredJobs.map(async (job) => {
//         await job.remove();
//     });

//     // Wait for all delete operations to complete
//     await Promise.all(deletePromises);
// }

// export async function updateEventsJob(users: any, eventId: any) {

//     for (let index = 0; index < users.length; index++) {
//         const element = users[index]?._id.toString();

//         const approvedEvents = await findOne({ collection: "EventGuest", query: { eventId: eventId, userId: element, status: event_status.APPROVED }, populate: [{ path: "eventId" }] });

//         const job = await Badge.getJob(approvedEvents?._id?.toString());
//         console.log(job?.data);

//         if (job !== null && job != undefined) {
//             await job.remove();

//             var options = { delay: new Date(new Date(approvedEvents?.eventId?.end_date).getTime() - new Date().getTime()).getTime(), attempts: 1, jobId: approvedEvents?._id };
//             Badge.add({ eventId: approvedEvents?.eventId?._id, eventName: approvedEvents?.eventId?.event_name, userId: element, startDate: approvedEvents?.eventId?.start_date, endDate: approvedEvents?.eventId?.end_date }, options);
//         }

//         return job

//     }

// }

// export async function removedUserEventsJob(users: any, eventId: any) {

//     for (let index = 0; index < users.length; index++) {
//         const element = users[index]?._id.toString();

//         const approvedEvents = await findOne({ collection: "EventGuest", query: { eventId: eventId, userId: element, status: event_status.APPROVED }, populate: [{ path: "eventId" }] });

//         const job = await Badge.getJob(approvedEvents?._id?.toString());
//         console.log(job?.data);

//         if (job !== null && job !== undefined) {
//             await job.remove();
//         }

//         return job

//     }

// }