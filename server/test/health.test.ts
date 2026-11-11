import test from 'node:test';
import assert from 'node:assert/strict';
import { buildApp } from '../src/app.js';
import { loadConfig } from '../src/config.js';

test('health endpoint returns a liveness response', async () => {
  const app = buildApp(loadConfig({ NODE_ENV: 'test', LOG_LEVEL: 'silent' }));
  try {
    const response = await app.inject({ method: 'GET', url: '/health' });
    assert.equal(response.statusCode, 200);
    assert.equal(response.json().status, 'ok');
    assert.equal(response.json().service, '@isyen/server');
    assert.equal(typeof response.json().timestamp, 'string');
  } finally {
    await app.close();
  }
});
