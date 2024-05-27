import { NextFunction, Response, Request } from 'express';
import { requestUser } from "../Interfaces/schemaInterfaces/user";
import {
  errorMessage,
  statusCode
} from "../utils/const";
import { error } from "../utils/helpers/resSender";

function hasRole(allowedRoles: string[], allowedPermission?: string) {
  const roleMiddleware = async (
    request: Request,
    response: Response,
    next: NextFunction
  ) => {
    try {
      const req = request as requestUser;
      const user = req.user;

      if (allowedRoles.includes(user.role)) {
        next();
      } else {
        const errorMsg = errorMessage.NOT_ACCESS;
        response.status(statusCode.UNAUTHORIZED).send(error(errorMsg, {}, statusCode.UNAUTHORIZED));
      }
    } catch (error) {
      next(error);
    }
  };

  return roleMiddleware;
}

export default hasRole;
