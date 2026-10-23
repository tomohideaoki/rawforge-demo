'use strict';
/** Generate an offline human-review CSV from the canonical 12-case table.
 * No model calls and no automatic pass/fail judgment on translation quality.
 */
const { readFileSync } = require('node:fs');
function parseCases(markdown) {
  const result = [];
  for (const line of markdown.split(/\r?\n/)) {
    const match = line.match(/^\|\s*(Q\d{2})\s*\|\s*(.*?)\s*\|\s*(.*?)\s*\|\s*(.*?)\s*\|\s*$/);
    if (!match) continue;
    result.push({ id: match[1], input: match[2], reference: match[3], mustReview: match[4] });
  }
  if (result.length !== 12 || new Set(result.map(x => x.id)).size !== 12 ||
      result.some(x => !x.input || !x.reference || !x.mustReview)) {
    throw Error('Expected 12 unique, complete cases in the canonical document');
  }
  return result;
}
function csv(cases) {
  const columns = ['case_id', 'japanese_input', 'reference_or_expected', 'critical_failure_criteria',
    'observed_output', 'manual_judgment_PASS_FAIL', 'review_notes', 'model_or_environment', 'review_date'];
  const escape = value => '"' + String(value).replace(/"/g, '""') + '"';
  return [columns.map(escape).join(','), ...cases.map(x => [x.id, x.input, x.reference, x.mustReview,
    '', '', '', '', ''].map(escape).join(','))].join('\n') + '\n';
}
if (require.main === module) {
  const path = process.argv[2];
  if (!path) { console.error('Usage: node quality-review-sheet.cjs <portable-workflow-v0.1.md>'); process.exit(2); }
  try { process.stdout.write(csv(parseCases(readFileSync(path, 'utf8')))); }
  catch (e) { console.error(e.message); process.exit(1); }
}
module.exports = { parseCases, csv };
