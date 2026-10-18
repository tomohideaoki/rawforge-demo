#!/usr/bin/env node
'use strict';
const { spawnSync } = require('node:child_process');
const { readdirSync, readFileSync, appendFileSync } = require('node:fs');
const { resolve, join } = require('node:path');

// Runs local regression tests only. No AI, dependency install, or network client.
const root = resolve(__dirname, '..');
const files = readdirSync(join(root, 'tests')).filter(n => n.endsWith('.test.cjs')).sort();
if (!files.length) { console.error('No regression tests found'); process.exit(1); }
// Do not pass runner tokens or repository secrets to test subprocesses.
const env = Object.fromEntries(['PATH', 'LANG', 'TZ', 'SYSTEMROOT', 'TEMP', 'TMP']
  .filter(k => process.env[k] !== undefined).map(k => [k, process.env[k]]));
const result = spawnSync(process.execPath, ['--test', '--test-reporter=tap',
  ...files.map(n => join(root, 'tests', n))], {
  cwd: root, env, encoding: 'utf8', timeout: 90000, maxBuffer: 1024 * 1024
});
const output = (result.stdout || '') + (result.stderr || '');
process.stdout.write(output);
const failed = result.error || result.status !== 0;
const failures = [...output.matchAll(/^not ok \d+ - (.+)$/gm)].map(m => m[1]);
const clean = s => s.replace(/[\r\n`<>]/g, ' ').slice(0, 180);
const html = readFileSync(join(root, 'index.html'), 'utf8');
const observations = [];
if (html.includes('AIに渡す文章をコピー')) observations.push('翻訳ボタンは文章コピー方式。サイト内で翻訳が完結する構成は未実装。');
if (html.includes('英語が苦手な保護者のための')) observations.push('トップの対象表現に旧文言が残存。希望表現「英語が分からない日本人保護者」への変更は別途必要。');
const report = [
  '## Global Parents 自動検証',
  '',
  `- テスト結果: ${failed ? 'FAIL' : 'PASS'}`,
  `- テストファイル数: ${files.length}`,
  `- 成功数: ${(output.match(/^# pass (\d+)$/m) || [])[1] || '不明'}`,
  `- 失敗数: ${(output.match(/^# fail (\d+)$/m) || [])[1] || '不明'}`,
  ...(result.error ? ['- テスト実行エラーまたは90秒制限。ログを確認。'] : []),
  ...failures.map(n => `- 失敗箇所: ${clean(n)}`),
  '', '### コードから確認した未完了項目', '',
  ...(observations.length ? observations.map(n => `- ${n}`) : ['- この検査の固定条件には該当なし。機能完成の判定ではありません。']),
  '',
  'テスト成功は、公開API・実ブラウザ・課金・収益化の動作保証ではありません。',
  'この処理はAI呼び出し、公開、push、PR作成、artifact保存を行いません。', ''
].join('\n');
console.log(report);
if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, report);
process.exitCode = failed ? 1 : 0;
