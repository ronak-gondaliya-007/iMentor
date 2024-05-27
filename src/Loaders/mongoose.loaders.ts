import mongoose, { mongo, set } from "mongoose";
import config from "../utils/config";
import { logger } from "../utils/helpers/logger";

export default async function () {
  return new Promise((resolver: any, reject: any) => {
    mongoose
      .connect(config.Mongodb.url + config.Mongodb.dbName)
      .then(() => {
        // set('debug', true)
        resolver("DataBase Connected ... And Db Name Is " + config.Mongodb.dbName);
      })
      .catch((error) => {
        logger.error("Error While Connecting In Mongodb", error);
        reject();
      });
  });
}
