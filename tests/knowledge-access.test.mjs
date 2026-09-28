import test from 'node:test';
import assert from 'node:assert/strict';
import { localKnowledgeReadAllowed } from '../src/lib/sources/local-access.ts';

test('knowledge access allows local production launcher reads, never deployed or cross-origin access', () => {
  const keys = ['NODE_ENV', 'VERCEL', 'NEXT_PUBLIC_ZMT_AUTH_REQUIRED', 'ZMT_LOCAL_CAPTURE_ENABLED'];
  const previous = Object.fromEntries(keys.map(key => [key, process.env[key]]));
  const req = (pathname = '/api/kb', method = 'GET', headers = {}) => ({
    // Next may normalize the request URL while keeping the browser's Host.
    url: `http://localhost:3002${pathname}`, method,
    headers: new Headers({ host: '127.0.0.1:3002', 'sec-fetch-site': 'same-origin', ...headers }),
  });
  try {
    delete process.env.VERCEL;
    delete process.env.NEXT_PUBLIC_ZMT_AUTH_REQUIRED;
    delete process.env.ZMT_LOCAL_CAPTURE_ENABLED;
    process.env.NODE_ENV = 'production';
    assert.equal(localKnowledgeReadAllowed(req()), false);
    process.env.ZMT_LOCAL_CAPTURE_ENABLED = 'true';
    for (const route of ['/knowledge', '/api/kb', '/api/kb/doc?id=example']) {
      assert.equal(localKnowledgeReadAllowed(req(route)), true);
    }
    assert.equal(localKnowledgeReadAllowed(req('/api/kb', 'GET', { origin: 'http://127.0.0.1:3002', 'x-forwarded-host': '127.0.0.1:3002', 'x-forwarded-proto': 'http' })), true);
    assert.equal(localKnowledgeReadAllowed(req('/api/kb', 'GET', { 'sec-fetch-site': 'none' })), true);
    assert.equal(localKnowledgeReadAllowed(req('/api/kb', 'GET', { origin: 'https://attacker.test' })), false);
    assert.equal(localKnowledgeReadAllowed(req('/api/kb', 'GET', { 'sec-fetch-site': 'cross-site' })), false);
    assert.equal(localKnowledgeReadAllowed(req('/api/kb', 'GET', { 'sec-fetch-site': 'same-site' })), false);
    assert.equal(localKnowledgeReadAllowed(req('/api/kb', 'GET', { host: 'attacker.test', 'x-forwarded-host': '127.0.0.1:3002' })), false);
    assert.equal(localKnowledgeReadAllowed(req('/api/kb', 'GET', { 'x-forwarded-host': 'public.example' })), false);
    assert.equal(localKnowledgeReadAllowed(req('/api/kb', 'GET', { 'x-forwarded-proto': 'https' })), false);
    assert.equal(localKnowledgeReadAllowed(req('/api/kb', 'GET', { host: 'localhost:3003' })), false);
    assert.equal(localKnowledgeReadAllowed(req('/api/kb', 'POST')), false);
    assert.equal(localKnowledgeReadAllowed(req('/api/kb/write')), false);
    assert.equal(localKnowledgeReadAllowed(req('/api/assistant')), false);
    process.env.NEXT_PUBLIC_ZMT_AUTH_REQUIRED = 'true';
    assert.equal(localKnowledgeReadAllowed(req()), false);
    delete process.env.NEXT_PUBLIC_ZMT_AUTH_REQUIRED;
    process.env.VERCEL = '1';
    assert.equal(localKnowledgeReadAllowed(req()), false);
    delete process.env.VERCEL;
    delete process.env.ZMT_LOCAL_CAPTURE_ENABLED;
    process.env.NODE_ENV = 'development';
    assert.equal(localKnowledgeReadAllowed(req()), true);
  } finally {
    for (const key of keys) {
      if (previous[key] === undefined) delete process.env[key]; else process.env[key] = previous[key];
    }
  }
});
