import assert from 'node:assert/strict';
import test from 'node:test';
import { shouldRemoveQueuedAnswerAfterResponse } from '../src/services/sync-engine-policy.js';

test('sync-engine keeps queued answers on authorization, conflict, rate limit, server, and network-like failures', () => {
  for (const status of [401, 403, 409, 429, 500, 503, 0]) {
    assert.equal(shouldRemoveQueuedAnswerAfterResponse(status), false, `status ${status} must stay queued`);
  }
});

test('sync-engine removes queued answers only after backend success', () => {
  for (const status of [200, 201, 202, 204]) {
    assert.equal(shouldRemoveQueuedAnswerAfterResponse(status), true, `status ${status} may be removed`);
  }
});
