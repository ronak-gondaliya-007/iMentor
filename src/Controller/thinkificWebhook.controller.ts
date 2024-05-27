import { findOne, insertOne } from "../utils/db";
import { logger } from "../utils/helpers/logger";
import { error, success } from "../utils/helpers/resSender";
import {
  createWebhook
} from '../services/thinkific/thinkific.service';
import {
  errorMessage,
  statusCode,
  successMessage
} from '../utils/const';

export let ThinkificWebhookController = {
  createWebhook: async (req: any, res: any) => {
    try {
      const { topic, targetUrl } = req.body;

      const isTopicAlreadyExists = await findOne({
        collection: 'ThinkificWebhooks',
        query: { topic: topic },
        project: { _id: 1 }
      });

      if (isTopicAlreadyExists) {
        const errMsg = errorMessage.ALREADY_EXISTS.replace(':attribute', 'topic');
        res.status(statusCode.BAD_REQUEST).send(error(errMsg, {}, statusCode.BAD_REQUEST))
        return
      }

      const createWebhookData = {
        topic,
        targetUrl
      };

      const createWebhookResult = await createWebhook(createWebhookData);
      let createdWebhook: any = {};

      if (createWebhookResult) {
        createdWebhook = await insertOne({
          collection: 'ThinkificWebhooks',
          document: { topic, targetUrl, webhookId: createWebhookResult.id }
        });
      }

      const successMsg = successMessage.CREATE_SUCCESS.replace(":attribute", "Webhook");
      res.send(success(successMsg, createWebhookResult, statusCode.OK));
    } catch (err: any) {
      logger.error("ThinkificWebhookControllor > createWebhook ", err);
      res.status(statusCode.BAD_REQUEST).send(error(err.message, err, statusCode.BAD_REQUEST))
    }
  }
};
