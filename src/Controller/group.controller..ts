import { Request, Response } from "express";
import {
    distinct,
    find,
    findOne,
    findOneAndUpdate,
    insertMany,
    insertOne,
    updateMany,
    paginate,
    deleteMany,
    updateOne,
    aggregate,
} from "../utils/db";
import {
    categoryOfQuestion,
    errorMessage,
    messageConstant,
    msg_Type,
    statusCode,
    statusType,
    successMessage,
    uploadConstant,
    userRoleConstant,
    userStatusConstant,
} from "../utils/const";
import { success, error } from "../utils/helpers/resSender";
import { logger } from "../utils/helpers/logger";
import { uploadToS3 } from "../utils/uploadFile";
import { requestUser } from "../Interfaces/schemaInterfaces/user";
import { ascendingSorting, descendingSorting } from "../utils/helpers/functions";
import { v4 as uuidv4 } from 'uuid';
import { sendMsg } from "./Web/message.controller";

export const groupController = {

    addGroup: async (req: any, res: any) => {
        try {
            let request = req as requestUser
            const { groupName, region, assignedSchoolOrInstitute, groupMember, groupAdmin } = req.body;

            const isGroupNameExists = await findOne({ collection: 'Group', query: { groupName: { $regex: new RegExp("^" + groupName + "", "i") } } })

            if (isGroupNameExists) {
                res.status(statusCode.BAD_REQUEST).send(error("Group name already exists", {}, statusCode.BAD_REQUEST));
                return;
            }

            let query: any = {
                groupName: groupName,
                region: region,
                assignedSchoolOrInstitute: assignedSchoolOrInstitute,
                groupMember: groupMember,
                groupAdmin: request.user._id
            }

            if (request.user.role == userRoleConstant.P_SUPER_ADMIN || request.user.role == userRoleConstant.P_LOCAL_ADMIN) {
                query['partner'] = request.user.partnerAdmin
            } else if (request.user.role == userRoleConstant.I_LOCAL_ADMIN) {
                query['region'] = request.user.region
            } else {
                res.status(statusCode.UNAUTHORIZED).send(error(errorMessage.ACTION.replace(":attribute", request.user.role), {}, statusCode.UNAUTHORIZED));
                return
            }

            const addGroup = await insertOne({
                collection: 'Group',
                document: query
            })

            res.send(success(successMessage.CREATE_SUCCESS.replace(":attribute", "Group"), addGroup, statusCode.OK));
        } catch (err) {
            logger.error(`There was an issue into add group.: ${err}`);
            res.status(statusCode.FORBIDDEN).send(error(err));
        }
    },

    getGroup: async (req: any, res: any) => {
        try {
            let request = req as requestUser
            const { groupName, isArchived, page, limit, partnerOrRegion, schoolOrInstitute } = req.body;

            let sort: any = {}

            sort = req.body.sort;

            let query: { $and: any[] } = { $and: [{ isArchived: isArchived }] };
            query.$and.push({ isDel: false })
            if (request.user.role == userRoleConstant.P_SUPER_ADMIN || request.user.role == userRoleConstant.P_LOCAL_ADMIN) {
                query.$and.push({ partner: request.user.partnerAdmin })
            } else if (request.user.role == userRoleConstant.I_LOCAL_ADMIN) {
                query.$and.push({ region: request.user.region })
            }

            if (schoolOrInstitute?.length) query.$and.push({ assignedSchoolOrInstitute: { $in: schoolOrInstitute } });
            if (partnerOrRegion?.length) {
                query.$and.push({
                    $or: [
                        {
                            partner: {
                                $in: partnerOrRegion
                            }
                        },
                        {
                            region: {
                                $in: partnerOrRegion
                            }
                        }
                    ]
                });
            }
            if (groupName) {
                const regex = { $regex: new RegExp(groupName, "i") }
                query.$and.push({ groupName: regex })
            }

            let getGroup = await paginate({ collection: 'Group', query: query, options: { populate: [{ path: 'region', select: 'region city' }, { path: 'partner', select: 'partnerName region' }], page: page, limit: limit, sort: { 'createdAt': -1 } } })

            getGroup = JSON.parse(JSON.stringify(getGroup))
            for (let i = 0; i < getGroup.docs.length; i++) {
                const mentorAndMenteesCount = getGroup.docs[i]?.groupMember?.length;
                let members = mentorAndMenteesCount;

                getGroup.docs[i].members = members;
            }

            if (sort && Object.values(sort)[0] == "desc") {

                if (sort && Object.keys(sort)[0] == "partner") {
                    getGroup.docs.sort((a: any, b: any) => {
                        let partner1 = a?.partner?.partnerName || a?.region?.region;
                        let partner2 = b?.partner?.partnerName || b?.region?.region;

                        if (partner1.toLowerCase() > partner2.toLowerCase()) {
                            return -1;
                        }
                        if (partner1.toLowerCase() < partner2.toLowerCase()) {
                            return 1;
                        }
                        return 0;
                    })
                } else {
                    let key = Object.keys(sort)[0];
                    (getGroup.docs.length > 0 ? getGroup.docs : []).sort((a: any, b: any) => descendingSorting(a, b, key))
                }
            }

            if (sort && Object.values(sort)[0] == "asc") {

                if (sort && Object.keys(sort)[0] == "partner") {
                    getGroup.docs.sort((a: any, b: any) => {
                        const partner1 = a?.partner?.partnerName || a?.region?.region;
                        const partner2 = b?.partner?.partnerName || b?.region?.region;
                        if (partner1.toLowerCase() < partner2.toLowerCase()) {
                            return -1;
                        }
                        if (partner1.toLowerCase() > partner2.toLowerCase()) {
                            return 1;
                        }
                        return 0;
                    })
                } else {
                    let key = Object.keys(sort)[0];
                    (getGroup.docs.length > 0 ? getGroup.docs : []).sort((a: any, b: any) => ascendingSorting(a, b, key))
                }
            }

            res.send(success(successMessage.FETCH_SUCCESS.replace(":attribute", "Group"), getGroup, statusCode.OK));
        } catch (err) {
            logger.error(`There was an issue into add group.: ${err}`);
            res.status(statusCode.FORBIDDEN).send(error(err));
        }
    },

    getSingleGroup: async (req: Request, res: Response) => {
        try {
            const { groupId, isArchived } = req.body;

            const getGroup = await find({ collection: 'Group', query: { _id: groupId, isDel: false }, populate: [{ path: 'region', select: 'region' }, { path: 'groupMember', select: 'legalFname legalLname preferredFname preferredLname role profilePic' }, { path: 'partner region' }] })

            if (!getGroup) {
                res.status(statusCode.BAD_REQUEST).send(error(errorMessage.NOT_EXISTS.replace(":attribute", 'Group'), {}, statusCode.BAD_REQUEST))
                return
            }

            res.send(success(successMessage.FETCH_SUCCESS.replace(":attribute", "Group"), getGroup, statusCode.OK));
        } catch (err) {
            logger.error(`There was an issue into add group.: ${err}`);
            res.status(statusCode.FORBIDDEN).send(error(err));
        }
    },

    updateGroup: async (req: any, res: any) => {
        try {
            let request = req as requestUser
            const { groupId, groupName, region, assignedSchoolOrInstitute, groupMember, groupAdmin } = req.body;

            const isGroupNameExists = await findOne({ collection: 'Group', query: { _id: { $ne: groupId }, isDel: false, groupName: { $regex: new RegExp("^" + groupName + "", "i") } } })

            if (isGroupNameExists) {
                res.status(statusCode.BAD_REQUEST).send(error("Group name already exists", {}, statusCode.BAD_REQUEST));
                return;
            }

            let query: any = {
                groupName: groupName,
                assignedSchoolOrInstitute: assignedSchoolOrInstitute,
                groupMember: groupMember,
                groupAdmin: groupAdmin
            }

            if (request.user.role == userRoleConstant.P_SUPER_ADMIN || request.user.role == userRoleConstant.P_LOCAL_ADMIN) {
                query['partner'] = request.user.partnerAdmin
            } else if (request.user.role == userRoleConstant.I_LOCAL_ADMIN) {
                query['region'] = request.user.region
            } else {
                res.status(statusCode.UNAUTHORIZED).send(error(errorMessage.ACTION.replace(":attribute", request.user.role), {}, statusCode.UNAUTHORIZED));
                return
            }

            const addGroup = await findOneAndUpdate({
                collection: 'Group',
                query: { _id: groupId },
                update: {
                    $set: query
                }
            })

            res.send(success(successMessage.UPDATE_SUCCESS.replace(":attribute", "Group"), addGroup, statusCode.OK));
        } catch (err) {
            logger.error(`There was an issue into update group.: ${err}`);
            res.status(statusCode.FORBIDDEN).send(error(err));
        }
    },

    deleteGroup: async (req: any, res: any) => {
        try {
            const { groupId, isArchived } = req.body;

            const isGroupExists = await findOne({ collection: 'Group', query: { _id: groupId, isArchived: isArchived } });

            if (!isGroupExists) {
                res.status(statusCode.BAD_REQUEST).send(error("Group not exists", {}, statusCode.BAD_REQUEST));
                return;
            }

            await findOneAndUpdate({ collection: "Group", query: { _id: groupId, isDel: false }, update: { isDel: true }, options: { new: true } })
            // const getGroup = await deleteMany({ collection: 'Group', query: { _id: groupId, isArchived: isArchived }, populate: { path: 'region', select: 'region' } })

            res.send(success(successMessage.DELETE_SUCCESS.replace(":attribute", "Group"), isGroupExists, statusCode.OK));
        } catch (err) {
            logger.error(`There was an issue into add group.: ${err}`);
            res.status(statusCode.FORBIDDEN).send(error(err));
        }
    },

    archievedGroup: async (req: any, res: any) => {
        try {
            const { groupId, isArchived } = req.body;

            let message = ""
            if (isArchived) {
                message = "Group was successfully archived"
            } else {
                message = "Group was successfully unarchived"
            }

            const addGroup = await updateMany({
                collection: 'Group',
                query: { _id: { $in: groupId }, isDel: false },
                update: {
                    $set: {
                        isArchived: isArchived
                    }
                }
            })

            res.send(success(message, addGroup, statusCode.OK));
        } catch (err) {
            logger.error(`There was an issue into update group.: ${err}`);
            res.status(statusCode.FORBIDDEN).send(error(err));
        }
    },

    sendMessageInGroup: async (req: Request, res: Response) => {
        try {
            const { members, message, files, media, groupId } = req.body;
            const request = req as requestUser;
            const senderId = request.user._id.toString();

            // const files: any = req.files;
            // let uploadedFile = [];

            // if (files && files.length > 0) {
            //     for (let index = 0; index < files.length; index++) {
            //         const file = files[index];

            //         const uploadFile: any = await uploadToS3(file, 'MessageUploadedFile');

            //         uploadedFile.push(uploadFile.Location)
            //     }
            // }

            for (let i = 0; i < members.length; i++) {
                const receiverId = members[i];

                if (files && files.length > 0) {
                    for (let i = 0; i < files.length; i++) {
                        const file = files[i];
                        await sendMsg({
                            data: {
                                user_id: senderId,
                                user_type: request.user.role,
                                receiverId: receiverId,
                                groupId: groupId,
                                // message: message,
                                msg_type: msg_Type.FILE,
                                file: file.Location,
                                fileKey: file.key
                            }
                        });
                    }
                }

                if (media && media.length > 0) {
                    for (let i = 0; i < media.length; i++) {
                        const mediaFile = media[i];

                        await sendMsg({
                            data: {
                                user_id: senderId,
                                user_type: request.user.role,
                                receiverId: receiverId,
                                groupId: groupId,
                                // message: message,
                                msg_type: msg_Type.MEDIA,
                                file: mediaFile.Location,
                                fileKey: mediaFile.key
                            }
                        });
                    }
                }

                if (message) {
                    await sendMsg({
                        data: {
                            user_id: senderId,
                            user_type: request.user.role,
                            receiverId: receiverId,
                            message: message,
                            groupId: groupId,
                            msg_type: msg_Type.MESSAGE
                        }
                    });
                }
            }

            res.send(success("Message has been sent", {}, statusCode.OK))
        } catch (err) {
            logger.error(`There was an issue into send mesage.: ${err} `)
            res.status(statusCode.FORBIDDEN).send(error("There was an issue into send message.", err))
        }
    },

    groupMemeberList: async (req: Request, res: Response) => {
        try {
            let groupList: any = {}, groupId = req.body?.groupId;
            let request = req as requestUser

            if (!groupId) {
                let query: any = {}, userQuery: any = {}
                if (request.user.region) {
                    query['regionId'] = request.user.region
                    userQuery['region'] = request.user.region
                } else if (request.user.partnerAdmin) {
                    query['partnerId'] = request.user.partnerAdmin
                    userQuery['partnerAdmin'] = request.user.partnerAdmin
                }
                const role = [userRoleConstant.MENTEE, userRoleConstant.MENTOR];
                const status = [userStatusConstant.ACTIVE, userStatusConstant.Completed, userStatusConstant.Matched]
                query['isDel'] = false;
                query['isConfirm'] = true;
                // query['role'] = { $in: role }
                // query['status'] = { $in: [statusType.COMPLETED, statusType.MATCHING, statusType.MATCHED] }
                const pairList = await find({ collection: "PairInfo", query: query, project: { mentorId: 1, menteeId: 1 }, populate: { path: 'mentorId menteeId', select: 'legalFname legalLname preferredFname preferredLname role profilePic' } });
                const pairListMentorId = await distinct({ collection: "PairInfo", field: 'mentorId', query: query })
                const pairListMenteeId = await distinct({ collection: "PairInfo", field: 'menteeId', query: query })
                const userId = pairListMentorId.concat(pairListMenteeId);

                const mentorAndMenteesPipeLine = [
                    {
                        '$match': query
                    },
                    {
                        '$lookup': {
                            'from': 'users',
                            'localField': 'mentorId',
                            'foreignField': '_id',
                            'as': 'Mentor'
                        }
                    }, {
                        '$unwind': {
                            'path': '$Mentor'
                        }
                    }, {
                        '$lookup': {
                            'from': 'users',
                            'localField': 'menteeId',
                            'foreignField': '_id',
                            'as': 'Mentee'
                        }
                    }, {
                        '$unwind': {
                            'path': '$Mentee'
                        }
                    }, {
                        '$group': {
                            '_id': '$mentorId',
                            'role': {
                                '$first': '$Mentor.role'
                            },
                            'legalFname': {
                                '$first': '$Mentor.legalFname'
                            },
                            'legalLname': {
                                '$first': '$Mentor.legalLname'
                            },
                            'preferredFname': {
                                '$first': '$Mentor.preferredFname'
                            },
                            'preferredLname': {
                                '$first': '$Mentor.preferredLname'
                            },
                            'profilePic': {
                                '$first': '$Mentor.profilePic'
                            },
                            'mentee': {
                                '$push': {
                                    '_id': '$menteeId',
                                    'role': '$Mentee.role',
                                    'legalFname': '$Mentee.legalFname',
                                    'legalLname': '$Mentee.legalLname',
                                    'preferredFname': '$Mentee.preferredFname',
                                    'preferredLname': '$Mentee.preferredLname',
                                    'profilePic': '$Mentee.profilePic'
                                }
                            }
                        }
                    }
                ]

                const pairMentorAndMentees = await aggregate({ collection: 'PairInfo', pipeline: mentorAndMenteesPipeLine });

                userQuery['role'] = role;
                userQuery['status'] = status;
                userQuery['isDel'] = false;
                userQuery['_id'] = { $nin: userId }

                let mentorAndMentees = await find({ collection: 'User', query: userQuery, project: { legalFname: 1, legalLname: 1, role: 1, profilePic: 1, preferredFname: 1, preferredLname: 1 } })

                mentorAndMentees = mentorAndMentees.map((x: any) => ({
                    ...x,
                    mentee: []
                }))

                groupList.pairList = pairList ? pairList : [];
                groupList.mentorAndMentees = pairMentorAndMentees.concat(mentorAndMentees)

                res.send(success(successMessage.FETCH_SUCCESS.replace(':attribute', "Message"), groupList, statusCode.OK))
            } else {
                let groupObj = await findOne({ collection: 'Group', query: { _id: groupId, isDel: false }, populate: [{ path: 'groupMember', select: 'legalFname legalLname preferredFname preferredLname role profilePic' }] });
                if (!groupObj) {
                    res.status(statusCode.BAD_REQUEST).send(error(errorMessage.NOT_EXISTS.replace(":attribute", 'Group'), {}, statusCode.BAD_REQUEST))
                    return
                }

                res.send(success(successMessage.FETCH_SUCCESS.replace(":attribute", 'Group'), groupObj))
            }
        } catch (err) {
            logger.error(`There was an issue into get group list.: ${err} `)
            res.status(statusCode.FORBIDDEN).send(error("There was an issue into get group list.", err))
        }
    },

    addNewSchoolOrInstitute: async function (req: any, res: any) {
        try {
            let { id, SchoolOrInstitute } = req.body;
            let user = await findOne({
                collection: "Group",
                query: {
                    _id: id,
                    isDel: false
                },
            });
            if (!user) {
                return res
                    .status(statusCode.NOT_FOUND)
                    .send(error(errorMessage.NOT_EXISTS.replace(":attribute", "Group"), {}, statusCode.NOT_FOUND));
            }
            //Sentize School Name
            if (user.assignedSchoolOrInstitute.length) {
                SchoolOrInstitute = SchoolOrInstitute.filter((ele: any) => !user.assignedSchoolOrInstitute.includes(ele));
                if (!SchoolOrInstitute.length)
                    return res
                        .status(statusCode.BAD_REQUEST)
                        .send(error(errorMessage.ALREADY_EXISTS.replace(":attribute", "SchoolOrInstitute"), {}, statusCode.BAD_REQUEST));
            }

            let data = await updateOne({
                collection: "Group",
                query: { _id: id, isDel: false },
                update: { $push: { assignedSchoolOrInstitute: { $each: SchoolOrInstitute } } },
            });
            res.send(success("School/Institute has been successfully assigned", {}, statusCode.OK));
        } catch (err: any) {
            logger.error("groupController > addNewSchoolOrInstitute ", err);
            res
                .status(statusCode.FORBIDDEN)
                .send(error("There is some issue to Create addNewSchoolOrInstitute APi.", err.message, statusCode.FORBIDDEN));
        }
    },

    removeNewSchoolOrInstitute: async function (req: any, res: any) {
        try {
            let { id, SchoolOrInstitute } = req.body;
            let user = await findOne({
                collection: "Group",
                query: {
                    _id: id,
                    isDel: false
                },
            });
            if (!user) {
                return res
                    .status(statusCode.NOT_FOUND)
                    .send(error(errorMessage.NOT_EXISTS.replace(":attribute", "Group"), {}, statusCode.NOT_FOUND));
            }

            let data = await updateOne({
                collection: "Group",
                query: { _id: id, isDel: false },
                update: { $pull: { assignedSchoolOrInstitute: { $in: SchoolOrInstitute } } },
            });
            res.send(success("School/Institute has been successfully unassign", {}, statusCode.OK));
        } catch (err: any) {
            logger.error("groupController > removeNewSchoolOrInstitute ", err);
            res
                .status(statusCode.FORBIDDEN)
                .send(error("There is some issue to Create addNewSchoolOrInstitute APi.", err.message, statusCode.FORBIDDEN));
        }
    },

    filterOptionList: async (req: Request, res: Response) => {
        try {
            let partnerList = await find({ collection: 'Partner', query: { isDel: false }, project: { 'partnerName': 1 } });
            let regionList = await find({ collection: 'Region', query: { isDel: false }, project: { 'region': 1 } });
            const assignSchool = await distinct({ collection: 'Group', field: 'assignedSchoolOrInstitute' })

            partnerList.sort((a: any, b: any) => { return a?.partnerName?.localeCompare(b?.partnerName) })
            regionList.sort((a: any, b: any) => { return a?.region?.localeCompare(b?.region) })
            assignSchool.sort((a: any, b: any) => { return a.localeCompare(b) })

            res.send(success(successMessage.FETCH_SUCCESS.replace(":attribute", 'FilterList'), { partnerList, regionList, assignSchool }))
        } catch (err: any) {
            console.log(err)
            res.status(statusCode.FORBIDDEN).send(error("There is some issue in filter list", err.message, statusCode.FORBIDDEN));
        }
    },

    SchoolOrInstitute: async function (req: Request, res: Response) {
        try {
            let request = req as requestUser;

            console.log(request.user)

            let query: any = {
                isDel: false,
            }, list: any;
            if (request.user.region) {
                query['_id'] = request.user.region;
                list = await distinct({
                    collection: "Region",
                    field: 'assignedSchoolOrInstitute',
                    query: query,
                });
            } else if (request.user.partnerAdmin) {
                query['_id'] = request.user.partnerAdmin
                list = await distinct({
                    collection: "Partner",
                    field: 'assignedSchoolOrInstitute',
                    query: query,
                });
            } else if (request.user.role == userRoleConstant.I_SUPER_ADMIN) {
                if (req.body.partnerId) {
                    query['_id'] = request.body.partnerId
                    list = await distinct({
                        collection: "Partner",
                        field: 'assignedSchoolOrInstitute',
                        query: query,
                    });
                } else if (req.body.regionId) {
                    query['_id'] = req.body.regionId;
                    list = await distinct({
                        collection: "Region",
                        field: 'assignedSchoolOrInstitute',
                        query: query,
                    });
                }
            }

            // (list?.value || []).sort((a: any, b: any) => { return a.localeCompare(b) });
            res.send(success(successMessage.FETCH_SUCCESS.replace(":attribute", "SchoolOrInstitute"), list, statusCode.OK));
        } catch (err: any) {
            logger.error("partnerController > SchoolOrInstitute ", err);
            res
                .status(statusCode.FORBIDDEN)
                .send(error("There is some issue to Create SchoolOrInstitute list.", err.message, statusCode.FORBIDDEN));
        }
    },
}