/**
 * Smoke verify：S-1 CursorSdkAdapter / S-3 summarizeToolArgs 落地是否生效
 *
 * 用法：
 *   tsx packages/server/scripts/verify-sdk-adapter.ts
 *   SLARK_CURSOR_BACKEND=sdk tsx packages/server/scripts/verify-sdk-adapter.ts
 *
 * 这个脚本不依赖 SQLite，只验证：
 *   1. createCursorAdapter() 在不同 SLARK_CURSOR_BACKEND 下选对 adapter
 *   2. CursorSdkAdapter.checkInstallation() 在缺 CURSOR_API_KEY 时优雅返回 false
 *   3. summarizeToolArgs() 给典型工具 args 输出可读摘要
 */

import { createCursorAdapter } from '../src/agents/adapter-factory.js';
import { CursorSdkAdapter } from '../src/agents/cursor-sdk-adapter.js';
import { CursorAdapter } from '../src/agents/cursor-adapter.js';
import { summarizeToolArgs } from '../src/agents/summarize-tool-args.js';

let failed = 0;
function expect(cond: boolean, msg: string) {
  if (cond) {
    console.log(`  ✓ ${msg}`);
  } else {
    console.log(`  ✗ ${msg}`);
    failed += 1;
  }
}

console.log('1. adapter-factory 选择');
{
  const orig = process.env.SLARK_CURSOR_BACKEND;

  delete process.env.SLARK_CURSOR_BACKEND;
  const def = createCursorAdapter();
  expect(def instanceof CursorAdapter, '默认 → CursorAdapter');
  expect(def.name === 'cursor', '默认 name === cursor');

  process.env.SLARK_CURSOR_BACKEND = 'cli';
  const cli = createCursorAdapter();
  expect(cli instanceof CursorAdapter, 'SLARK_CURSOR_BACKEND=cli → CursorAdapter');

  process.env.SLARK_CURSOR_BACKEND = 'sdk';
  const sdk = createCursorAdapter();
  expect(sdk instanceof CursorSdkAdapter, 'SLARK_CURSOR_BACKEND=sdk → CursorSdkAdapter');
  expect(sdk.name === 'cursor-sdk', 'SDK adapter name === cursor-sdk');
  expect(typeof sdk.runDirect === 'function', 'SDK adapter 实现 runDirect');
  expect(typeof (cli as { runDirect?: unknown }).runDirect === 'undefined', 'CLI adapter 不实现 runDirect');

  if (orig === undefined) delete process.env.SLARK_CURSOR_BACKEND;
  else process.env.SLARK_CURSOR_BACKEND = orig;
}

console.log('\n2. CursorSdkAdapter checkInstallation 不崩溃');
{
  const sdkAdapter = new CursorSdkAdapter();
  const orig = process.env.CURSOR_API_KEY;
  delete process.env.CURSOR_API_KEY;
  const noKey = await sdkAdapter.checkInstallation();
  expect(noKey.installed === false, '无 CURSOR_API_KEY → installed=false');
  expect(typeof noKey.error === 'string' && noKey.error.length > 0, '提供 error 信息');
  if (orig !== undefined) process.env.CURSOR_API_KEY = orig;
}

console.log('\n3. summarizeToolArgs 摘要质量');
{
  const r1 = summarizeToolArgs('shell', { command: 'ls -la /tmp', cwd: '/home/user' });
  expect(r1 === 'ls -la /tmp (cwd=/home/user)', `shell: "${r1}"`);

  const r2 = summarizeToolArgs('read', { path: 'src/auth/oauth.ts', offset: 10, limit: 50 });
  expect(r2 === 'src/auth/oauth.ts (offset=10, limit=50)', `read: "${r2}"`);

  const r3 = summarizeToolArgs('edit', { target_file: 'README.md', instruction: 'Fix typo' });
  expect(r3 === 'README.md — Fix typo', `edit: "${r3}"`);

  const r4 = summarizeToolArgs('grep', { pattern: 'TODO', path: 'src/' });
  expect(r4.includes('TODO') && r4.includes('src/'), `grep: "${r4}"`);

  const r5 = summarizeToolArgs('write', { filePath: 'output.json', contents: '{...}' });
  expect(r5.includes('output.json'), `write: "${r5}"`);

  const r6 = summarizeToolArgs('unknown_tool', { foo: 'bar' });
  expect(r6.includes('foo') && r6.includes('bar'), `unknown 默认 JSON: "${r6}"`);

  const r7 = summarizeToolArgs('read', undefined);
  expect(r7 === '', '空 args 返回空字符串');

  const long = 'a'.repeat(500);
  const r8 = summarizeToolArgs('shell', { command: long });
  expect(r8.length <= 200, `长摘要被截断到 ≤200: ${r8.length}`);
}

console.log(`\n${failed === 0 ? '✓ all checks passed' : `✗ ${failed} check(s) failed`}`);
process.exit(failed === 0 ? 0 : 1);
