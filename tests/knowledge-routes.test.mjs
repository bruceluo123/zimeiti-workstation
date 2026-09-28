import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile, rename, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import ts from 'typescript';

const asModule = source => 'data:text/javascript;base64,' + Buffer.from(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText).toString('base64');

test('knowledge routes enforce owner access and reread local production files without touching the real wiki', async () => {
  const temporaryRoot = await mkdtemp(path.join(os.tmpdir(), 'zmt-kb-test-'));
  const wiki = path.join(temporaryRoot, 'wiki');
  const keys = ['ZMT_WIKI_ROOT', 'NODE_ENV', 'VERCEL', 'NEXT_PUBLIC_ZMT_AUTH_REQUIRED', 'ZMT_LOCAL_CAPTURE_ENABLED', 'ZMT_OWNER_EMAIL'];
  const previous = Object.fromEntries(keys.map(key => [key, process.env[key]]));
  const stateKey = '__knowledgeRouteTest';
  const state = { configured: false, data: null, error: null, throwAuth: false };
  globalThis[stateKey] = state;
  try {
    process.env.ZMT_WIKI_ROOT = wiki;
    process.env.NODE_ENV = 'production';
    process.env.ZMT_LOCAL_CAPTURE_ENABLED = 'true';
    delete process.env.VERCEL;
    delete process.env.NEXT_PUBLIC_ZMT_AUTH_REQUIRED;
    process.env.ZMT_OWNER_EMAIL = 'owner@example.test';
    const next = asModule('export const NextResponse = { json: (body, init) => Response.json(body, init) };');
    const config = asModule(`export const isSupabaseConfigured = () => globalThis.${stateKey}.configured;`);
    const server = asModule(`export const createServerSupabase = () => ({ auth: { getClaims: async () => { if (globalThis.${stateKey}.throwAuth) throw Error('offline'); return globalThis.${stateKey}; } } });`);
    const localAccess = new URL('../src/lib/sources/local-access.ts', import.meta.url).href;
    const access = asModule((await readFile(new URL('../src/lib/knowledge-access.ts', import.meta.url), 'utf8'))
      .replaceAll('"next/server"', JSON.stringify(next))
      .replaceAll('"@/lib/sources/local-access"', JSON.stringify(localAccess))
      .replaceAll('"@/lib/supabase/config"', JSON.stringify(config))
      .replaceAll('"@/lib/supabase/server"', JSON.stringify(server)));
    const kb = new URL('../src/lib/kb.ts', import.meta.url).href;
    async function route(relativePath) {
      return import(asModule((await readFile(new URL(relativePath, import.meta.url), 'utf8'))
        .replaceAll('"next/server"', JSON.stringify(next))
        .replaceAll('"@/lib/kb"', JSON.stringify(kb))
        .replaceAll('"@/lib/knowledge-access"', JSON.stringify(access))));
    }
    const index = await route('../src/app/api/kb/route.ts');
    const detail = await route('../src/app/api/kb/doc/route.ts');
    const req = (route, host = '127.0.0.1:3002') => ({ url: `http://localhost:3002${route}`, nextUrl: new URL(`http://localhost:3002${route}`), method: 'GET', headers: new Headers({ host, 'sec-fetch-site': 'same-origin' }) });

    for (const [handler, route] of [[index, '/api/kb'], [detail, '/api/kb/doc?id=sample']]) {
      assert.equal((await handler.GET(req(route, 'public.example'))).status, 401, 'missing auth configuration must fail closed');
      state.configured = true;
      assert.equal((await handler.GET(req(route, 'public.example'))).status, 401);
      state.data = { claims: { sub: 'user', email: 'other@example.test' } };
      assert.equal((await handler.GET(req(route, 'public.example'))).status, 403);
      state.data = null;
      state.throwAuth = true;
      assert.equal((await handler.GET(req(route, 'public.example'))).status, 503);
      state.throwAuth = false;
      state.configured = false;
    }

    assert.equal((await index.GET(req('/api/kb'))).status, 503, 'missing directory is an actionable failure');
    await mkdir(wiki);
    let response = await index.GET(req('/api/kb'));
    assert.equal(response.status, 200);
    assert.equal((await response.json()).stats.total, 0, 'empty directory is a successful empty result');
    assert.equal(response.headers.get('cache-control'), 'private, no-store');
    assert.equal((await detail.GET(req('/api/kb/doc'))).status, 400);
    assert.equal((await detail.GET(req('/api/kb/doc?id=sample'))).status, 404);

    await mkdir(path.join(wiki, '知识枢纽'));
    const document = path.join(wiki, '知识枢纽', 'sample.md');
    await writeFile(document, '---\ntitle: 样例\nupdated: 2026-09-27\n---\n# 样例\n第一段资料。\n');
    response = await index.GET(req('/api/kb'));
    assert.equal((await response.json()).stats.total, 1, 'retry discovers files added after an empty result');
    response = await detail.GET(req('/api/kb/doc?id=sample'));
    const doc = await response.json();
    assert.equal(response.status, 200);
    assert.equal(typeof doc.updated, 'string', 'YAML dates must be renderable');
    assert.equal(doc.updated, '2026-09-27');
    assert.equal(doc.title, '样例');
    await writeFile(document, '---\ntitle: 修改后\n---\n# 更新\n新内容。\n');
    assert.equal((await (await detail.GET(req('/api/kb/doc?id=sample'))).json()).title, '修改后', 'local production must reread changed documents');

    state.configured = true;
    state.data = { claims: { sub: 'owner', email: 'OWNER@example.test' } };
    assert.equal((await index.GET(req('/api/kb', 'public.example'))).status, 200, 'authenticated owner retains access');
    process.env.VERCEL = '1';
    state.data = null;
    assert.equal((await index.GET(req('/api/kb'))).status, 401, 'Vercel cannot use the local bypass');
    delete process.env.VERCEL;
    await rename(wiki, path.join(temporaryRoot, 'moved-wiki'));
    assert.equal((await index.GET(req('/api/kb'))).status, 503, 'retry detects a moved directory despite an earlier cache');
    assert.equal((await detail.GET(req('/api/kb/doc?id=sample'))).status, 503);
  } finally {
    delete globalThis[stateKey];
    for (const key of keys) {
      if (previous[key] === undefined) delete process.env[key]; else process.env[key] = previous[key];
    }
    // Only the uniquely created temporary fixture directory is removed.
    assert.equal(path.dirname(temporaryRoot), path.resolve(os.tmpdir()));
    assert.ok(path.basename(temporaryRoot).startsWith('zmt-kb-test-'));
    await rm(temporaryRoot, { recursive: true, force: true });
  }
});
