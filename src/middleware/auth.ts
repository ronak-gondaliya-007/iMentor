import jwt from "jsonwebtoken";
import { error } from "../utils/helpers/resSender";
import config from "../utils/config";
import { findOne, updateMany } from "../utils/db";
import _ from "underscore"
import { statusCode } from "../utils/const";

export let auth = async function (req: any, res: any, next: any) {
  try {
    let token = req.headers["x-auth-token"];

    if (!token) return res.send(error("Access denied. Token not found"));

    let payLoad: any = jwt.verify(token, config.PRIVATE_KEY);
    const iat = Math.floor(new Date().getTime() / 1000);

    if (payLoad.exp && payLoad.exp < iat) {
      res.status(401).send(error("Token Expired", {}, 401))
      return
    }

    let sessionObj = await findOne({ collection: 'Session', query: { 'account.email': payLoad?.email?.toLowerCase() || "" } })
    let userObj = await findOne({ collection: 'User', query: { email: payLoad?.email?.toLowerCase(), isDel: false } })

    if (!userObj) {
      res.status(401).send(error("User not available.", {}, 401))
      return false
    }

    if (!payLoad && sessionObj) {
      if (sessionObj) {
        await updateMany({
          collection: 'Session',
          query: { 'account.token': token },
          update: {
            $set: {
              'account.$[i].token': null
            }
          },
          options: {
            'arrayFilters': [{ 'i.token': token }], new: true
          }
        })
      }
      res.status(401).send(error("Token Expired", {}, 401))
      return false
    };


    if (userObj) {
      userObj = _.pick(userObj, 'legalFname', 'legalLname', 'preferredFname', 'preferredLname', 'role', 'email', 'profilePic', "_id", "region", "partnerAdmin")
    }
    req.user = userObj ? userObj : payLoad;

    next();
  } catch (err) {
    res.status(401).send(error("Something went wrong", err, statusCode.UNAUTHORIZED));
  }
};

export const socketAuthVerification = (token: string, userId: string) => {
  try {

    let payLoad: any = jwt.verify(token, config.PRIVATE_KEY);

    return true

  } catch (err: any) {
    (global as any).io.to(userId).emit("response", { event: "error", message: "unauthorised!", success: false, data: { "event": "connection", message: "Token has been expired." } });
  }
}