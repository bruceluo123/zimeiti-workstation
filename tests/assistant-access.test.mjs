import test from 'node:test';
import assert from 'node:assert/strict';
import { localAssistantAllowed } from '../src/lib/sources/local-access.ts';

test('local Codex bridge rejects foreign hosts, missing fetch metadata, cross-site, originless mutations and Vercel', () => {
  const previous = { capture: process.env.ZMT_LOCAL_CAPTURE_ENABLED, vercel: process.env.VERCEL };
  process.env.ZMT_LOCAL_CAPTURE_ENABLED = 'true'; delete process.env.VERCEL;
  const req = (method, extra = {}) => ({ url: 'http://127.0.0.1:3002/api/assistant', method, headers: new Headers({ host: '127.0.0.1:3002', 'sec-fetch-site': 'same-origin', ...extra }) });
  try {
    assert.equal(localAssistantAllowed(req('GET')), true);
    assert.equal(localAssistantAllowed(req('POST')), false);
    assert.equal(localAssistantAllowed(req('POST', { origin: 'http://127.0.0.1:3002' })), true);
    assert.equal(localAssistantAllowed(req('GET', { host: 'attacker.example' })), false);
    assert.equal(localAssistantAllowed(req('GET', { 'sec-fetch-site': 'none' })), false);
    assert.equal(localAssistantAllowed(req('GET', { 'sec-fetch-site': 'cross-site' })), false);
    assert.equal(localAssistantAllowed(req('POST', { origin: 'http://localhost:3002' })), false);
    process.env.VERCEL = '1'; assert.equal(localAssistantAllowed(req('GET')), false);
  } finally {
    if (previous.capture === undefined) delete process.env.ZMT_LOCAL_CAPTURE_ENABLED; else process.env.ZMT_LOCAL_CAPTURE_ENABLED = previous.capture;
    if (previous.vercel === undefined) delete process.env.VERCEL; else process.env.VERCEL = previous.vercel;
  }
});
