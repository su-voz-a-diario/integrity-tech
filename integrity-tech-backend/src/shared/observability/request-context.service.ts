import { Injectable } from '@nestjs/common';
import { AsyncLocalStorage } from 'async_hooks';

export type RequestContext = {
  traceId: string;
  requestId: string;
  organizationId?: string | null;
  userId?: string | null;
  method?: string;
  path?: string;
};

@Injectable()
export class RequestContextService {
  private readonly storage = new AsyncLocalStorage<RequestContext>();

  run<T>(context: RequestContext, callback: () => T): T {
    return this.storage.run(context, callback);
  }

  get(): RequestContext | undefined {
    return this.storage.getStore();
  }

  getTraceId(): string | undefined {
    return this.get()?.traceId;
  }

  getRequestId(): string | undefined {
    return this.get()?.requestId;
  }

  merge(values: Partial<RequestContext>) {
    const current = this.get();
    if (!current) return;
    Object.assign(current, values);
  }
}
