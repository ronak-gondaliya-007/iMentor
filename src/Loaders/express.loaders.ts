import express, { response } from "express";
import cors from "cors";
import { logger } from "../utils/helpers/logger";
import { serverAdapter } from "../Bull/Queues/index";
import webRoutes from "../Routes/Web";
import routes from "../Routes";
import { auditLog } from "../middleware/audit_log";

export default async function (app: any) {

  app.use(express.json({ limit: "50mb", type: ["application/json", "text/plain"] }));

  app.use(cors());

  app.use('/export', express.static('download'));

  app.use(express.urlencoded({ extended: true }));

  app.use((req: any, res: any, next: any) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
    next();
  });

  app.use((req: any, res: any, next: any) => {
    logger.info(`New Request Method: ${req.method} And Fired On: ${req.path}`);
    next();
  });

  app.use((req: any, res: any, next: any) => {
    let responseData = '';
    const originalSend = res.json;
    res.json = function (data: any) {
      responseData += data;
      console.log('API Log:', JSON.stringify({ "Request API": `${req.method} : ${req.path}`, "Response Status": res.statusCode, "Response Body": data?.data }));
      originalSend.apply(res, arguments);
      // Check if data.isAuditLog is true or undefined (truthy)
      if (data && data.data.isAuditLog) {
        // Assuming auditLog is a synchronous function
        auditLog(req, data);
      }
    };
    next();
  });


  app.use("/Health", async (req: any, res: any, next: any) => {
    res.send({
      date: new Date(),
      Message: "Health 100% ...",
    });
  });

  app.use("/admin/bull", serverAdapter.getRouter());

  /* CMS routes */
  app.use("/api", routes);

  /* Web routes */
  app.use("/api/web", webRoutes);
  

  process.on('unhandledRejection', (err: any) => {
    logger.error('unhandledRejection', err);
  });

  process.on('unhandledRejection', (err: any) => {
    logger.error('unhandledRejection', err);
  });

  process.on('unhandledRejection', (err: any) => {
    logger.error('unhandledRejection', err);
  });

}
