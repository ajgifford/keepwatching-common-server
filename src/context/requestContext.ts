import { AsyncLocalStorage } from 'node:async_hooks';

export interface RequestContext {
  accountId?: number;
  profileId?: number;
  requestId?: string;
  endpoint?: string;
}

export const requestContext = new AsyncLocalStorage<RequestContext>();
