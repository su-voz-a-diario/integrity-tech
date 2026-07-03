import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';

function loadApiClientModule() {
  const source = readFileSync(new URL('../src/services/api-client.ts', import.meta.url), 'utf8');
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2021,
      esModuleInterop: true,
    },
  });

  const module = { exports: {} };
  const sandbox = {
    module,
    exports: module.exports,
    require: () => ({}),
    process,
    Headers,
    FormData,
    fetch: async () => {
      throw new Error('fetch should not run in this test');
    },
  };
  vm.runInNewContext(outputText, sandbox, { filename: 'api-client.ts' });
  return module.exports;
}

test('ApiClientError maps expected backend error statuses', () => {
  const { ApiClientError } = loadApiClientModule();

  const cases = [
    [401, 'isAuthError'],
    [403, 'isForbidden'],
    [409, 'isConflict'],
    [429, 'isRateLimited'],
    [503, 'isServerError'],
  ];

  for (const [status, property] of cases) {
    const error = ApiClientError.fromPayload(status, {
      message: `status-${status}`,
      requestId: 'req-test',
      traceId: 'trace-test',
      error: 'TestError',
    });

    assert.equal(error.status, status);
    assert.equal(error[property], true);
    assert.equal(error.requestId, 'req-test');
    assert.equal(error.traceId, 'trace-test');
    assert.equal(error.message, `status-${status}`);
  }
});
