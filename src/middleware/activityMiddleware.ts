import { accountService } from '../services/accountService';
import { NextFunction, Request, Response } from 'express';

/**
 * Middleware to track user activity
 *
 * This middleware extracts the accountId from request parameters and asynchronously
 * updates the last_activity timestamp. It uses a fire-and-forget pattern to avoid
 * blocking the request/response flow.
 *
 * The middleware will:
 * - Extract accountId from req.params.accountId
 * - Call accountService.trackActivity() without awaiting
 * - Immediately call next() to continue request processing
 * - Silently skip if accountId is not present in params
 *
 * @param req - Express request object
 * @param res - Express response object
 * @param next - Express next function
 */
export const trackUserActivity = (req: Request, res: Response, next: NextFunction): void => {
  const accountId = req.params.accountId;

  if (accountId) {
    const accountIdNum = parseInt(accountId, 10);

    if (!isNaN(accountIdNum)) {
      // Fire and forget - don't await, don't block the request
      accountService.trackActivity(accountIdNum).catch(() => {
        // Errors are already logged in the service, no need to handle here
      });
    }
  }

  // Continue immediately without waiting for activity tracking
  next();
};
