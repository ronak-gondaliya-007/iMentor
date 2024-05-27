import { Request, Response } from "express";
import { faker } from '@faker-js/faker';
import { requestUser } from "../Interfaces/schemaInterfaces/user";
import { course_type, msg_Type, notificationType, userRoleConstant, userStatusConstant } from "../utils/const";
import { distinct, find, findOne, insertMany, insertOne } from "../utils/db";
import { createOrGetUser, enrollCourse } from "../services/thinkific/thinkific.service";
import { v4 as uuidv4 } from 'uuid';
import { addToSingleMatches } from "../Bull/Queues/pair-script.queue";
import { getContent } from "../Validators/content";

const generateRandomPhoneNumber = (): string => {
    const randomNumber = () => Math.floor(Math.random() * 10);
    const phoneNumber = Array.from({ length: 10 }, randomNumber).join('');
    return `(${phoneNumber.slice(0, 3)})-${phoneNumber.slice(3, 6)}-${phoneNumber.slice(6)}`;
};

const generateRandomUserName = (): string => {
    const uniqueName = `${faker.person.fullName()}`;
    return uniqueName;
};

const generateUniqueRandomFirstName = (): string => {
    const uniqueName = `${faker.person.firstName()}`;
    return uniqueName;
};

const generateUniqueRandomLastName = (): string => {
    const uniqueName = `${faker.person.lastName()}`;
    return uniqueName;
};

const generateUniqueRandomEmail = async (name: string): Promise<string> => {
    let email = `${name}@yopmail.com`;

    // Check if the email already exists in the database
    let isEmailExists = await findOne({
        collection: 'User',
        query: { email: email?.toLowerCase(), isDel: false }
    });

    // If the email exists, generate a new one until a unique email is found
    let counter = 0;
    while (isEmailExists) {
        const randomDigit = Math.floor(Math.random() * 10);
        const newEmail = `${name}${randomDigit}@yopmail.com`;
        isEmailExists = await findOne({
            collection: 'User',
            query: { email: email?.toLowerCase(), isDel: false }
        });
        email = newEmail;

        counter++;
        if (counter > 10) {
            throw new Error('Unable to generate a unique email after 10 attempts.');
        }
    }

    return email?.toLowerCase();
};

const getRandomId = (ids: any) => {
    const randomIndex = Math.floor(Math.random() * ids.length);
    return ids[randomIndex];
};

const findIndex = (dataArray: any, id: any): number => {
    return dataArray.findIndex((item: any) => item?.toString() && item?.toString() === id);
};

const findIndexByCreatedBy = (dataArray: any, createdBy: any): number => {
    return dataArray.findIndex((item: any) => item?.toString() && item?.toString() === createdBy);
};

export let pairScriptControllors = {
    getPartnerData: async (req: Request, res: Response) => {
        try {
            let request = req as requestUser;

            // Already created mentor or mentees
            const alreadyMentor = await distinct({
                collection: 'User',
                field: '_id',
                query: { partnerAdmin: req.body.partnerId, role: userRoleConstant.MENTOR }
            });
            const alreadyMentee = await distinct({
                collection: 'User',
                field: '_id',
                query: { partnerAdmin: req.body.partnerId, role: userRoleConstant.MENTEE }
            });
            const alreadyPartners = await distinct({
                collection: 'User',
                field: '_id',
                query: { partnerAdmin: req.body.partnerId, role: { $in: [userRoleConstant.P_SUPER_ADMIN, userRoleConstant.P_LOCAL_ADMIN] } }
            });

            // Create partner Admins, matches, assign content and projects
            const getSuperPartnerAdminData = await distinct({
                collection: 'User',
                field: '_id',
                query: { partnerAdmin: req.body.duplicatePartner, role: userRoleConstant.P_SUPER_ADMIN }
            });
            const getLocalPartnerAdminData = await distinct({
                collection: 'User',
                field: '_id',
                query: { partnerAdmin: req.body.duplicatePartner, role: userRoleConstant.P_LOCAL_ADMIN }
            });

            const partners = await createSuperPartnerAdmins({ data: getSuperPartnerAdminData, partnerId: req.body.partnerId, localAdmins: getLocalPartnerAdminData });

            const partnersArray = await distinct({
                collection: 'User',
                field: '_id',
                query: { partnerAdmin: req.body.duplicatePartner, role: { $in: [userRoleConstant.P_SUPER_ADMIN, userRoleConstant.P_LOCAL_ADMIN] } }
            });
            console.log("partners array", partnersArray);

            const getNewPartner = await distinct({
                collection: 'User',
                field: '_id',
                query: { partnerAdmin: req.body.partnerId, _id: { $nin: alreadyPartners }, role: { $in: [userRoleConstant.P_SUPER_ADMIN, userRoleConstant.P_LOCAL_ADMIN] } }
            });
            console.log("partners array", getNewPartner);

            const partnersContent = await sharedPartnerContents({ data: partnersArray, newPartners: getNewPartner, partner: req.body.partnerId });

            const partnersProjects = await sharedPartnerProjects({ duplicatePartner: req.body.duplicatePartner, partner: req.body.partnerId });
            console.log("partners projects", partnersProjects);

            const partnerMatches = await allMatches({ partner: req.body.partnerId, duplicatePartner: req.body.duplicatePartner });
            console.log("partners matches", partnerMatches);

            // Create Mentors or Mentees & Pairs/Matches
            const getMentorData = await distinct({
                collection: 'User',
                field: '_id',
                query: { partnerAdmin: req.body.duplicatePartner, role: userRoleConstant.MENTOR }
            });

            const partnersMentors = await partnerMentors({ mentors: getMentorData, partner: req.body.partnerId, duplicatePartner: req.body.duplicatePartner });
            console.log("partners mentors", partnersMentors);

            const getMenteeData = await distinct({
                collection: 'User',
                field: '_id',
                query: { partnerAdmin: req.body.duplicatePartner, role: userRoleConstant.MENTEE }
            });

            const partnersMentees = await partnerMentees({ mentees: getMenteeData, partner: req.body.partnerId, duplicatePartner: req.body.duplicatePartner });
            console.log("partners mentees", partnersMentees);

            const partnerPairAndMatches = await pairsAndMatches({ partner: req.body.partnerId, duplicatePartner: req.body.duplicatePartner, mentors: partnersMentors, mentees: partnersMentees });
            console.log("partners pair and matches", partnerPairAndMatches);

            if (partnerPairAndMatches) {
                const partnerOldUserMatches = await oldUserMatches({ mentors: alreadyMentor, mentees: alreadyMentee, newMentor: partnersMentors, newMentee: partnersMentees });
                console.log("partners pair and matches", partnerOldUserMatches);

                // Under partner all events and event guest records
                const partnerEvents = await eventAndEventGuestPartner({
                    partner: req.body.partnerId, newPartners: getNewPartner, duplicatePartner: req.body.duplicatePartner, partners: partnersArray, mentors: getMentorData, mentees: getMenteeData,
                    newMentor: partnersMentors, newMentee: partnersMentees
                });
                console.log("partners events", partnerEvents);

                // Under partner all Groups and group member records
                const partnerGroupsData = await partnerGroups({
                    partner: req.body.partnerId, duplicatePartner: req.body.duplicatePartner, newPartners: getNewPartner, newMentor: partnersMentors, newMentee: partnersMentees,
                    partners: partnersArray, mentors: getMentorData, mentees: getMenteeData
                });
                console.log("partners groups data", partnerGroupsData);

                // Under partner all annoucement records
                const partnerAnnoucements = await partnerAnnoucement({
                    partner: req.body.partnerId, newPartners: getNewPartner, partners: partnersArray, duplicatePartner: req.body.duplicatePartner, mentors: getMentorData, mentees: getMenteeData,
                    newMentor: partnersMentors, newMentee: partnersMentees
                });
                console.log("partners annoucenent", partnerAnnoucements);

                // Under partner all recommanded course mentor or mentee
                const partnerRecommandedCourses = await partnerRecommandedCourse({
                    partner: req.body.partnerId, newPartners: getNewPartner, partners: partnersArray, duplicatePartner: req.body.duplicatePartner, mentors: getMentorData, mentees: getMenteeData,
                    newMentor: partnersMentors, newMentee: partnersMentees
                });
                console.log("partner recommanded courses", partnerRecommandedCourses);

                // Partner, mentor or mentee conversations
                const partnerMessages = await userMessages({
                    partner: req.body.partnerId, duplicatePartner: req.body.duplicatePartner, newPartners: getNewPartner, partners: partnersArray, mentors: getMentorData, mentees: getMenteeData,
                    newMentor: partnersMentors, newMentee: partnersMentees
                });
                console.log("partners messages", partnerMessages);

                // Mentor or mentee achiaved badges
                const mentorMenteeBadge = await mentorMenteeBadges({
                    partner: req.body.partnerId, newPartners: getNewPartner, partners: partnersArray, mentors: getMentorData, mentees: getMenteeData, newMentor: partnersMentors, newMentee: partnersMentees
                });
                console.log("mentor mentee badges", mentorMenteeBadge);

                // Partner, mentor or mentee reminders
                const reminders = await allReminder({
                    partner: req.body.partnerId, duplicatePartner: req.body.duplicatePartner, newPartners: getNewPartner, partners: partnersArray, mentors: getMentorData, mentees: getMenteeData,
                    newMentor: partnersMentors, newMentee: partnersMentees
                });
                console.log("reminders", reminders);

                // Partner, mentor or mentee notifications
                const notifications = await allNotification({
                    partner: req.body.partnerId, duplicatePartner: req.body.duplicatePartner, newPartners: getNewPartner, partners: partnersArray, mentors: getMentorData, mentees: getMenteeData,
                    newMentor: partnersMentors, newMentee: partnersMentees
                });
                console.log("notifications", notifications);

                // Partner notes
                const notes = await allNote({
                    partner: req.body.partnerId, duplicatePartner: req.body.duplicatePartner, newPartners: getNewPartner, partners: partnersArray, mentors: getMentorData, mentees: getMenteeData,
                    newMentor: partnersMentors, newMentee: partnersMentees
                });
                console.log("notes", notes);

                return res.send('success');
            }

            return res.send('unsuccess');
        } catch (error) {
            console.log("Get Partner Data Count", error);
        }
    }
};

const createSuperPartnerAdmins = async (req: any) => {
    try {
        console.log("create super partner admins function =============> ");
        let partner: any = [];

        for (let index = 0; index < req.data?.length; index++) {
            const element = req.data[index];

            const getPartner = await findOne({
                collection: 'User',
                query: { _id: element },
                project: ["-_id"]
            });

            getPartner.legalFname = generateUniqueRandomFirstName();
            getPartner.legalLname = generateUniqueRandomLastName();
            getPartner.preferredFname = getPartner.legalFname;
            getPartner.preferredLname = getPartner.legalLname;
            getPartner.primaryPhoneNo = generateRandomPhoneNumber();
            getPartner.email = await generateUniqueRandomEmail(`${getPartner.legalFname}.${getPartner.legalLname}`);
            getPartner.partnerAdmin = req.partnerId;

            let thinkificUser = await createOrGetUser({
                email: getPartner.email,
                firstName: getPartner.preferredFname,
                lastName: getPartner.preferredLname
            });
            getPartner.thinkificUserId = thinkificUser?.id;

            const user = await insertOne({
                collection: 'User',
                document: getPartner
            });
            if (getPartner.status == userStatusConstant.ACTIVE) {
                partner.push(user._id);
            }
        }

        if (partner?.length && req.localAdmins?.length) {
            await createLocalPartnerAdmins({ data: req.localAdmins, partnerId: req.partnerId, createdBy: getRandomId(partner) })
        }

        return true;

    } catch (error) {
        console.log("create super partner admins error ============> ", error);
    }
}

const createLocalPartnerAdmins = async (req: any) => {
    try {
        console.log("create local partner admins function =============> ");

        // let localPartners:any = [];

        for (let index = 0; index < req.data?.length; index++) {
            const element = req.data[index];

            const getPartner = await findOne({
                collection: 'User',
                query: { _id: element },
                project: ["-_id"]
            });

            getPartner.legalFname = generateUniqueRandomFirstName();
            getPartner.legalLname = generateUniqueRandomLastName();
            getPartner.preferredFname = getPartner.legalFname;
            getPartner.preferredLname = getPartner.legalLname;
            getPartner.primaryPhoneNo = generateRandomPhoneNumber();
            getPartner.email = await generateUniqueRandomEmail(`${getPartner.legalFname}.${getPartner.legalLname}`);
            getPartner.partnerAdmin = req.partnerId;
            getPartner.createdBy = req.createdBy;

            let thinkificUser = await createOrGetUser({
                email: getPartner.email,
                firstName: getPartner.preferredFname,
                lastName: getPartner.preferredLname
            });
            getPartner.thinkificUserId = thinkificUser?.id;

            let localPartner = await insertOne({
                collection: 'User',
                document: getPartner
            });
        }

        return true;

    } catch (error) {
        console.log("create local partner admins error ============> ", error);
    }
}

const sharedPartnerContents = async (req: any) => {
    try {
        console.log("shared partner contents ===========> ");

        const getContents = await find({
            collection: 'Contents',
            query: { $or: [{ partnerIdOrRegionId: { $in: req.data } }, { createdBy: { $in: req.data } }] },
            project: ["-_id"]
        });
        console.log("get content ========> ", getContents);

        for (let index = 0; index < getContents.length; index++) {
            const ele = getContents[index];

            const createdByIndex = findIndexByCreatedBy(req.data, ele.createdBy?.toString());
            ele.partnerId = req.partner;
            ele.partnerIdOrRegionId = req.partner;
            ele.createdBy = req.newPartners[createdByIndex];

            await insertOne({
                collection: 'Contents',
                document: ele
            });
        };


        return true

    } catch (error) {
        console.log("shared partner contents error ============> ", error);
    }
}

const sharedPartnerProjects = async (req: any) => {
    try {
        console.log("shared partner projects ===========> ");

        const getProjects = await find({
            collection: 'AssignedCourses',
            query: { partnerId: req.duplicatePartner },
            project: ["-_id"]
        });

        let newProjects: any = [];

        getProjects.map((ele: any) => {
            ele.partnerId = req.partner;
            ele.partnerIdOrRegionId = req.partner;
            newProjects.push(ele);
        });

        await insertMany({
            collection: 'AssignedCourses',
            documents: newProjects
        });

        return true

    } catch (error) {
        console.log("shared partner projects error ============> ", error);
    }
}

const allMatches = async (req: any) => {
    try {
        console.log("all matches ===========> ");

        const newMentors = distinct({
            collection: 'User',
            field: "_id",
            query: { partnerAdmin: req.partner, role: userRoleConstant.MENTOR }
        });
        const newMentees = distinct({
            collection: 'User',
            field: "_id",
            query: { partnerAdmin: req.partner, role: userRoleConstant.MENTEE }
        });
        const matches = find({
            collection: 'Matches',
            query: { partnerId: req.duplicatePartner },
            project: ["-_id"]
        });
        const getPartner = findOne({
            collection: 'Partner',
            query: { _id: req.partner }
        });
        const response: any = await Promise.allSettled([newMentors, newMentees, matches, getPartner]);

        for (let index = 0; index < response[2].value.length; index++) {
            const element = response[2].value[index];

            const verify = await findOne({
                collection: 'Matches',
                query: { question: element.question, partnerId: req.partner }
            });

            if (!verify) {
                element.partnerId = req.partner;
                element.createdBy = response[3].value.createdBy;

                element.option?.map((ele: any) => {
                    delete ele._id;
                });

                await insertOne({
                    collection: 'Matches',
                    document: element
                });
            }
        }

        return true;
    } catch (error) {
        console.log("all matches error ============> ", error);
    }
}

const partnerMentors = async (req: any) => {
    try {

        const newMatches = await distinct({
            collection: 'Matches',
            field: "_id",
            query: { partnerId: req.partner },
        });

        const oldMatches = await distinct({
            collection: 'Matches',
            field: "_id",
            query: { partnerId: req.duplicatePartner },
        });

        let newMentors: any = [];

        for (let index = 0; index < req.mentors.length; index++) {
            const element = req.mentors[index];

            const mentorUser = findOne({
                collection: 'User',
                query: { _id: element },
                project: ["-_id"]
            });

            const mentorAdditionalInfo = findOne({
                collection: 'AdditionalInfo',
                query: { userId: element },
                project: ["-_id"]
            });

            const mentorQueAns = findOne({
                collection: 'AnswerByMentors',
                query: { user: element },
                project: ["-_id"]
            });

            const response: any = await Promise.allSettled([mentorUser, mentorAdditionalInfo, mentorQueAns]);

            // User
            response[0].value.legalFname = generateUniqueRandomFirstName();
            response[0].value.legalLname = generateUniqueRandomLastName();
            response[0].value.email = await generateUniqueRandomEmail(`${response[0].value.legalFname}.${response[0].value.legalLname}`);
            response[0].value.preferredFname = response[0].value.legalFname;
            response[0].value.preferredLname = response[0].value.legalLname;
            response[0].value.primaryPhoneNo = generateRandomPhoneNumber();
            response[0].value.partnerAdmin = req.partner;
            response[0].value.profilePic = "";

            let thinkificUser = await createOrGetUser({
                email: response[0].value.email,
                firstName: response[0].value.preferredFname,
                lastName: response[0].value.preferredLname
            });

            response[0].value.thinkificUserId = thinkificUser.id;

            const newMentor = await insertOne({
                collection: 'User',
                document: response[0].value
            });
            newMentors.push(newMentor._id);

            // AdditionalInfo
            if (response[1].value == null) {
                response[1].value = {};
                response[1].value.userId = newMentor._id;
                response[1].value.createdAt = newMentor.createdAt;
                response[1].value.updatedAt = newMentor.updatedAt;
            } else {
                response[1].value.userId = newMentor._id;
            }

            // QuestionAnswer
            if (response[2].value == null) {
                response[2].value = {};
                response[2].value.queAns = [];
                response[2].value.user = newMentor._id;
                response[2].value.createdBy = req.partner;
            } else {
                response[2].value.queAns?.map((ele: any) => {
                    if (ele.question) {
                        const questionIndex = findIndex(oldMatches, ele.question?.toString());
                        ele.question = newMatches[questionIndex];
                    }
                    delete ele._id;
                });
                response[2].value.user = newMentor._id;
                response[2].value.createdBy = req.partner;
            }

            await insertOne({
                collection: 'AdditionalInfo',
                document: response[1].value
            });
            await insertOne({
                collection: 'AnswerByMentors',
                document: response[2].value
            });

        }

        return newMentors;
    } catch (error) {
        console.log("partner mentors error ============> ", error);
    }
}

const partnerMentees = async (req: any) => {
    try {

        const newMatches = await distinct({
            collection: 'Matches',
            field: "_id",
            query: { partnerId: req.partner },
        });

        const oldMatches = await distinct({
            collection: 'Matches',
            field: "_id",
            query: { partnerId: req.duplicatePartner },
        });

        let newMentees: any = [];

        for (let index = 0; index < req.mentees.length; index++) {
            const element = req.mentees[index];

            const menteeUser = findOne({
                collection: 'User',
                query: { _id: element },
                project: ["-_id"]
            });

            const menteeAdditionalInfo = findOne({
                collection: 'AdditionalInfo',
                query: { userId: element },
                project: ["-_id"]
            });

            const menteeQueAns = findOne({
                collection: 'AnswerByMentee',
                query: { user: element },
                project: ["-_id"]
            });

            const response: any = await Promise.allSettled([menteeUser, menteeAdditionalInfo, menteeQueAns]);

            // User
            response[0].value.legalFname = generateUniqueRandomFirstName();
            response[0].value.legalLname = generateUniqueRandomLastName();
            response[0].value.email = await generateUniqueRandomEmail(`${response[0].value.legalFname}.${response[0].value.legalLname}`);
            response[0].value.preferredFname = response[0].value.legalFname;
            response[0].value.preferredLname = response[0].value.legalLname;
            response[0].value.primaryPhoneNo = generateRandomPhoneNumber();
            response[0].value.partnerAdmin = req.partner;
            response[0].value.profilePic = "";
            response[0].value.guardianFname = generateUniqueRandomFirstName();
            response[0].value.guardianLname = generateUniqueRandomLastName();
            response[0].value.guardianEmail = await generateUniqueRandomEmail(`${response[0].value.guardianFname}.${response[0].value.guardianLname}`);
            response[0].value.guardianPhone = generateRandomPhoneNumber();
            response[0].value.guardianSecondaryPhoneNo = response[0].value.guardianSecondaryPhoneNo ? generateRandomPhoneNumber() : '';
            response[0].value.recoveryEmail = '';
            response[0].value.secondaryPhoneNo = response[0].value.secondaryPhoneNo ? generateRandomPhoneNumber() : '';
            response[0].value.pronounciationName = response[0].value.pronounciationName ? generateRandomUserName() : '';

            let thinkificUser = await createOrGetUser({
                email: response[0].value.email,
                firstName: response[0].value.preferredFname,
                lastName: response[0].value.preferredLname
            });

            response[0].value.thinkificUserId = thinkificUser.id;

            const newMentee = await insertOne({
                collection: 'User',
                document: response[0].value
            });
            newMentees.push(newMentee._id);

            // AdditionalInfo
            if (response[1].value == null) {
                response[1].value = {};
                response[1].value.userId = newMentee._id;
                response[1].value.createdAt = newMentee.createdAt;
                response[1].value.updatedAt = newMentee.updatedAt;
            } else {
                response[1].value.userId = newMentee._id;
            }

            // QuestionAnswer
            if (response[2].value == null) {
                response[2].value = {};
                response[2].value.queAns = [];
                response[2].value.user = newMentee._id;
                response[2].value.createdBy = req.partner;
            } else {
                response[2].value.queAns?.map((ele: any) => {
                    if (ele.question) {
                        const questionIndex = findIndex(oldMatches, ele.question?.toString());
                        ele.question = newMatches[questionIndex];
                    }
                    delete ele._id;
                });
                response[2].value.user = newMentee._id;
                response[2].value.createdBy = req.partner;
            }

            await insertOne({
                collection: 'AdditionalInfo',
                document: response[1].value
            });
            await insertOne({
                collection: 'AnswerByMentee',
                document: response[2].value
            });

        }

        return newMentees;
    } catch (error) {
        console.log("partner mentees error ============> ", error);
    }
}

const pairsAndMatches = async (req: any) => {
    try {
        console.log("pairs and matches ===========> ");

        const getMentors = distinct({
            collection: 'User',
            field: "_id",
            query: { partnerAdmin: req.duplicatePartner, role: userRoleConstant.MENTOR }
        });
        const getMentees = distinct({
            collection: 'User',
            field: "_id",
            query: { partnerAdmin: req.duplicatePartner, role: userRoleConstant.MENTEE }
        });
        const partnerDetail = findOne({
            collection: 'Partner',
            query: { _id: req.partner }
        });
        const response: any = await Promise.allSettled([getMentors, getMentees, partnerDetail]);

        for (let index = 0; index < response[0].value.length; index++) {
            const element = response[0].value[index];
            console.log(element);
            console.log(index);

            const matches = await find({
                collection: 'PairInfo',
                query: { mentorId: element },
                project: ["-_id"]
            });
            console.log("Main Matches Length ============> ", matches.length);

            for (let i = 0; i < matches.length; i++) {
                const ele = matches[i];
                console.log(i);

                const getMenteeeIndex = findIndex(response[1].value, ele.menteeId?.toString());
                ele.mentorId = req.mentors[index];
                ele.menteeId = req.mentees[getMenteeeIndex];
                ele.location = response[2].value?.region;
                ele.partner = response[2].value?.partnerName;
                ele.partnerId = response[2].value?._id;
                ele.partnerIdOrRegionId = req.partner;
                ele.school = response[2].value?.assignedSchoolOrInstitute;

                const verify = await findOne({
                    collection: 'PairInfo',
                    query: { $and: [{ mentorId: ele.mentorId }, { menteeId: ele.menteeId }] }
                });

                if (!verify) {
                    await insertOne({
                        collection: 'PairInfo',
                        document: ele
                    });
                }
            };

        }

        return true;
    } catch (error) {
        console.log("partner mentees error ============> ", error);
    }
}

const oldUserMatches = async (req: any) => {
    try {
        console.log("old user matches ===========> ", req);

        for (let index = 0; index < req.newMentor?.length; index++) {
            const element = req.newMentor[index];

            req.mentees.map(async (ele: any) => {
                await addToSingleMatches({ mentorId: element?.toString(), user: ele?.toString(), jobId: uuidv4() });
            });
        }

        for (let index = 0; index < req.newMentee?.length; index++) {
            const element = req.newMentee[index];

            req.mentors.map(async (ele: any) => {
                await addToSingleMatches({ menteeId: element?.toString(), user: ele?.toString(), jobId: uuidv4() });
            });
        }

        return true;
    } catch (error) {
        console.log("old user matches error ============> ", error);
    }
}

const partnerGroups = async (req: any) => {
    try {
        console.log("partner groups =============> ");

        const groups = await find({
            collection: 'Group',
            query: { partner: req.duplicatePartner },
            project: ["-_id"]
        });

        let oldArray = [...req.mentors, ...req.mentees];
        let newArray = [...req.newMentor, ...req.newMentee];

        for (let index = 0; index < groups.length; index++) {
            const element = groups[index];
            element.partner = req.partner;

            const partnerIndex = findIndex(req.partners, element.groupAdmin?.toString());
            element.groupAdmin = req.newPartners[partnerIndex];

            element.groupMember = element.groupMember?.map((ele: any) => {
                const memberIndex = findIndex(oldArray, ele?.toString());
                return newArray[memberIndex];
            });

            await insertOne({
                collection: 'Group',
                document: element
            });
        }

        return true;
    } catch (error) {
        console.log("partner groups error ============> ", error);
    }
}

const eventAndEventGuestPartner = async (req: any) => {
    try {
        console.log("event and event guest partner ============> ");

        const getEventsPromise = find({
            collection: 'Event',
            query: { partnerId: req.duplicatePartner, isDel: false },
        });
        const oldGroupsPromise = distinct({
            collection: 'Group',
            field: "_id",
            query: { partner: req.duplicatePartner },
        });
        const groupsPromise = distinct({
            collection: 'Group',
            field: "_id",
            query: { partner: req.partner },
        });
        const oldPairsPromise = distinct({
            collection: 'PairInfo',
            field: "_id",
            query: { partnerIdOrRegionId: req.duplicatePartner, isConfirm: true },
        });
        const pairsPromise = distinct({
            collection: 'PairInfo',
            field: "_id",
            query: { partnerIdOrRegionId: req.partner, isConfirm: true },
        });

        const [getEvents, oldGroups, groups, oldPairs, pairs] = await Promise.all([
            getEventsPromise,
            oldGroupsPromise,
            groupsPromise,
            oldPairsPromise,
            pairsPromise
        ]);

        let oldArray = [...req.partners, ...req.mentors, ...req.mentees];
        let newArray = [...req.newPartners, ...req.newMentor, ...req.newMentee];

        for (let index = 0; index < getEvents.length; index++) {
            const element = getEvents[index];

            element.partnerId = req.partner;

            const userIndex = findIndex(oldArray, element.userId?.toString());
            element.userId = newArray[userIndex];

            element.guest = element.guest?.map((ele: any) => {
                const guestIndex = findIndex(oldArray, ele?.toString());
                return newArray[guestIndex];
            });

            if (element?.pairId?.length) {
                element.pairId = element.pairId?.map((ele: any) => {
                    const pairIndex = findIndex(oldPairs, ele?.toString());
                    return pairs[pairIndex];
                });
            }
            if (element?.groupId?.length) {
                element.groupId = element.groupId?.map((ele: any) => {
                    const groupIndex = findIndex(oldGroups, ele?.toString());
                    return groups[groupIndex];
                });
            }
            if (element?.mentorMenteeId?.length) {
                element.mentorMenteeId = element.mentorMenteeId?.map((ele: any) => {
                    const mentorMenteeIndex = findIndex(oldArray, ele?.toString());
                    return newArray[mentorMenteeIndex];
                });
            }

            const eventGuest = await find({
                collection: 'EventGuest',
                query: { eventId: element._id },
                project: ["-_id"]
            });

            delete element._id;
            const event = await insertOne({
                collection: 'Event',
                document: element
            });

            if (eventGuest.length) {
                for (let i = 0; i < eventGuest.length; i++) {
                    const ele = eventGuest[i];

                    ele.eventId = event._id;
                    const userIndex = findIndex(oldArray, ele.userId?.toString());
                    ele.userId = newArray[userIndex];
                    ele.attendance = ele.attendance;

                    await insertOne({
                        collection: 'EventGuest',
                        document: ele
                    });
                }

            }
        }

        return true;

    } catch (error) {
        console.log("event and event guest partner error ==============> ", error);
    }
}

const partnerAnnoucement = async (req: any) => {
    try {
        console.log("partner annoucements ============> ");

        const getPairsPromise = distinct({
            collection: 'PairInfo',
            field: '_id',
            query: { partnerIdOrRegionId: req.partner, isConfirm: true }
        });

        const getGroupsPromise = distinct({
            collection: 'Group',
            field: '_id',
            query: { partner: req.partner, isDel: false },
        });

        const getOldPairsPromise = distinct({
            collection: 'PairInfo',
            field: '_id',
            query: { partnerIdOrRegionId: req.duplicatePartner, isConfirm: true }
        });

        const getOldGroupsPromise = distinct({
            collection: 'Group',
            field: '_id',
            query: { partner: req.duplicatePartner, isDel: false },
        });

        const getAnnoucementsPromise = find({
            collection: 'Announcement',
            query: { partnerIdOrRegionId: req.duplicatePartner },
            project: ["-_id"]
        });

        const [getPairs, getGroups, getOldPairs, getOldGroups, getAnnouncements] = await Promise.all([
            getPairsPromise,
            getGroupsPromise,
            getOldPairsPromise,
            getOldGroupsPromise,
            getAnnoucementsPromise
        ]);

        let oldArray = [...req.partners, ...req.mentors, ...req.mentees, ...getOldPairs, ...getOldGroups];
        let newArray = [...req.newPartners, ...req.newMentor, ...req.newMentee, ...getPairs, ...getGroups];

        for (let index = 0; index < getAnnouncements.length; index++) {
            const element = getAnnouncements[index];
            console.log("element===========>", element);

            element.partnerId = req.partner;
            element.partnerIdOrRegionId = req.partner;

            const sendFromIndex = findIndex(oldArray, element.sendFrom?.toString());
            element.sendFrom = newArray[sendFromIndex];

            if (element.sendTo.length) {
                let newSendTo = element.sendTo.map((ele: any) => {
                    const sendToIndex = findIndex(oldArray, ele?.toString());
                    return newArray[sendToIndex];
                });
                element.sendTo = newSendTo;
            }

            if (element.groups.length) {
                let newGroups = element.groups.map((ele: any) => {
                    const groupsIndex = findIndex(oldArray, ele?.toString());
                    console.log("groupsIndex===========>", groupsIndex);
                    return newArray[groupsIndex];
                });
                element.groups = newGroups;
            }

            if (element.pairs.length) {
                let newPairs = element.pairs.map((ele: any) => {
                    const pairsIndex = findIndex(oldArray, ele?.toString());
                    return newArray[pairsIndex];
                });
                element.pairs = newPairs;
            }

            await insertOne({
                collection: 'Announcement',
                document: element
            });
        }

        return true;

    } catch (error) {
        console.log("partner annoucements error ==============> ", error);
    }
}

const partnerRecommandedCourse = async (req: any) => {
    try {
        console.log("partner recommanded course ============> ");

        const getContentsPromise = distinct({
            collection: 'Contents',
            field: '_id',
            query: { partnerIdOrRegionId: req.partner },
        });

        const getOldContentsPromise = distinct({
            collection: 'Contents',
            field: '_id',
            query: { partnerIdOrRegionId: req.duplicatePartner },
        });

        const getRecommandedPromise = find({
            collection: 'RecommendedCourses',
            query: { partnerIdOrRegionId: req.duplicatePartner },
            project: ["-_id"]
        });

        const [getRecommanded, getContents, getOldContents] = await Promise.all([
            getRecommandedPromise,
            getContentsPromise,
            getOldContentsPromise
        ]);

        console.log("Old Content ======> ", getOldContents);
        console.log("Content ======> ", getContents);

        let oldArray = [...req.partners, ...req.mentors, ...req.mentees, ...getOldContents];
        let newArray = [...req.newPartners, ...req.newMentor, ...req.newMentee, ...getContents];

        for (let index = 0; index < getRecommanded.length; index++) {
            const element = getRecommanded[index];

            const userIndex = findIndex(oldArray, element.userId?.toString());
            element.userId = newArray[userIndex];

            element.percentageCompleted = 0;
            element.partnerAdmin = req.partner;
            element.partnerIdOrRegionId = req.partner;

            if (element.courseType !== course_type.CONTENT) {
                const user = await findOne({
                    collection: 'User',
                    query: { _id: element.userId }
                });
                const course = await findOne({
                    collection: 'ThinkificCourses',
                    query: { _id: element.thinkificCourseId }
                });

                if (course) {

                    // enroll user
                    const enrollData: any = {
                        userId: user.thinkificUserId,
                        courseId: course.courseId,
                        activatedAt: new Date()
                    };

                    const enroll = await enrollCourse(enrollData);
                    element.enrollId = enroll.id;
                }

            } else {
                const contentIndex = findIndex(oldArray, element.contentId?.toString());
                element.contentId = newArray[contentIndex];
            }

            await insertOne({
                collection: 'RecommendedCourses',
                document: element
            });

        }

        return true;

    } catch (error) {
        console.log("partner recommanded course error ==============> ", error);
    }
}

const userMessages = async (req: any) => {
    try {
        console.log("user messages =============> ");

        const getContentsPromise = distinct({
            collection: 'Contents',
            field: '_id',
            query: { partnerIdOrRegionId: req.partner },
        });

        const getOldContentsPromise = distinct({
            collection: 'Contents',
            field: '_id',
            query: { partnerIdOrRegionId: req.duplicatePartner },
        });

        const getGroupsPromise = distinct({
            collection: 'Group',
            field: '_id',
            query: { partner: req.partner },
        });

        const getOldGroupsPromise = distinct({
            collection: 'Group',
            field: '_id',
            query: { partner: req.duplicatePartner },
        });

        const [getContents, getOldContents, getGroups, getOldGroups] = await Promise.all([
            getContentsPromise,
            getOldContentsPromise,
            getGroupsPromise,
            getOldGroupsPromise
        ]);

        let oldArray = [...req.partners, ...req.mentors, ...req.mentees, ...getOldContents, ...getOldGroups];
        let newArray = [...req.newPartners, ...req.newMentor, ...req.newMentee, ...getContents, ...getGroups];

        let array: any = [];
        // Iterate through each combination of sender and receiver
        req.partners.forEach((senderId: any) => {
            // Combine with mentor
            req.mentors.forEach((receiverId: any) => {
                array.push({ senderId, receiverId });
            });

            // Combine with mentee
            req.mentees.forEach((receiverId: any) => {
                array.push({ senderId, receiverId });
            });
        });
        req.mentors.forEach((senderId: any) => {
            // Combine with mentee
            req.mentees.forEach((receiverId: any) => {
                array.push({ senderId, receiverId });
            });
        });

        for (let index = 0; index < array.length; index++) {
            const element = array[index];

            const senderIndex = findIndex(oldArray, element.senderId?.toString());
            const receiverIndex = findIndex(oldArray, element.receiverId?.toString());

            const chat = await find({
                collection: 'Messages',
                query: { $or: [{ $and: [{ senderId: newArray[senderIndex] }, { receiverId: newArray[receiverIndex] }] }, { $and: [{ senderId: newArray[receiverIndex] }, { receiverId: newArray[senderIndex] }] }] },
                limit: 1
            });

            var chId: any;
            if (chat.length) {
                chId = chat[0].chId;
            } else {
                chId = uuidv4(); // Generate a UUID using v4
            }
            console.log("chId==========>", chId);

            const conversation = await find({
                collection: 'Messages',
                query: { $or: [{ $and: [{ senderId: element?.senderId?.toString() }, { receiverId: element?.receiverId?.toString() }] }, { $and: [{ receiverId: element?.senderId?.toString() }, { senderId: element?.receiverId?.toString() }] }] },
                project: ["-_id"],
                sort: { createdAt: 1 }
            });

            if (conversation.length) {
                for (let i = 0; i < conversation.length; i++) {
                    const e = conversation[i];

                    if (e.chId) {
                        e.chId = chId;
                    }
                    if (e.senderId) {
                        e.senderId = element.senderId?.toString() == e.senderId?.toString() ? newArray[senderIndex] : newArray[receiverIndex];
                    }
                    if (e.receiverId) {
                        e.receiverId = element.senderId?.toString() == e.receiverId?.toString() ? newArray[senderIndex] : newArray[receiverIndex];
                    }
                    if (e.msg_type == "Content") {
                        const contentIndex = findIndex(oldArray, e.contentId?.toString());
                        e.contentId = newArray[contentIndex];
                    }
                    if (e.msg_type == "Group") {
                        const groupIndex = findIndex(oldArray, e.groupId?.toString());
                        e.groupId = newArray[groupIndex];
                    }

                    await insertOne({
                        collection: 'Messages',
                        document: e
                    });
                };

            }
        }

        return true;

    } catch (error) {
        console.log("user messages error ============> ", error);
    }
}

const mentorMenteeBadges = async (req: any) => {
    try {
        console.log("mentor mentee badges =============> ");

        const getBadgesPromise = find({
            collection: 'AchievedBadges',
            query: { $or: [{ receiverId: { $in: [...req.mentors, ...req.mentees] }, senderId: null }, { receiverId: { $in: [...req.mentors, ...req.mentees] }, senderId: { $in: [...req.mentors, ...req.mentees] } }] },
            project: ["-_id"]
        });

        const [getBadges] = await Promise.all([
            getBadgesPromise
        ]);

        let oldArray = [...req.partners, ...req.mentors, ...req.mentees];
        let newArray = [...req.newPartners, ...req.newMentor, ...req.newMentee];

        for (let index = 0; index < getBadges.length; index++) {
            const element = getBadges[index];

            if (element.senderId !== null) {
                const senderIndex = findIndex(oldArray, element.senderId?.toString());
                element.senderId = newArray[senderIndex];
            }

            if (element.receiverId !== null) {
                const receiverIndex = findIndex(oldArray, element.receiverId?.toString());
                element.receiverId = newArray[receiverIndex];
            }

            await insertOne({
                collection: 'AchievedBadges',
                document: element
            });
        }

        return true;
    } catch (error) {
        console.log("mentor mentee badges error ============> ", error);
    }
}

const allReminder = async (req: any) => {
    try {
        console.log("all reminders =============> ");

        const getRemindersPromise = find({
            collection: 'Reminder',
            query: { userId: { $in: [...req.partners, ...req.mentors, ...req.mentees] } },
            project: ["-_id"]
        });

        const [getReminders] = await Promise.all([
            getRemindersPromise
        ]);

        let oldArray = [...req.partners, ...req.mentors, ...req.mentees];
        let newArray = [...req.newPartners, ...req.newMentor, ...req.newMentee];

        for (let index = 0; index < getReminders.length; index++) {
            const element = getReminders[index];

            const userIndex = findIndex(oldArray, element.userId?.toString());
            element.userId = newArray[userIndex];

            const user = await findOne({ collection: 'User', query: { _id: element.userId }, project: ["role"] })
            element.user_role = user.role;

            await insertOne({
                collection: 'Reminder',
                document: element
            });
        }

        return true;
    } catch (error) {
        console.log("all reminders error ============> ", error);
    }
}

const allNotification = async (req: any) => {
    try {
        console.log("all notification =============> ");
        let oldArray = [...req.partners, ...req.mentors, ...req.mentees];

        const getEventPromise = distinct({
            collection: 'Event',
            field: '_id',
            query: { partnerId: req.partner }
        });

        const getOldEventPromise = distinct({
            collection: 'Event',
            field: '_id',
            query: { partnerId: req.duplicatePartner, isDel: false }
        });

        const getMessagesPromise = distinct({
            collection: 'Messages',
            field: '_id',
            query: { $or: [{ senderId: { $in: [...req.newPartners, ...req.newMentor, ...req.newMentee] } }, { receiverId: { $in: [...req.newPartners, ...req.newMentor, ...req.newMentee] } }] }
        });

        const getOldMessagesPromise = distinct({
            collection: 'Messages',
            field: '_id',
            query: { $or: [{ senderId: { $in: oldArray } }, { receiverId: { $in: oldArray } }] }
        });

        const getRemindersPromise = distinct({
            collection: 'Reminder',
            field: '_id',
            query: { userId: { $in: [...req.newPartners, ...req.newMentor, ...req.newMentee] } }
        });

        const getOldRemindersPromise = distinct({
            collection: 'Reminder',
            field: '_id',
            query: { userId: { $in: oldArray } }
        });

        const getPairsPromise = distinct({
            collection: 'PairInfo',
            field: '_id',
            query: { partnerIdOrRegionId: req.partner }
        });

        const getOldPairsPromise = distinct({
            collection: 'PairInfo',
            field: '_id',
            query: { partnerIdOrRegionId: req.duplicatePartner }
        });

        const getNotificationPromise = find({
            collection: 'Notification',
            query: { $or: [{ from: { $in: [...req.partners, ...req.mentors, ...req.mentees] } }, { to: { $in: [...req.partners, ...req.mentors, ...req.mentees] } }], isDel: false },
            project: ["-_id"]
        });

        const [getEvent, getOldEvent, getMessages, getOldMessages, getReminders, getOldReminders, getPairs, getOldPairs, getNotification] = await Promise.all([
            getEventPromise,
            getOldEventPromise,
            getMessagesPromise,
            getOldMessagesPromise,
            getRemindersPromise,
            getOldRemindersPromise,
            getPairsPromise,
            getOldPairsPromise,
            getNotificationPromise
        ]);

        oldArray = [...oldArray, ...getOldEvent, ...getOldMessages, ...getOldReminders, ...getOldPairs]
        let newArray = [...req.newPartners, ...req.newMentor, ...req.newMentee, ...getEvent, ...getMessages, ...getReminders, ...getPairs];

        console.log(getNotification.length);

        for (let index = 0; index < getNotification.length; index++) {
            const element = getNotification[index];

            if (element.from) {
                const fromIndex = findIndex(oldArray, element.from?.toString());
                element.from = newArray[fromIndex];
            }

            if (element.to) {
                const toIndex = findIndex(oldArray, element.to?.toString());
                element.to = newArray[toIndex];
            }

            if (element.dataId) {
                if (element.type != notificationType.ASSIGNED_PROJECT && element.type != notificationType.ASSIGNED_TRAINING && element.type != notificationType.COURSE_COMPLETED) {
                    const dataIndex = findIndex(oldArray, element.dataId?.toString());
                    element.dataId = newArray[dataIndex];
                }else{
                    element.dataId = element.dataId;
                }
            }

            await insertOne({
                collection: 'Notification',
                document: element
            });

        }

        return true;
    } catch (error) {
        console.log("all notification error ============> ", error);
    }
}

const allNote = async (req: any) => {
    try {
        console.log("all notes =============> ");

        const getNotesPromise = find({
            collection: 'Notes',
            query: { partner: req.duplicatePartner },
            project: ["-_id"]
        });

        const [getNotes] = await Promise.all([
            getNotesPromise
        ]);

        let oldArray = [...req.partners, ...req.mentors, ...req.mentees];
        let newArray = [...req.newPartners, ...req.newMentor, ...req.newMentee];

        for (let index = 0; index < getNotes.length; index++) {
            const element = getNotes[index];

            const forIndex = findIndex(oldArray, element.createdFor?.toString());
            element.createdFor = newArray[forIndex];

            const byIndex = findIndex(oldArray, element.createdBy?.toString());
            element.createdBy = newArray[byIndex];

            element.partner = req.partner;

            await insertOne({
                collection: 'Notes',
                document: element
            });
        }

        return true;
    } catch (error) {
        console.log("all notes error ============> ", error);
    }
}
