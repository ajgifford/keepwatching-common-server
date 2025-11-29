import { requestContext } from '../context/requestContext';
import { AccountAndProfileIdsParams } from '../schema';
import { NextFunction, Request, Response } from 'express';
import { v4 as uuid } from 'uuid';

export function logRequestContext(req: Request, res: Response, next: NextFunction) {
  try {
    const { accountId, profileId } = req.params as unknown as AccountAndProfileIdsParams;
    const context = {
      requestId: uuid(),
      endpoint: `${req.method} ${req.url}`,
      accountId,
      profileId,
    };

    requestContext.run(context, () => {
      next();
    });
  } catch (error) {
    console.error('Error in logRequestContext:', error);
    next();
  }
}
