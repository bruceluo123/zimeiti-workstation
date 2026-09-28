import assert from 'node:assert/strict';
import { test } from 'node:test';
import { localCaptureAllowed, localDevelopmentApiAllowed } from '../src/lib/sources/local-access.ts';

test('local paid capture is opt-in and never allowed on deployed Vercel', () => {
  const old = process.env.ZMT_LOCAL_CAPTURE_ENABLED;
  const vercel = process.env.VERCEL;
  try {
    delete process.env.VERCEL; delete process.env.ZMT_LOCAL_CAPTURE_ENABLED;
    const request = { url: 'http://localhost:3002/api/sources/library', headers: new Headers({ host: 'localhost:3002', origin: 'http://localhost:3002' }) };
    assert.equal(localCaptureAllowed(request), false);
    process.env.ZMT_LOCAL_CAPTURE_ENABLED = 'true'; assert.equal(localCaptureAllowed(request), true);
    request.headers.set('host', '127.0.0.1:3002');
    request.headers.set('origin', 'http://127.0.0.1:3002');
    assert.equal(localCaptureAllowed(request), true, 'Next normalized URL must not reject the browser loopback origin');
    request.headers.set('sec-fetch-site', 'cross-site'); assert.equal(localCaptureAllowed(request), false);
    request.headers.delete('sec-fetch-site');
    request.headers.set('host', 'localhost:3002');
    request.headers.set('origin', 'https://attacker.test'); assert.equal(localCaptureAllowed(request), false);
    request.headers.set('origin', 'http://localhost:3002'); process.env.VERCEL = '1'; assert.equal(localCaptureAllowed(request), false);
  } finally {
    if (old === undefined) delete process.env.ZMT_LOCAL_CAPTURE_ENABLED; else process.env.ZMT_LOCAL_CAPTURE_ENABLED = old;
    if (vercel === undefined) delete process.env.VERCEL; else process.env.VERCEL = vercel;
  }
});

test('paid development API is login-free only for same-origin loopback UI', () => {
  const auth = process.env.NEXT_PUBLIC_ZMT_AUTH_REQUIRED;
  const vercel = process.env.VERCEL;
  try {
    delete process.env.VERCEL; delete process.env.NEXT_PUBLIC_ZMT_AUTH_REQUIRED;
    const request = { url: 'http://localhost:3002/api/factory/image', headers: new Headers({ host: 'localhost:3002', origin: 'http://localhost:3002', 'sec-fetch-site': 'same-origin' }) };
    assert.equal(localDevelopmentApiAllowed(request), true);
    request.headers.set('origin', 'https://attacker.test'); assert.equal(localDevelopmentApiAllowed(request), false);
    request.headers.set('origin', 'http://localhost:3002'); request.headers.set('sec-fetch-site', 'cross-site'); assert.equal(localDevelopmentApiAllowed(request), false);
    request.headers.set('sec-fetch-site', 'same-origin'); process.env.NEXT_PUBLIC_ZMT_AUTH_REQUIRED = 'true'; assert.equal(localDevelopmentApiAllowed(request), false);
    delete process.env.NEXT_PUBLIC_ZMT_AUTH_REQUIRED; process.env.VERCEL = '1'; assert.equal(localDevelopmentApiAllowed(request), false);
  } finally {
    if (auth === undefined) delete process.env.NEXT_PUBLIC_ZMT_AUTH_REQUIRED; else process.env.NEXT_PUBLIC_ZMT_AUTH_REQUIRED = auth;
    if (vercel === undefined) delete process.env.VERCEL; else process.env.VERCEL = vercel;
  }
});
