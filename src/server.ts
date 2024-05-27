import express from "express";
import config from "./utils/config";
import expressLoaders from "./Loaders/express.loaders";
import mongooseLoaders from "./Loaders/mongoose.loaders";
import socketLoaders from "./Loaders/socket.loaders";
import fs from "fs";
import http from "http";
import https from "https";
import { logger } from "./utils/helpers/logger";
let app = express();

//Granting express Loaders to App
expressLoaders(app);

const configServer = {
  SSL: {
    key: config.SSL.key,
    cert: config.SSL.cert
  },
  server: {
    env: config.server.env
  },
};

let server: http.Server | https.Server;

try {
  const key = fs.readFileSync(configServer.SSL.key);
  const cert = fs.readFileSync(configServer.SSL.cert);

  // If the certificate and key are successfully read, create an HTTPS server
  server = https.createServer({ key, cert }, app);
} catch (err: any) {
  // If an error occurs, create an HTTP server
  server = http.createServer(app);
}
socketLoaders(server)

//while entire promise is resolve then server will started
Promise.all([mongooseLoaders()])
  .then((msg) => {
    logger.info(String(msg));
    server.listen(config.server.port, () => {
      logger.info(`Server Started on http://localhost:${config.server.port}`);
    });
  })
  .catch((err) => {
    console.log("error ::::::::: ", err);
  });
