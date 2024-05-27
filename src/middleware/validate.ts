import { ValidationChain, validationResult } from "express-validator";
import { logger } from "../utils/helpers/logger";

export let validate = (validationArray: any) => {
  return [
    ...validationArray,
    (req: any, res: any, next: any) => {
      const errors = validationResult(req).array();
      if (errors.length > 0) {
        return res.status(400).json({ errors: errors[0] });
      }
      next();
    },
  ];
};

export default validate;
