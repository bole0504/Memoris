#!/usr/bin/env node
// Verify a phase, and ONLY if it passes, commit + push.
// Usage: node harness/ship-phase.mjs <phase> "<commit subject>"
import { sh } from './lib.mjs';

const phase = process.argv[2];
const subject = process.argv[3];
if (!phase || !subject) {
  console.error('usage: node harness/ship-phase.mjs <phase> "<commit subject>"');
  process.exit(2);
}

console.log(`\n▶ Verifying Phase ${phase} before shipping…`);
const verify = sh(`node harness/verify-phase.mjs ${phase}`);
process.stdout.write(verify.out);
if (!verify.ok) {
  console.error(`\n⛔ Verify failed — NOT committing. Fix and re-run.`);
  process.exit(1);
}

console.log('\n✅ Verify passed — committing & pushing.');
const status = sh('git status --porcelain');
if (!status.out.trim()) {
  console.log('Nothing to commit. Done.');
  process.exit(0);
}

const body = [
  subject,
  '',
  `Verified by harness: node harness/verify-phase.mjs ${phase} (PASS).`,
  '',
  'Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>',
].join('\n');

sh('git add -A');
const commit = sh(`git commit -F - <<'EOF'\n${body}\nEOF`);
process.stdout.write(commit.out);
if (!commit.ok) {
  console.error('commit failed');
  process.exit(1);
}
const push = sh('git push origin main');
process.stdout.write(push.out);
if (!push.ok) {
  console.error('push failed');
  process.exit(1);
}
console.log('\n🚀 Shipped.');
