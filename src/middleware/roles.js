import { sendError } from '../utils/send.js';


export const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return sendError(res, 401, 'Not authorized');
    }
    
    if (!roles.includes(req.user.role)) {
      return sendError(res, 403, `Role ${req.user.role} is not authorized to access this resource`);
    }
    
    next();
  };
};


export const isAdmin = authorize('admin');
export const isManagerOrAdmin = authorize('manager', 'admin');
export const isAgentOrAbove = authorize('agent', 'manager', 'admin');