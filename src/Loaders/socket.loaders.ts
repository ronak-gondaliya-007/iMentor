import { Server } from "socket.io";
import jwt from "jsonwebtoken";
import config from "../utils/config";
import { sendMsg, getMsg, readMsg, getMsgList, sendMsgReaction, matchedFound, lessonCompleted } from "../Controller/Web/message.controller"
import { getCounts, getNotifications, readNotification } from "../Controller/Web/notification.controller"
import { createAdapter } from '@socket.io/redis-adapter';
import { createClient } from 'redis';
import { authController } from '../Controller/Web/auth.controller';
import { socketAuthVerification } from '../middleware/auth';
import { requestUser } from "../Interfaces/schemaInterfaces/user";

export default async function (server: any) {

    // Set up Socket.IO with CORS enabled for all origins
    const io = new Server(server, {
        transports: ["websocket", "polling"]
    });

    // Set up a Set to store active users
    const activeUsers: Set<string> = new Set();

    // Attach io and activeUsers to the global object
    (global as any).io = io;
    (global as any).activeUsers = activeUsers;

    // redis pub - sub for multiple server message request and response
    var redisConfig: any;
    var dbNo = process.env.REDIS_DB_NO ?? 5;
    if (process.env.REDISENV === "prod1") {
        redisConfig = { url: process.env.REDIS_LIVE_HOST }
        //redisConfig = { host: process.env.REDIS_HOST, port: process.env.REDIS_PORT, db: dbNo };
    } else {
        redisConfig = {
            socket: {
                host: process.env.REDIS_HOST,
                port: process.env.REDIS_PORT,
            },
            password: process.env.REDIS_PASSWORD
        }
    }
    console.log("redisConfig===============>", redisConfig);

    var pubClient: any = createClient(redisConfig);
    (global as any).pubClient = pubClient;
    pubClient.on('ready', () => console.log('Redis Client success'));
    pubClient.on('error', (err: any) => console.log('Redis Client Error', err));


    await pubClient.connect()
        .then(() => console.log('Redis pubClient connection success'))
        .catch((err: any) => console.log('Redis pubClient connection failed error', err));


    pubClient.select(process.env.REDIS_DB_NO);

    var subClient = pubClient.duplicate();

    await subClient.connect()
        .then(() => console.log('Redis subClient connection success'))
        .catch((err: any) => console.log('Redis subClient connection failed error', err));

    const redisAdapter = createAdapter(pubClient, subClient);

    io.adapter(redisAdapter);

    io.on('connection', (socket: any) => {
        console.log('socket handshake query ======================>', socket.handshake.query);
        console.log('socket id======================>', socket.id);

        console.log("active Users", activeUsers);

        socket.on('join', async function (data: any) {
            console.log('user connected', data);
            try {
                if (data.token && data.token !== null && data.token !== '' && data.token != 'null' && data.token != undefined && data.token != 'undefined') {
                    const userToken = data.token?.toString();
                    const decoded = jwt.verify(userToken, config.PRIVATE_KEY) as requestUser;
                    console.log("decoded-----------------------------------------------------", decoded)
                    decoded.token = userToken;

                    if (decoded) {
                        socket.userObj = decoded;
                        activeUsers.add(data.user_id ? data.user_id : socket.userObj._id);
                        const verifyUser = await authController.checkActiveUser(data.user_id);
                        if (verifyUser) {
                            await pubClient.lPush('activeUsers', data.user_id);
                        }
                        socket.join(data.user_id ? data.user_id : socket.userObj._id);
                        console.log("active Users", activeUsers);
                        getCounts({ data: { user_id: data.user_id ? data.user_id : socket.userObj._id, user_type: socket.userObj.role } });
                        (global as any).io.to(data.user_id ? data.user_id : socket.userObj._id).emit("response", { event: "join", success: true, data: { isActive: true } });
                    }
                }
            } catch (err: any) {
                console.log("err", err)
                socket.emit("response", { event: "error", message: "unauthorised!", success: false, data: { "event": "connection", message: "Token has been expired." } });
            }
        });

        socket.on('request', async function (data: any) {

            const verification = await socketAuthVerification(socket.userObj.token, socket.userObj.user_id);
            console.log("verification", verification);

            if (verification && socket.userObj) {
                data.data.user_id = socket.userObj._id
                data.data.user_type = socket.userObj.role
                data.data.user_name = socket.userObj.first_name + " " + socket.userObj.last_name
                data.data.email = socket.userObj.email
                data.data.socket_id = socket.id

                console.log(data.event);
                switch (data.event) {
                    case 'sendMsg':
                        sendMsg(data)
                        break;
                    case 'sendMsgReaction':
                        sendMsgReaction(data)
                        break;
                    case 'getMsg':
                        getMsg(data)
                        break;
                    case 'readMsg':
                        readMsg(data)
                        break;
                    case 'getMsgList':
                        getMsgList(data)
                        break;
                    case 'getNotifications':
                        getNotifications(data)
                        break;
                    case 'readNotification':
                        readNotification(data)
                    case 'getCounts':
                        getCounts(data)
                        break;
                    case 'matchedFound':
                        matchedFound(data)
                        break;
                    case 'lessonCompleted':
                        lessonCompleted(data)
                        break;
                    default:
                        break;
                }
            } else {
                socket.emit("response", { event: "error", message: "unauthorised!", success: false, data: { "event": "connection", message: "Token has been expired." } });
            }
        });

        socket.on('leave', function (data: any) {
            console.log('user leave');
            console.log('user disconnected data', data);
            (global as any).io.to(data.data.user_id).emit("response", { event: "leave", success: true, data: { isActive: false } });
            activeUsers.delete(data.data.user_id ? data.data.user_id : socket.userObj._id);
            pubClient.lRem('activeUsers', '0', data.user_id);
            console.log('activeUsers  after disconnect', activeUsers);
            socket.leave(data.data.user_id ? data.data.user_id : socket.userObj._id);
            socket.leave(socket.id);
        });

        socket.on('disconnect', function () {
            console.log("disconnect : ", socket.userObj);
            if (socket.userObj) {
                pubClient.lRem('activeUsers', '0', socket.userObj._id);
                activeUsers.delete(socket.userObj._id);
            }
            console.log("active Users", activeUsers);
        });

    });
}
