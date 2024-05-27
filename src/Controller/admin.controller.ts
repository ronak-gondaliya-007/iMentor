import { Request, Response } from "express";
import { find, findOne, findOneAndUpdate, insertOne, updateOne } from "../utils/db";
import { userRoleConstant, errorMessage, statusCode, successMessage, userStatusConstant, uploadConstant, defaultProfilePicConstant, User_Activity } from "../utils/const";
import { ascendingSorting, capitalizeFirstLetter, cryptoDecryption, cryptoEncryption, decrypt, descendingSorting, encrypt, formatePhoneNumber, generateToken, generateTokenLoginAs, isEmailAlreadyExists } from "../utils/helpers/functions";
import { success, error } from "../utils/helpers/resSender";
import { logger } from "../utils/helpers/logger";
import { RegionList } from "../utils/region";
import _, { collect } from "underscore"
import { requestUser } from "../Interfaces/schemaInterfaces/user";
import config from "../utils/config";
import jwt from 'jsonwebtoken'
import csvtojson from 'csvtojson'
import { sendMail } from "../utils/helpers/sendEmail";
import { validateFile } from "../utils/uploadFile";
import fs from 'fs'
import exportFileFunction from "../utils/exportCSV";


export let adminContrller = {
    registration: async (req: Request, res: Response) => {
        try {
            let { email, fname, lname, phoneNo, password } = req.body;

            let checkUser = await findOne({
                collection: 'User',
                query: { email: email.toLowerCase() }
            })

            if (checkUser) {
                res.status(statusCode.BAD_REQUEST).send(error(errorMessage.ALREADY_EXISTS.replace(":attribute", "email"), {}, statusCode.BAD_REQUEST));
                return
            }

            let userObj = await insertOne({
                collection: "User",
                document: {
                    email: email.toLowerCase(),
                    legalFname: fname,
                    legalLname: lname,
                    preferredFname: fname,
                    preferredLname: lname,
                    role: userRoleConstant.I_SUPER_ADMIN,
                    primaryPhoneNo: phoneNo,
                    status: userStatusConstant.ACTIVE,
                    password: await encrypt(password),
                },
            });

            res.send(success("User Created Successfully", userObj, 201));
        } catch (err) {
            logger.error("Admin Controller > Register ", err);
            res.send(error("Something went wrong", err));
        }
    },

    login: async (req: Request, res: Response) => {
        try {
            let userObj = await findOne({ collection: "User", query: { email: req.body.email.toLowerCase(), isDel: false }, populate: [{ path: 'partnerAdmin region' }] });
            if (!userObj) {
                res.send(error("User not found."));
                return;
            }

            if (userObj.role == userRoleConstant.MENTEE || userObj.role == userRoleConstant.MENTOR) {
                res.status(statusCode.BAD_REQUEST).send(error("This User does not belong to the CMS Admin Users", {}, statusCode.BAD_REQUEST));
                return
            }

            let fullName = userObj.preferredFname + " " + userObj.preferredLname

            if (userObj.status != userStatusConstant.ACTIVE) {
                res.status(statusCode.BAD_REQUEST).send(error("Registration is incomplete.", {}, statusCode.BAD_REQUEST));
                return
            }

            let decryptedPassword = await decrypt(req.body.password, userObj.password);
            if (!decryptedPassword) {
                res.send(error("Email or Password is incorrect."));
                return;
            }

            let token = await generateToken(userObj);

            if (!token) {
                res.send(error("Token Expired"));
                return;
            }

            let sessionObj = await findOne({ collection: 'Session', query: { userId: userObj._id } })
            if (sessionObj) {

                let findCurrentUserSession = (sessionObj.account).find((x: any) => x.user.toString() == userObj._id.toString());

                if (findCurrentUserSession) {
                    await findOneAndUpdate({
                        collection: 'Session',
                        query: {
                            userId: userObj._id,/*  'account.email': userObj.email.toLowerCase() */
                        },
                        update: {
                            $set: {
                                'account.$[i].token': token,
                                'account.$[i].user': userObj._id,
                                'account.$[i].role': userObj.role,
                                'account.$[i].email': userObj.email,
                            }
                        },
                        options: {
                            arrayFilters: [{ 'i.email': req.body.email.toLowerCase() }],
                            upsert: true
                        }
                    })
                } else {
                    await findOneAndUpdate({
                        collection: 'Session',
                        query: {
                            userId: userObj._id,
                        },
                        update: {
                            $push: {
                                account: {
                                    'token': token,
                                    'user': userObj._id,
                                    'role': userObj.role,
                                    'email': userObj.email,
                                    default: true
                                }

                            }
                        },
                        options: {
                            upsert: true
                        }
                    })
                }


            } else {

                await insertOne({
                    collection: "Session",
                    document: {
                        userId: userObj._id,
                        account: [
                            {
                                email: userObj.email,
                                user: userObj._id,
                                token: token,
                                default: true,
                                role: userObj.role,
                            }
                        ],
                    },
                });

            }

            res.send(success("Logged In Successfully.", {
                userId: userObj._id, role: userObj.role, token, fullName, email: userObj.email, region: userObj.region ? userObj.region.region : '', regionId: userObj.region ? userObj.region._id : '',
                partnerId: userObj.partnerAdmin ? userObj.partnerAdmin._id : '', logo: userObj.partnerAdmin ? userObj.partnerAdmin.logo : null, partnerName: userObj?.partnerAdmin ? userObj?.partnerAdmin?.partnerName : '',
                school: userObj?.partnerAdmin?.assignedSchoolOrInstitute || userObj?.region?.assignedSchoolOrInstitute || ''
            }));
        } catch (err: any) {
            logger.error("Admin Controller > Login ", err);
            res.status(statusCode.FORBIDDEN).send(error("There is some issue during login.", err.message, statusCode.FORBIDDEN));
        }
    },

    addUser: async (req: Request, res: Response) => {
        try {
            let { fname, lname, email, role, phoneNo, partner, region, countryCode } = req.body;
            let request = req as requestUser

            let userObj = await findOne({ collection: "User", query: { email: email.toLowerCase(), isDel: false } });
            if (userObj) return res.send(error("User Already Exists"));

            let query: any = {}
            let audit;
            if (request.user.role == userRoleConstant.I_SUPER_ADMIN) {
                query = {
                    legalFname: fname,
                    legalLname: lname,
                    preferredFname: fname,
                    preferredLname: lname,
                    role: role,
                    email: email.toLowerCase(),
                    primaryPhoneNo: phoneNo,
                    status: userStatusConstant.PENDING,
                    isInvited: true,
                    countryCode: countryCode
                };
                audit = User_Activity.CREATE_SUPER_ADMIN_USER;
            } else if (request.user.role == userRoleConstant.P_SUPER_ADMIN) {
                let partnerAdminObj = await findOne({ collection: 'User', query: { _id: request.user._id, isDel: false } });
                if (!partnerAdminObj) {
                    res.status(statusCode.UNAUTHORIZED).send(error("Current LoggedIn User not exists.", {}, statusCode.UNAUTHORIZED));
                    return
                }
                query = {
                    legalFname: fname,
                    legalLname: lname,
                    preferredFname: fname,
                    preferredLname: lname,
                    role: userRoleConstant.P_LOCAL_ADMIN,
                    primaryPhoneNo: phoneNo,
                    countryCode: countryCode,
                    email: email.toLowerCase(),
                    status: userStatusConstant.PENDING,
                    partnerAdmin: partnerAdminObj.partnerAdmin ? partnerAdminObj.partnerAdmin : null
                }
                audit = User_Activity.CREATE_PS_ADMIN_USER;
            }
            if (role == userRoleConstant.P_SUPER_ADMIN) {
                if (!partner) {
                    res.status(statusCode.BAD_REQUEST).send(error("If role is Super Partner Admin then partner field is mandatory.", {}, statusCode.BAD_REQUEST))
                    return
                }
                query["partnerAdmin"] = partner;
            }

            if (role == userRoleConstant.I_LOCAL_ADMIN) {
                if (!region) {
                    res.status(statusCode.BAD_REQUEST).send(error("If role is iMentor Local Admin then region filed is mandaotry.", {}, statusCode.BAD_REQUEST))
                    return

                }
                query["region"] = region;
            }
            query['resentInvitationDate'] = new Date()

            query['createdBy'] = request.user._id
            let user = await insertOne({ collection: "User", document: query });

            let userRes = _.pick(user, 'email', "role", "legalFname", "legalLname", "preferredFname", "preferredLname", "primaryPhoneNo", "status", "_id")

            let encryptData = cryptoEncryption('register', { email: userRes.email })

            let url = config.HOST + "/register?query=" + encodeURIComponent(encryptData)

            var template = fs.readFileSync(__dirname + "/../../src/utils/emailTemplates/headerfooter.html").toString();
            var content = fs.readFileSync(__dirname + "/../../src/utils/emailTemplates/registerUserInvitation.html").toString();
            content = content.replace(/{{fullname}}/g, (user.preferredFname + " " + user.preferredLname));
            content = content.replace(/{{adminUserName}}/g, (request.user.preferredFname + " " + request.user.legalLname));
            content = content.replace(/{{adminUserRole}}/g, request.user.role)
            content = content.replace(/{{adminProfilePic}}/g, request.user.profilePic ? request.user.profilePic : defaultProfilePicConstant.USER_PROFILE_PIC)
            content = content.replace(/{{url}}/g, url)
            template = template.replace(/{{template}}/g, content);

            sendMail(userRes.email, "You're Registered for iMentor", 'iMentor', template)
            res.status(statusCode.CREATED).send(success(successMessage.ADD_SUCCESS.replace(":attribute", 'user'), { ...userRes, auditIds: [user._id], isAuditLog: true, audit }, statusCode.CREATED));
        } catch (err: any) {
            logger.error("Admin Controller > AddUser", err);
            res.status(statusCode.FORBIDDEN).send(error("There is some issue during add admin user.", err.message, statusCode.FORBIDDEN));
        }
    },

    regionListing: async (req: Request, res: Response) => {
        try {
            const regionList = await find({ collection: 'Region', query: { isDel: false }, project: { 'region': 1, 'assignedSchoolOrInstitute': 1, 'city': 1 }, sort: { 'createdAt': -1 } });

            res.status(statusCode.OK).send(success(successMessage.FETCH_SUCCESS.replace(":attribute", "Regions"), regionList, statusCode.OK))
        } catch (err: any) {
            logger.error("Admin Controller > regionListing ", err);
            res.status(statusCode.FORBIDDEN).send(error("There is some issue to get region list.", err.message, statusCode.FORBIDDEN))
        }
    },

    adminUserList: async (req: Request, res: Response) => {
        try {
            let { search, adminType } = req.body
            let request = req as requestUser
            let status: Array<any> = [], regionOrPartner: Array<any> = [], sort: any = {}, page: number = 1, total: number, pages: number, limit: number;

            // req.body.adminType = adminType, req.body.status = status, req.body.regionOrPartner = regionOrPartner
            status = req.body.status, regionOrPartner = req.body.regionOrPartner, sort = req.body.sort;

            let searchQuery: any = {}, userAdminList: Array<any> = []

            // if(request.user.role == userRoleConstant.P_SUPER_ADMIN){

            // }

            searchQuery['isDel'] = false

            if (request.user.role == userRoleConstant.P_SUPER_ADMIN) {
                let partnerUserObj = await findOne({ collection: 'User', query: { _id: request.user._id, isDel: false } })
                searchQuery['role'] = { $in: [userRoleConstant.P_LOCAL_ADMIN] };
                searchQuery['partnerAdmin'] = partnerUserObj.partnerAdmin;
            }
            else if (adminType) {
                searchQuery['role'] = adminType
            } else {
                searchQuery['role'] = { $in: [userRoleConstant.I_LOCAL_ADMIN, userRoleConstant.P_SUPER_ADMIN, userRoleConstant.P_LOCAL_ADMIN, userRoleConstant.I_SUPER_ADMIN] }
            }

            if (status && status.length > 0) {
                searchQuery['status'] = { $in: status }
            } else {
                searchQuery['status'] = { $in: [userStatusConstant.ACTIVE, userStatusConstant.PENDING] }
            }

            if (regionOrPartner && regionOrPartner.length > 0) {
                searchQuery['$or'] = [{ 'region': { $in: regionOrPartner } }, { partnerAdmin: { $in: regionOrPartner } }]
            }

            if (search) {
                // searchQuery['legalFname'] = new RegExp(search, 'i')
                const searchText = search.split(" ")
                if (searchText.length > 1) {
                    searchQuery['$or'] = [{ preferredFname: new RegExp(searchText[0], 'i') }, { preferredLname: new RegExp(searchText[1], 'i') }]
                } else {
                    searchQuery['$or'] = [{ preferredFname: new RegExp(search, 'i') }, { preferredLname: new RegExp(search, 'i') }]
                }
            }

            let populate = [{
                path: 'partnerAdmin region', select: 'partnerName region'
            }, {
                path: 'createdBy', select: 'legalFname legalLname preferredFname preferredLname role'
            }]

            // searchQuery['_id'] = { $nin: [request.user._id] }

            let userObj = await find({ collection: 'User', query: searchQuery, populate: populate, sort: { 'createdAt': -1 } });

            (userObj.length > 0 ? userObj : []).forEach((x: any) => {

                userAdminList.push({
                    _id: x._id,
                    userName: (x.preferredFname ? x.preferredFname : '') + " " + (x.preferredLname ? x.preferredLname : ''),
                    email: x.email ? x.email : '',
                    status: x.status ? x.status : '',
                    role: x.role ? x.role : '',
                    "region/partner": ((x && x.region) ? x.region.region : (x.partnerAdmin && x.partnerAdmin.partnerName) ? x.partnerAdmin.partnerName : ''),
                    createdAt: x.createdAt,
                    resentInvitationDate: x.resentInvitationDate ? x.resentInvitationDate : '',
                    createdBy: (x?.createdBy?.preferredFname || "") + " " + (x?.createdBy?.preferredLname || '')
                })
            })


            if (sort && Object.values(sort)[0] == "desc") {
                let key = Object.keys(sort)[0]
                userAdminList.sort((a: any, b: any) => descendingSorting(a, b, key))
            }

            if (sort && Object.values(sort)[0] == "asc") {
                let key = Object.keys(sort)[0]
                userAdminList.sort((a: any, b: any) => ascendingSorting(a, b, key))
            }

            page = 1;
            limit = 10
            if (req.body.limit) {
                limit = req.body.limit
            }

            pages = Math.ceil(userAdminList.length / limit);
            total = userAdminList.length;
            if (req.body.page) {
                page = req.body.page
            }
            userAdminList = userAdminList.slice((page - 1) * limit, page * limit)

            let result = {
                docs: userAdminList,
                page: page,
                pages,
                total,
                limit: limit
            }

            res.send(success(successMessage.FETCH_SUCCESS.replace(":attribute", "Admin"), result, statusCode.OK))
        } catch (err: any) {
            logger.error("Admin Controller > addUserListing ", err);
            res.status(statusCode.FORBIDDEN).send(error("There is some issue to get admin user list.", err.message, statusCode.FORBIDDEN))
        }
    },

    filterList: async (req: Request, res: Response) => {
        try {
            let adminType: Array<any> = [], status: Array<any> = [], regionOrPartner: Array<any> = [];

            adminType.push(userRoleConstant.I_SUPER_ADMIN, userRoleConstant.I_LOCAL_ADMIN, userRoleConstant.P_SUPER_ADMIN, userRoleConstant.P_LOCAL_ADMIN)

            status.push(userStatusConstant.PENDING, userStatusConstant.ACTIVE)

            let partnerList = await find({ collection: 'Partner', query: { isDel: false }, project: { 'partnerName': 1 }, sort: { partnerName: 1 } })

            let regionList = await find({ collection: 'Region', query: { isDel: false }, project: { 'region': 1 } })

            partnerList.forEach((x: any) => regionOrPartner.push({ _id: x._id, value: x.partnerName }));

            regionList.forEach((x: any) => regionOrPartner.push({ _id: x._id, value: x.region }));

            regionOrPartner = (regionOrPartner.length > 0 ? regionOrPartner : []).sort((a: any, b: any) => {
                if (a.value) {
                    return a.value.localeCompare(b?.value)
                }
            })

            res.send(success(successMessage.FETCH_SUCCESS.replace(":attribute", "FilterList"), { adminType, status, regionOrPartner }, statusCode.OK))

        } catch (err: any) {
            logger.error("Admin Controller > FilterList ", err);
            res.status(statusCode.FORBIDDEN).send(error("There is some issue to get Filter list.", err.message, statusCode.FORBIDDEN))
        }
    },

    deleteAdmin: async (req: Request, res: Response) => {
        try {
            let users: Array<any> = req.body.users;

            let request = req as requestUser

            let userObj = await findOne({ collection: 'User', query: { _id: users[0], isDel: false } });
            if (!userObj) {
                res.status(statusCode.BAD_REQUEST).send(error(errorMessage.NOT_EXISTS.replace(":attribute", 'User'), {}, statusCode.BAD_REQUEST))
                return
            }

            let findAnotherUser, isShowPopup = false, userResponse: any = {}, message: string = ""
            let audit;
            userResponse['isShowPopup'] = isShowPopup
            if (request.user.role == userRoleConstant.I_SUPER_ADMIN) {
                if (userObj.role == userRoleConstant.P_SUPER_ADMIN) {
                    findAnotherUser = await findOne({ collection: 'User', query: { _id: { $nin: users }, partnerAdmin: userObj.partnerAdmin, role: userRoleConstant.P_SUPER_ADMIN, isDel: false } })
                    if (findAnotherUser) {
                        await updateOne({
                            collection: 'User',
                            query: { _id: { $in: users[0] } },
                            update: {
                                $set: {
                                    isDel: true
                                }
                            },
                        })
                        message = successMessage.REMOVE.replace(":attribute", "User")
                        audit = User_Activity.ADMIN_USER_DELETED.replace(':attributes', userObj.role);
                    } else {
                        userResponse = {
                            isShowPopup: true,
                            fullName: userObj.legalFname + " " + userObj.legalLname,
                        }
                        message = `You currently have only one Partner Super Admin. Please add one more Partner Super Admin and then delete this user.`
                    }
                } else if (userObj.role == userRoleConstant.I_LOCAL_ADMIN) {
                    findAnotherUser = await findOne({ collection: 'User', query: { _id: { $nin: users }, region: userObj.region, role: userRoleConstant.I_LOCAL_ADMIN, isDel: false } })
                    if (findAnotherUser) {
                        await updateOne({
                            collection: 'User',
                            query: { _id: { $in: users[0] } },
                            update: {
                                $set: {
                                    isDel: true
                                }
                            },
                        })
                        message = successMessage.REMOVE.replace(":attribute", "User")
                        audit = User_Activity.ADMIN_USER_DELETED.replace(':attributes', userObj.role);
                    } else {
                        userResponse = {
                            isShowPopup: true,
                            fullName: userObj.legalFname + " " + userObj.legalLname,
                        }
                        message = `You currently have only one IM Local Admin. Please add one more IM Local Admin and then delete this user.`
                    }
                } else if (userObj.role == userRoleConstant.P_LOCAL_ADMIN) {
                    findAnotherUser = await findOne({ collection: 'User', query: { _id: { $nin: users }, partnerAdmin: userObj.partnerAdmin, role: userRoleConstant.P_LOCAL_ADMIN, isDel: false } })
                    if (findAnotherUser) {
                        await updateOne({
                            collection: 'User',
                            query: { _id: { $in: users[0] } },
                            update: {
                                $set: {
                                    isDel: true
                                }
                            },
                        })
                        message = successMessage.REMOVE.replace(":attribute", "User")
                        audit = User_Activity.ADMIN_USER_DELETED.replace(':attributes', userObj.role);
                    } else {
                        userResponse = {
                            isShowPopup: true,
                            fullName: userObj.legalFname + " " + userObj.legalLname,
                        }
                        message = `You currently have only one Partner Local Admin. Please add one more Partner Local Admin and then delete this user.`
                    }
                }
                else {
                    findAnotherUser = await findOne({ collection: 'User', query: { _id: { $nin: users }, role: userRoleConstant.I_SUPER_ADMIN, isDel: false } })
                    // res.status(statusCode.UNAUTHORIZED).send(error(errorMessage.ACTION.replace(':attribute', request.user.role), {}, statusCode.UNAUTHORIZED))
                    if (findAnotherUser) {
                        await updateOne({
                            collection: 'User',
                            query: { _id: { $in: users[0] } },
                            update: {
                                $set: {
                                    isDel: true
                                }
                            },
                        })
                        message = successMessage.REMOVE.replace(":attribute", "User")
                    }

                }
            } else if (request.user.role == userRoleConstant.P_SUPER_ADMIN && userObj.role == userRoleConstant.P_LOCAL_ADMIN) {
                findAnotherUser = await findOne({ collection: 'User', query: { _id: { $nin: users }, partnerAdmin: userObj.partnerAdmin, role: userRoleConstant.P_LOCAL_ADMIN, isDel: false } })
                if (findAnotherUser) {
                    await updateOne({
                        collection: 'User',
                        query: { _id: { $in: users[0] } },
                        update: {
                            $set: {
                                isDel: true
                            }
                        },
                    })
                    message = successMessage.REMOVE.replace(":attribute", "User")
                    audit = User_Activity.ADMIN_USER_DELETED.replace(':attributes', userObj.role);
                } else {
                    userResponse = {
                        isShowPopup: true,
                        fullName: userObj.legalFname + " " + userObj.legalLname,
                    }
                    message = `You currently have only one Partner Local Admin. Please add one more Partner Local Admin and then delete this user.`
                }
            } else {
                res.status(statusCode.UNAUTHORIZED).send(error(errorMessage.ACTION.replace(':attribute', request.user.role), {}, statusCode.UNAUTHORIZED))
                return
            }
            // return
            res.send(success(message, { ...userResponse, auditIds: [req.body.users], isAuditLog: true, audit }, statusCode.OK))

        } catch (err: any) {
            logger.error("Admin Controller > deleteAdmin ", err);
            res.status(statusCode.FORBIDDEN).send(error("There is some issue during Delete the users.", err.message, statusCode.FORBIDDEN))
        }
    },

    getAdminUser: async (req: Request, res: Response) => {
        try {
            let userObj = await findOne({ collection: 'User', query: { _id: req.query.userId, isDel: false }, populate: { path: 'partnerAdmin region', select: 'partnerName region' } })

            if (!userObj) {
                res.status(statusCode.BAD_REQUEST).send(error(errorMessage.NOT_EXISTS.replace(":attribute", "User"), {}, statusCode.BAD_REQUEST))
                return
            }

            res.send(success(successMessage.FETCH_SUCCESS.replace(":attribute", "User"), userObj, statusCode.OK))
        } catch (err: any) {
            logger.error("Admin Controller > getAdminUser ", err);
            res.status(statusCode.FORBIDDEN).send(error("There is some issue during getting the user info.", err.message, statusCode.FORBIDDEN))
        }
    },

    getMultipleUserDetail: async (req: Request, res: Response) => {
        try {
            let users: Array<any> = req.body.users
            if (users) {
                for (let i = 0; i < users.length; i++) {
                    let userObj = await findOne({ collection: 'User', query: { _id: users[i] } })

                    if (!userObj) {
                        res.status(statusCode.BAD_REQUEST).send(error(errorMessage.NOT_EXISTS.replace(":attribute", "User"), {}, statusCode.BAD_REQUEST))
                        return
                    }
                }
            }

            let userArr = await find({ collection: "User", query: { _id: { $in: users } } });

            res.send(success(successMessage.FETCH_SUCCESS.replace(':attribute', "Users"), userArr, statusCode.OK))
        } catch (err: any) {
            logger.error("Admin Controller > getMultipleUserDetail ", err);
            res.status(statusCode.FORBIDDEN).send(error("There is some issue to get multiple user.", err.message, statusCode.FORBIDDEN))
        }
    },

    updateAdminUser: async (req: Request, res: Response) => {
        try {
            const { fname, lname, email, role, phoneNo, _id, partner, region, countryCode } = req.body

            const userObj = await findOne({
                collection: 'User',
                query: { _id, isDel: false }
            })

            if (!userObj) {
                res.status(statusCode.BAD_REQUEST).send(error(errorMessage.NOT_EXISTS.replace(":attribute", "User"), {}, statusCode.BAD_REQUEST))
                return
            }


            let searchQuery: any = {}

            searchQuery = {
                legalFname: fname,
                legalLname: lname,
                preferredFname: fname,
                preferredLname: lname,
                email: email,
                role: role,
                primaryPhoneNo: phoneNo,
                countryCode: countryCode
            }

            if (role == userRoleConstant.P_SUPER_ADMIN) {
                if (!partner) {
                    res.status(statusCode.BAD_REQUEST).send(error("If role is Super Partner Admin then partner field is mandatory.", {}, statusCode.BAD_REQUEST))
                    return
                }
                searchQuery["partnerAdmin"] = partner;
            }

            if (role == userRoleConstant.I_LOCAL_ADMIN) {
                if (!region) {
                    res.status(statusCode.BAD_REQUEST).send(error("If role is iMentor Local Admin then region filed is mandaotry.", {}, statusCode.BAD_REQUEST))
                    return

                }
                searchQuery["region"] = region;
            }

            let updateAdminUser = await findOneAndUpdate({
                collection: 'User',
                query: { _id: userObj._id },
                update: { $set: searchQuery }
            })

            res.status(statusCode.ACCEPTED).send(success(successMessage.UPDATE_SUCCESS.replace(":attribute", "User"), {
                ...updateAdminUser, auditIds: [userObj._id], isAuditLog: true, audit: User_Activity.ADMIN_USER_UPDATED.replace(':attributes', userObj.role)
            }, statusCode.ACCEPTED))

        } catch (err: any) {
            logger.error("Admin Controller > updateAdminUser ", err);
            res.status(statusCode.FORBIDDEN).send(error("There is some issue during updating the user.", err.message, statusCode.FORBIDDEN))
        }
    },

    logoutAdminUser: async (req: Request, res: Response) => {
        try {
            let request = req as requestUser;

            let userObj = await findOne({ collection: 'User', query: { _id: request.user._id } });

            if (!userObj) {
                res.status(statusCode.BAD_REQUEST).send(error(errorMessage.NOT_EXISTS.replace(":attribute", "User"), {}, statusCode.BAD_REQUEST));
                return
            }

            let sessionObj = await findOne({ collection: 'Session', query: { "account.email": userObj.email, "account.user": request.user._id } });

            // if (!sessionObj) {
            //     res.status(statusCode.FORBIDDEN).send(error(errorMessage.NOT_EXISTS.replace(':attribute', "Session"), {}, statusCode.FORBIDDEN))
            //     return
            // }

            await findOneAndUpdate({
                collection: 'Session',
                query: { "account.email": userObj.email, "account.user": request.user._id },
                update: {
                    $pull: {
                        account: {
                            email: userObj.email.toLowerCase()
                        }
                    }
                }
            })

            res.send(success("Successfully logout from account.", {}, statusCode.OK))
        } catch (err: any) {
            logger.error("Admin Controller > loginAdminUser ", err);
            res.status(statusCode.FORBIDDEN).send(error("There is some issue during logout the user.", err.message, statusCode.FORBIDDEN))
        }
    },

    resentInvitation: async (req: Request, res: Response) => {
        try {

            let users: Array<any> = req.body.users, urls;
            let request = req as requestUser
            for (let i = 0; i < users.length; i++) {
                let user = users[i];

                const userObj = await findOne({ collection: 'User', query: { _id: user } })
                if (!userObj) {
                    res.status(statusCode.BAD_REQUEST).send(error(errorMessage.NOT_EXISTS.replace(":attribute", "User"), {}, statusCode.BAD_REQUEST))
                    return
                }

                let encryptData = cryptoEncryption('register', { email: userObj.email })

                let url = config.HOST + "/register?query=" + encodeURIComponent(encryptData)

                var template = fs.readFileSync(__dirname + "/../../src/utils/emailTemplates/headerfooter.html").toString();
                var content = fs.readFileSync(__dirname + "/../../src/utils/emailTemplates/sendInvitation.html").toString();
                content = content.replace(/{{fullname}}/g, (userObj.preferredFname + " " + userObj.preferredLname));
                content = content.replace(/{{url}}/g, url);
                content = content.replace(/{{adminUserName}}/g, (request.user.preferredFname + " " + request.user.preferredLname));
                content = content.replace(/{{adminUserRole}}/g, request.user.role);
                content = content.replace(/{{adminProfilePic}}/g, request.user.profilePic ? request.user.profilePic : defaultProfilePicConstant.USER_PROFILE_PIC);
                template = template.replace(/{{template}}/g, content)

                sendMail(userObj.email, `You're Registered for iMentor`, "testing", template)

                await findOneAndUpdate({
                    collection: 'User',
                    query: { _id: user },
                    update: { $set: { resentInvitationDate: new Date() } }
                })

                // let url = `http://localhost:3000/api/admin/verifyOtp?userId=${user}`

                // urls.push(url)

            }


            res.send(success("Invitation has been sent.", {}, statusCode.OK));

        } catch (err: any) {
            logger.error("Admin Controller > resntInvitation ", err);
            res.status(statusCode.FORBIDDEN).send(error("There is some issue in sending invitation.", err.message, statusCode.FORBIDDEN))
        }
    },

    verifyOTP: async (req: Request, res: Response) => {
        try {
            let { otp } = req.body
            let userId = req.query.userId

            let userObj = await findOne({ collection: 'User', query: { _id: userId } });
            if (!userObj) {
                res.status(statusCode.BAD_REQUEST).send(error(errorMessage.NOT_EXISTS.replace(":attribute", "User"), {}, statusCode.BAD_REQUEST))
                return
            }

            if (otp == userObj.otp) {
                res.send(success(successMessage.VERIFY_SUCCESS.replace(":attribute", "OTP"), {}, statusCode.OK))
                return
            } else {
                res.status(statusCode.BAD_REQUEST).send(error(errorMessage.INVALID.replace(":attribute", "OTP"), {}, statusCode.BAD_REQUEST))
                return
            }

        } catch (err: any) {
            logger.error("Admin Controller > verifyOtp ", err);
            res.status(statusCode.FORBIDDEN).send(error("There is some issue in verifying OTP.", err.message, statusCode.FORBIDDEN))
        }
    },

    forgotPasswordInvitation: async (req: Request, res: Response) => {
        try {
            let checkUser = await findOne({
                collection: 'User',
                query: {
                    email: req.body.email.toLowerCase(),
                    isDel: false
                }
            })

            if (!checkUser) {
                res.status(statusCode.BAD_REQUEST).send(error("No account found, contact your admin.", {}, statusCode.BAD_REQUEST))
                return
            }
            if (checkUser.role == userRoleConstant.MENTEE || checkUser.role == userRoleConstant.MENTOR) {
                res.status(statusCode.BAD_REQUEST).send(error(`${checkUser.role} can't forgot password.`));
                return
            }

            if (checkUser.status != userStatusConstant.ACTIVE) {
                res.status(statusCode.BAD_REQUEST).send(error("Registration is incomplete.", {}, statusCode.BAD_REQUEST));
                return
            }

            await findOneAndUpdate({ collection: 'User', query: { _id: checkUser._id }, update: { isPasswordLinkExpired: false }, options: { new: true } })

            checkUser = _.pick(checkUser, "legalFname", "legalLname", "preferredFname", "preferredLname", "email", "role", "_id")

            let url = config.HOST + "/change-password/" + checkUser._id;

            // let url = config.HOST + "/register?query=" + userObj.email
            // template = template.replace(/{{url}}/g, url)

            var template = fs.readFileSync(__dirname + "/../../src/utils/emailTemplates/headerfooter.html").toString();
            var content = fs.readFileSync(__dirname + "/../../src/utils/emailTemplates/forgotpassword.html").toString();
            content = content.replace(/{{fullname}}/g, (checkUser.preferredFname + " " + checkUser.preferredLname));
            content = content.replace(/{{url}}/g, url);
            template = template.replace(/{{template}}/g, content)


            sendMail(checkUser.email, "Password Reset", 'Forgot password', template)

            res.send(success(successMessage.FETCH_SUCCESS.replace(':attribute', "User"), { checkUser, url }, statusCode.OK))
        } catch (err: any) {
            ;

            res.status(statusCode.FORBIDDEN).send(error("There is some issue in checking user.", err.message, statusCode.FORBIDDEN))
        }
    },

    createPassword: async (req: Request, res: Response) => {
        try {
            let { userId, password, confirmPassword } = req.body

            let userObj = await findOne({ collection: 'User', query: { _id: userId } })

            if (!userObj) {
                res.status(statusCode.BAD_REQUEST).send(error(errorMessage.NOT_EXISTS.replace(":attribute", 'User'), {}, statusCode.BAD_REQUEST));
                return
            }

            if (userObj.isPasswordLinkExpired == true) {
                res.status(statusCode.BAD_REQUEST).send(error(errorMessage.EXPIRED.replace(":attribute", "Link"), {}, statusCode.BAD_REQUEST))
                return
            }

            if (password == confirmPassword) {
                await findOneAndUpdate({
                    collection: 'User',
                    query: { _id: userId },
                    update: { $set: { password: await encrypt(password), isPasswordLinkExpired: true } },
                    options: { new: true }
                })

                res.send(success(successMessage.UPDATE_SUCCESS.replace(":attribute", 'user'), {}, statusCode.OK))
                return
            } else {
                res.send(error("Password and confirmPassword must be same", {}, statusCode.BAD_REQUEST))
                return
            }

        } catch (err: any) {
            logger.error("Admin Controller > createPassword ", err);
            res.status(statusCode.FORBIDDEN).send(error("There is some issue in creating password.", {}, err.message))
        }
    },

    encryptData: async (req: Request, res: Response) => {
        let { key, data } = req.body

        let encData = cryptoEncryption(key, data)

        let url = `http://localhost:3000/change-password/64b502a41716bda35f250b45`

        res.send(success('Successfully Encrypted data', { encData, url }, statusCode.OK))
    },

    decryptData: async (req: Request, res: Response) => {
        let { data } = req.body

        let decryptData = cryptoDecryption(data)

        res.send(success('Successfully Encrypted data', decryptData, statusCode.OK))
    },

    currentLoggedInUsersList: async (req: Request, res: Response) => {
        try {
            let request = req as requestUser
            let account: Array<any> = []

            let currentUser = await findOne({ collection: 'User', query: { _id: request.user._id, isDel: false, status: userStatusConstant.ACTIVE }, populate: [{ path: 'region', select: 'region' }] })

            let token: any = req.headers["x-auth-token"]
            let verifyUser: any = jwt.verify(token, config.PRIVATE_KEY);

            if (!verifyUser) {
                res.status(statusCode.UNAUTHORIZED).send(error("Unauthorised User", {}, statusCode.UNAUTHORIZED))
                return
            }

            let userList = await findOne({
                collection: 'Session',
                query: { userId: req.body.userId },
                project: { 'account': 1 },
                populate: { path: 'account.user', select: 'legalFname legalLname preferredFname preferredLname region partnerAdmin', populate: { path: 'region partnerAdmin', select: 'region partnerName' } }
            })

            if (!userList) {
                res.status(statusCode.BAD_REQUEST).send(error(errorMessage.NOT_EXISTS.replace(':attribute', 'userList'), {}, statusCode.BAD_REQUEST))
                return
            }

            if (request.user._id.toString() == req.body.userId.toString()) {
                (userList.account.length > 0 ? userList.account : []).forEach((x: any) => {
                    account.push({
                        email: x.email,
                        token: x.token,
                        role: x.role,
                        userId: x?.user?._id,
                        fullName: (x.user ? x.user?.preferredFname : '') + " " + (x.user ? x.user?.preferredLname : ''),
                        partnerId: x?.user?.partnerAdmin?._id || '',
                        partnerName: x?.user?.partnerAdmin?.partnerName || '',
                        regionId: x?.user?.region?._id || '',
                        region: x?.user?.region?.region || ''
                    })
                })
            } else {
                let findMasterUser = (userList.account).find((x: any) => x?.user?._id.toString() == req.body.userId.toString())
                if (findMasterUser) {
                    account.push({
                        email: findMasterUser.email,
                        token: findMasterUser.token,
                        role: findMasterUser.role,
                        userId: findMasterUser.user._id,
                        fullName: (findMasterUser.user.preferredFname) + " " + findMasterUser.user.preferredLname,
                        region: (currentUser.role == userRoleConstant.I_LOCAL_ADMIN && currentUser.region) ? currentUser.region.region : '',
                        regionId: (currentUser.role == userRoleConstant.I_LOCAL_ADMIN && currentUser.region) ? currentUser.region._id : '',
                        partnerId: currentUser?.partnerAdmin?._id || '',
                        partnerName: currentUser?.partnerAdmin?.partnerName || ''
                    })
                }
            }

            account = account.filter((acc: any) => { return acc.userId != verifyUser?._id });

            for (let i = 0; i < account.length; i++) {
                const ele = account[i];
                let findUser = await findOne({ collection: 'User', query: { _id: ele.userId, isDel: false, status: userStatusConstant.ACTIVE, role: userRoleConstant.I_LOCAL_ADMIN }, populate: { path: 'region', select: 'region' } });

                ele['region'] = (findUser && findUser.region) ? findUser.region.region : ''
            }

            let key = "UserList"

            let data = cryptoEncryption(key, { _id: userList._id, account })

            res.send(success(successMessage.FETCH_SUCCESS.replace(":attribute", "UserList"), data, statusCode.OK))
        } catch (err: any) {
            console.log(err)
            logger.error("Admin Controller > currentLoggedInUserList ", err);
            res.status(statusCode.FORBIDDEN).send(error("There is some issue during fetching current logged userList.", err.message, statusCode.FORBIDDEN))
        }
    },

    loginAsAdminUser: async (req: Request, res: Response) => {
        try {
            let userObj = await findOne({ collection: 'User', query: { _id: req.body.userId }, populate: [{ path: 'partnerAdmin region' }] });

            if (!userObj) {
                res.status(statusCode.BAD_REQUEST).send(error(errorMessage.NOT_EXISTS.replace(":attribute", 'user'), {}, statusCode.FORBIDDEN))
                return
            }

            if (userObj.status != userStatusConstant.ACTIVE) {
                res.status(statusCode.BAD_REQUEST).send(error("Registration is incompleted.", {}, statusCode.BAD_REQUEST));
                return
            }

            let fullName = userObj.legalFname + " " + userObj.legalLname;

            let token = await generateTokenLoginAs(userObj);

            if (!token) {
                res.send(error("Token Issue. Not Generated", {}, statusCode.EXPECTATION_FAILED))
                return
            }

            let findSession = await findOne({
                collection: 'Session',
                query: {
                    userId: req.body.masterUserId
                    // 'account.email': userObj.email.toLowerCase()
                }
            })

            let findAccount = (findSession.account.length > 0 ? findSession.account : []).find((x: any) => x.email.toLowerCase() == userObj.email.toLowerCase())

            if (findSession && findAccount) {
                await findOneAndUpdate({
                    collection: 'Session',
                    query: {
                        userId: req.body.masterUserId,
                        'account.email': userObj.email.toLowerCase()
                    },
                    update: {
                        $set: {
                            'account.$[i].token': token,
                            'account.$[i].user': req.body.userId,
                            'account.$[i].role': userObj.role,
                            'account.$[i].email': userObj.email
                        }
                    },
                    options: {
                        arrayFilters: [{ 'i.email': userObj.email.toLowerCase() }],
                        useFindAndModify: true
                    }
                })
            }
            else {
                await findOneAndUpdate({
                    collection: 'Session',
                    query: {
                        userId: req.body.masterUserId
                    },
                    update: {
                        $push: {
                            account: {
                                email: userObj.email,
                                role: userObj.role,
                                token: token,
                                user: userObj._id
                            }
                        },
                    },
                    options: {
                        new: true,
                        upsert: true
                    }
                })
            }

            let key = "LoginAs";

            let data = cryptoEncryption(key, {
                userId: userObj._id, role: userObj.role, token, fullName, region: userObj.region ? userObj.region.region : '', regionId: userObj.region ? userObj.region._id : '',
                partnerId: userObj?.partnerAdmin?._id || '', email: userObj.email, logo: userObj?.partnerAdmin?.logo || null, partnerName: userObj?.partnerAdmin ? userObj?.partnerAdmin?.partnerName : '',
                school: userObj?.partnerAdmin?.assignedSchoolOrInstitute || userObj?.region?.assignedSchoolOrInstitute || ''
            })

            res.send(success(`Login as ${userObj.role
                } successfully.`, { data, auditIds: [req.body.userId], isAuditLog: true, audit: User_Activity.LOGIN.replace(':attributes', userObj.role) }, statusCode.OK))

        } catch (err: any) {
            logger.error("Admin Controller > loginAsAdminUser ", err);
            res.status(statusCode.FORBIDDEN).send(error("There is some issue in login as user.", err.message, statusCode.FORBIDDEN))
        }
    },

    removeUserFromLoggedInUser: async (req: Request, res: Response) => {
        try {
            let sessionObj = await findOne({
                collection: 'Session',
                query: {
                    userId: req.body.masterUserId,
                    'account.user': req.body.userId
                }
            })

            if (!sessionObj) {
                res.status(statusCode.BAD_REQUEST).send(error(errorMessage.NOT_EXISTS.replace(":attribute", 'session'), {}, statusCode.FORBIDDEN))
                return
            }

            await findOneAndUpdate({
                collection: 'Session',
                query: {
                    userId: req.body.masterUserId,
                    'account.user': req.body.userId
                },
                update: {
                    $pull: {
                        account: {
                            user: req.body.userId
                        }
                    }
                },
                options: {
                    new: true,
                }
            })

            res.send(success(successMessage.REMOVE.replace(":attribute", 'User'), {}, statusCode.OK))
        } catch (err: any) {
            logger.error("Admin Controller > removeUserFromLoggedInUser ", err);
            res.status(statusCode.FORBIDDEN).send(error("There is some issue during removing loggedIn user from List.", err.message, statusCode.FORBIDDEN))
        }
    },

    importUserFromCSV: async (req: Request, res: Response) => {
        try {
            let csvFile: any = req.file
            let request = req as requestUser
            const extArr = uploadConstant.CSV_FILE_EXT_ARR;

            if (request.user.role == userRoleConstant.I_LOCAL_ADMIN || request.user.role == userRoleConstant.P_LOCAL_ADMIN) {
                res.status(statusCode.UNAUTHORIZED).send(error(errorMessage.ACTION.replace(":attribute", request.user.role), {}, statusCode.UNAUTHORIZED));
                return
            }

            // validate file
            let validateUplaodedFile = await validateFile(res, csvFile, 'adminCsv', extArr);
            if (validateUplaodedFile) {
                res.status(statusCode.BAD_REQUEST).send(error(validateUplaodedFile, {}, statusCode.BAD_REQUEST))
                return
            }
            let skippedUser: Array<any> = [], message: string = ''


            csvtojson()
                .fromFile(__dirname + "/../../uploads/UserCsv/" + csvFile.filename)
                .then(async (data: Array<any>) => {

                    const totalData = data.length;
                    const auditIds: any = [];

                    for (let i = 0; i < data.length; i++) {
                        let rows = data[i];

                        let obj: any = {}

                        for (var key in rows) {
                            if (!rows['email'] || !rows['fname'] || !rows['lname']) {
                                message = "Invalid First/Last name or Email."
                                break
                            } else if (!rows['role']) {
                                message = "role is required."
                            } else if (rows.role != userRoleConstant.I_SUPER_ADMIN && !rows['region/partner']) {
                                message = "Region/Partner is required."
                            }
                            else if (!rows['phoneNo']) {
                                message = `PhoneNo is required.`
                                break
                            }
                        }

                        if (!message && rows['email']) {
                            let regexPattern = /\S+@\S+\.\S+/
                            let isEmailValid = regexPattern.test(rows['email'])
                            if (!isEmailValid) {
                                message = `Invalid Email.`
                            }
                        }

                        if (!message && rows['phoneNo'] && (rows['phoneNo'].length < 10 || rows['phoneNo'].length > 11 || rows['phoneNo'].includes("."))) {
                            message = "Phone number length should be 10 or 11"
                        }

                        // return
                        if (!message) {
                            const isEmailExist: any = await isEmailAlreadyExists(rows.email)
                            let userObj = await findOne({ collection: 'User', query: { email: rows.email.toLowerCase(), isDel: false } });
                            if (rows.role == userRoleConstant.I_LOCAL_ADMIN && request.user.role == userRoleConstant.I_SUPER_ADMIN) {
                                if (!userObj && isEmailExist) {
                                    obj = {
                                        role: userRoleConstant.I_LOCAL_ADMIN,
                                        legalFname: rows.fname,
                                        legalLname: rows.lname,
                                        preferredFname: rows.fname,
                                        preferredLname: rows.lname,
                                        email: rows.email.toLowerCase(),
                                        primaryPhoneNo: formatePhoneNumber(rows.phoneNo),
                                        countryCode: "+1",
                                        status: userStatusConstant.PENDING,
                                        userImported: true
                                    }

                                    let findRegion = await findOne({ collection: 'Region', query: { region: rows['region/partner'] } })
                                    if (findRegion) {
                                        obj['region'] = findRegion._id
                                    }
                                    else {
                                        obj = {}
                                        message = `Region is not exists.`
                                    }
                                } else {
                                    message = "Email already exists."
                                }
                            } else if (rows.role == userRoleConstant.P_SUPER_ADMIN && request.user.role == userRoleConstant.I_SUPER_ADMIN) {
                                if (!userObj && isEmailExist) {
                                    obj = {
                                        role: userRoleConstant.P_SUPER_ADMIN,
                                        legalFname: rows.fname,
                                        legalLname: rows.lname,
                                        preferredFname: rows.fname,
                                        preferredLname: rows.lname,
                                        email: rows.email.toLowerCase(),
                                        primaryPhoneNo: formatePhoneNumber(rows.phoneNo),
                                        countryCode: "+1",
                                        status: userStatusConstant.PENDING,
                                        userImported: true
                                    }

                                    let partnerObj = await findOne({ collection: "Partner", query: { partnerName: rows['region/partner'] } });
                                    if (partnerObj) {
                                        obj['partnerAdmin'] = partnerObj._id
                                    } else {
                                        obj = {}
                                        message = `Partner is not exists.`
                                    }
                                } else {
                                    message = "Email already exists."
                                }
                            } else if (rows.role == userRoleConstant.I_SUPER_ADMIN && request.user.role == userRoleConstant.I_SUPER_ADMIN) {
                                if (!userObj && isEmailExist) {
                                    obj = {
                                        role: userRoleConstant.P_SUPER_ADMIN,
                                        legalFname: rows.fname,
                                        legalLname: rows.lname,
                                        preferredFname: rows.fname,
                                        preferredLname: rows.lname,
                                        email: rows.email.toLowerCase(),
                                        primaryPhoneNo: formatePhoneNumber(rows.phoneNo),
                                        countryCode: "+1",
                                        status: userStatusConstant.PENDING,
                                        userImported: true
                                    }
                                } else {
                                    message = "Email already exists."
                                }
                            }
                            else if (rows.role == userRoleConstant.P_LOCAL_ADMIN && request.user.role == userRoleConstant.P_SUPER_ADMIN) {
                                if (!userObj && isEmailExist) {
                                    obj = {
                                        role: userRoleConstant.P_LOCAL_ADMIN,
                                        legalFname: rows.fname,
                                        legalLname: rows.lname,
                                        preferredFname: rows.fname,
                                        preferredLname: rows.lname,
                                        email: rows.email.toLowerCase(),
                                        primaryPhoneNo: formatePhoneNumber(rows.phoneNo),
                                        countryCode: "+1",
                                        status: userStatusConstant.PENDING,
                                        userImported: true
                                    }

                                    let partnerObj = await findOne({ collection: "User", query: { _id: request.user._id } });
                                    if (partnerObj) {
                                        obj['partnerAdmin'] = partnerObj.partnerAdmin
                                    } else {
                                        obj = {}
                                        message = "PartnerAdmin is not exists."
                                    }
                                } else {
                                    message = "Email already exists."
                                }
                            } else {
                                obj = {}
                                rows.message = `${request.user.role} can't add ${rows.role}.`
                                rows.row = i + 2;

                                skippedUser.push(rows);
                            }

                            let isEmptyObj = _.isEmpty(obj)
                            if (!isEmptyObj) {
                                let insertUser = await insertOne({ collection: 'User', document: obj });
                                auditIds.push(insertUser._id);

                                let encryptData = cryptoEncryption('register', { email: insertUser.email })

                                let url = config.HOST + "/register?query=" + encodeURIComponent(encryptData)
                                // let url = config.HOST + "/register?query=" + insertUser.email

                                var template = fs.readFileSync(__dirname + "/../../src/utils/emailTemplates/headerfooter.html").toString();
                                var content = fs.readFileSync(__dirname + "/../../src/utils/emailTemplates/registerUserInvitation.html").toString();
                                content = content.replace(/{{fullname}}/g, (insertUser.preferredFname + " " + insertUser.preferredLname));
                                content = content.replace(/{{url}}/g, url);
                                content = content.replace(/{{adminUserName}}/g, (request.user.preferredFname + " " + request.user.preferredLname));
                                content = content.replace(/{{adminUserRole}}/g, request.user.role);
                                content = content.replace(/{{adminProfilePic}}/g, request.user.profilePic ? request.user.profilePic : defaultProfilePicConstant.USER_PROFILE_PIC);
                                template = template.replace(/{{template}}/g, content)

                                sendMail(insertUser.email, `You're Registered for iMentor`, 'CSV User', template)
                            }
                        } /* else {
                            message = "Admin Type is required."
                        } */

                        if (message) {
                            rows.message = message;
                            rows.row = i + 2;

                            skippedUser.push(rows);
                            message = "";
                        }
                    }
                    let uplaodedUser = data.length - skippedUser.length
                    let skippedUserCount = skippedUser.length
                    let keyArr: Array<any> = [], skippedUserKey: Array<any> = []
                    skippedUser.forEach(obj => {
                        let obj1 = { ...obj };
                        let key = Object.keys(obj1);
                        for (let i = 0; i < key.length; i++) {
                            keyArr.push(key[i]);

                        }
                    });

                    skippedUserKey = keyArr.filter((item, field) => {
                        return keyArr.indexOf(item) == field
                    })

                    let csvUrl: any;

                    if (skippedUser && skippedUser.length > 0) {
                        csvUrl = await exportFileFunction(true, 'skipAdminUserCsv', skippedUser, res, req);
                    }

                    csvUrl = (csvUrl && csvUrl.filePath) ? csvUrl.filePath : "";

                    res.status(statusCode.OK).send(success("CSV uploaded successfully.", {
                        skippedUser, totalData,
                        skippedUserCount, uplaodedUser, skippedUserKey, csvUrl,
                        auditIds, isCsv: true, isAuditLog: true, audit: User_Activity.CREATE_BULK_ADMINS
                    }, statusCode.OK))
                })

        } catch (err: any) {
            res.status(statusCode.FORBIDDEN).send(error("There is some issue while importing user from CSV.", err.message, statusCode.FORBIDDEN))
        }
    },

    sendMailCheck: async (req: Request, res: Response) => {
        try {

            let findRegion = await findOne({ collection: 'Region', query: { region: new RegExp(`(${req.body.text})`, 'i') } });

            res.send(findRegion)
            // let { to, text, subject } = req.body
            // let password: any = config.EMAIL_SERVICE.PASSWORD ? config.EMAIL_SERVICE.PASSWORD : ""



            // password = cryptoDecryption(password)
            // let mailTransporter = nodeMailer.createTransport({
            //     service: 'gmail',
            //     auth: {
            //         user: 'hello.maheksavani@gmail.com',
            //         pass: 'pfciklgbyvjjplnu'
            //     }
            // });

            // let mailObj = {
            //     from: "hello.maheksavani@gmail.com",
            //     to: "neel.bhavsar@artoon.in",
            //     subject: "test",
            //     text: "test"
            // }

            // mailTransporter.sendMail(mailObj, (err, data) => {
            //     if (err) {
            //         ;

            //         logger.error("There is some issue during sending mail", err)
            //     } else {
            //         return data
            //     }
            // })

            // res.send("Mail Sent")
        } catch (error) {
            res.send(error)
        }
    },

    getUserProfile: async (req: Request, res: Response) => {
        try {
            let request = req as requestUser;

            let userObj = await findOne({
                collection: 'User',
                query: { _id: request.user._id }
            })

            if (!userObj) {
                res.status(statusCode.BAD_REQUEST).send(error(errorMessage.NOT_EXISTS.replace(":attribute", "User"), {}, statusCode.BAD_REQUEST));
                return
            }

            let userRes = {
                _id: userObj._id,
                fname: userObj.preferredFname ? userObj.preferredFname : "",
                lname: userObj.preferredLname ? userObj.preferredLname : '',
                role: userObj.role ? userObj.role : '',
                email: userObj.email ? userObj.email : '',
                phoneNo: userObj.primaryPhoneNo ? userObj.primaryPhoneNo : ''
            }
            // userObj = _.pick(userObj, 'legalFname', 'legalLname', 'email', 'primaryPhoneNo', "_id")

            res.send(success(successMessage.FETCH_SUCCESS.replace(":attribute", 'User'), userRes, statusCode.OK))
        } catch (err: any) {
            logger.error("Admin Controller >> Get User Profile", err)
            res.status(statusCode.FORBIDDEN).send(error("There is some issue during fetching user profile", err.message, statusCode.FORBIDDEN))
        }
    },

    updateProfileDetails: async (req: Request, res: Response) => {
        try {
            let request = req as requestUser

            let userObj = await findOne({
                collection: 'User',
                query: { _id: request.user._id }
            })

            if (!userObj) {
                res.status(statusCode.BAD_REQUEST).send(error(errorMessage.NOT_EXISTS.replace(":attribute", 'User'), {}, statusCode.BAD_REQUEST))
                return
            }

            let updatedUser = await findOneAndUpdate({
                collection: 'User',
                query: { _id: request.user._id },
                update: {
                    $set: {
                        legalFname: req.body.fname,
                        legalLname: req.body.lname,
                        preferredFname: req.body.fname,
                        preferredLname: req.body.lname,
                        primaryPhoneNo: req.body.phoneNo,
                        email: req.body.email.toLowerCase()
                    }
                },
                options: { new: true }
            })

            updatedUser = _.pick(updatedUser, 'legalFname', 'legalLname', 'preferredFname', 'preferredLname', 'role', 'email')
            res.send(success(successMessage.UPDATE_SUCCESS.replace(":attribute", "User details"), { ...updatedUser, auditIds: [request.user._id], isAuditLog: true, audit: User_Activity.ADMIN_USER_UPDATED }, statusCode.OK))
        } catch (err: any) {
            logger.error("Admin Controller >> Update User Profile", err)
            res.status(statusCode.FORBIDDEN).send(error("There is some issue during updating profile.", err.message, statusCode.FORBIDDEN))
        }
    },

    adminRegister: async (req: Request, res: Response) => {
        try {
            let { email, password, confirmPassword } = req.body

            // const isEmailExists: any = await isEmailAlreadyExists(email);

            // if (!isEmailExists) {
            //     res.status(statusCode.BAD_REQUEST).send(error(errorMessage.ALREADY_EXISTS.replace(":attribute", "email"), {}, statusCode.BAD_REQUEST));
            //     return
            // }

            let userObj = await findOne({ collection: 'User', query: { email: email.toLowerCase(), isDel: false }, populate: [{ path: 'partnerAdmin region' }] });

            if (!userObj) {
                res.status(statusCode.BAD_REQUEST).send(error(errorMessage.NOT_EXISTS.replace(":attribute", "user"), {}, statusCode.BAD_REQUEST));
                return
            }

            if (userObj.isRegLinkExpired == true) {
                res.status(statusCode.BAD_REQUEST).send(error(errorMessage.EXPIRED.replace(":attribute", "Link"), {}, statusCode.BAD_REQUEST));
                return
            }

            if (password == confirmPassword) {
                await findOneAndUpdate({
                    collection: 'User',
                    query: { _id: userObj._id },
                    update: { $set: { password: await encrypt(password), status: userStatusConstant.ACTIVE, isRegLinkExpired: true } },
                    options: { new: true }
                })

                let fullName = userObj.preferredFname + " " + userObj.preferredLname;

                let token = await generateToken(userObj);

                if (!token) {
                    res.send(error("Token Expired"));
                    return;
                }

                let sessionObj = await findOne({ collection: 'Session', query: { userId: userObj._id } })
                if (sessionObj) {

                    let findCurrentUserSession = (sessionObj.account).find((x: any) => x.user.toString() == userObj._id.toString());

                    if (findCurrentUserSession) {
                        await findOneAndUpdate({
                            collection: 'Session',
                            query: {
                                userId: userObj._id,/*  'account.email': userObj.email.toLowerCase() */
                            },
                            update: {
                                $set: {
                                    'account.$[i].token': token,
                                    'account.$[i].user': userObj._id,
                                    'account.$[i].role': userObj.role,
                                    'account.$[i].email': userObj.email,
                                }
                            },
                            options: {
                                arrayFilters: [{ 'i.email': req.body.email.toLowerCase() }],
                                upsert: true
                            }
                        })
                    } else {
                        await findOneAndUpdate({
                            collection: 'Session',
                            query: {
                                userId: userObj._id,
                            },
                            update: {
                                $push: {
                                    account: {
                                        'token': token,
                                        'user': userObj._id,
                                        'role': userObj.role,
                                        'email': userObj.email,
                                        default: true
                                    }

                                }
                            },
                            options: {
                                upsert: true
                            }
                        })
                    }


                } else {

                    await insertOne({
                        collection: "Session",
                        document: {
                            userId: userObj._id,
                            account: [
                                {
                                    email: userObj.email,
                                    user: userObj._id,
                                    token: token,
                                    default: true,
                                    role: userObj.role,
                                }
                            ],
                        },
                    });

                }

                let key = "LoginAs";

                let data = cryptoEncryption(key, {
                    userId: userObj._id, role: userObj.role, token, fullName, region: userObj?.region?.region || '', regionId: userObj?.region?._id || null,
                    partnerId: userObj?.partnerAdmin?._id || null, logo: userObj?.partnerAdmin?.logo || null, partnerName: userObj?.partnerAdmin?.partnerName || '',
                    school: userObj?.partnerAdmin?.assignedSchoolOrInstitute || userObj?.region?.assignedSchoolOrInstitute || ''
                })

                res.send(success(successMessage.UPDATE_SUCCESS.replace(":attribute", 'User'), data, statusCode.OK))
                return
            } else {
                res.send(error("Password and confirmPassword must be same", {}, statusCode.BAD_REQUEST))
                return
            }
        } catch (err: any) {
            res.status(statusCode.FORBIDDEN).send(error("There is some issue during registering admin.", err.message, statusCode.FORBIDDEN))
        }
    },

    changePassword: async (req: Request, res: Response) => {
        try {
            let { currentPassword, newPassword, userId } = req.body

            let userObj = await findOne({ collection: 'User', query: { _id: userId, isDel: false } })
            if (!userObj) {
                res.status(statusCode.BAD_REQUEST).send(error(errorMessage.NOT_EXISTS.replace(":attribute", 'user'), {}, statusCode.BAD_REQUEST));
                return
            }

            if (userObj.password) {
                let decryptedPassword = await decrypt(currentPassword, userObj.password);
                if (decryptedPassword) {
                    await findOneAndUpdate({
                        collection: 'User',
                        query: { _id: userId },
                        update: {
                            password: await encrypt(newPassword)
                        },
                        options: { new: true }
                    })
                    res.send(success(successMessage.UPDATE_SUCCESS.replace(":attribute", "Password"), { auditIds: [userId], isAuditLog: true, audit: User_Activity.CHANGE_PASSWORD.replace(':attributes', userObj.role) }, statusCode.OK))
                } else {
                    res.status(statusCode.FORBIDDEN).send(error("The current password do not match.", {}, statusCode.UNAUTHORIZED))
                    return
                }
            } else {
                res.status(statusCode.BAD_REQUEST).send(error("User haven't singedup properly yet.", {}, statusCode.BAD_REQUEST))
                return
            }
        } catch (err: any) {
            res.status(statusCode.FORBIDDEN).send(error("There is some issue in change password", err.message))
        }
    }
}
