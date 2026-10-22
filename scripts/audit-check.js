// CI gate over `npm audit` (see .github/workflows/security-scan.yml). Fails on any high or
// critical advisory, dev dependencies included, unless its GHSA id is in
// .github/audit-allowlist.json - an advisory with no fixed version anywhere (e.g. one reached
// only through webpack-dev-server) can't be cleared by an upgrade, and Dependabot raises
// neither an alert nor a PR for every advisory npm audit reports, so it stays visible here
// rather than in a log nobody reads. Also fails when an allowlisted advisory no longer
// appears at all, so an entry is removed as soon as the fix lands instead of lingering.
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const BLOCKING = new Set(['high', 'critical']);
const allowlistPath = path.join(__dirname, '..', '.github', 'audit-allowlist.json');

const allowlist = JSON.parse(fs.readFileSync(allowlistPath, 'utf8'));
const allowed = new Map(allowlist.map(entry => [entry.id, entry]));

// npm audit exits non-zero whenever it finds anything, so read its JSON rather than its status.
const audit = spawnSync('npm', ['audit', '--json'], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
let report;
try {
  report = JSON.parse(audit.stdout);
} catch {
  console.error('npm audit did not return JSON:\n' + audit.stdout + audit.stderr);
  process.exit(2);
}
if (report.error) {
  console.error('npm audit failed: ' + JSON.stringify(report.error));
  process.exit(2);
}

// A package's `via` holds advisory objects (its own) and strings (packages it depends on);
// only the objects are advisories.
const advisories = new Map();
for (const vulnerability of Object.values(report.vulnerabilities || {})) {
  for (const via of vulnerability.via) {
    if (typeof via !== 'object') {
      continue;
    }
    const id = via.url.split('/').pop();
    advisories.set(id, { id, name: via.name, severity: via.severity, title: via.title, url: via.url });
  }
}

const blocking = [...advisories.values()].filter(a => BLOCKING.has(a.severity) && !allowed.has(a.id));
const tolerated = [...advisories.values()].filter(a => allowed.has(a.id));
const stale = allowlist.filter(entry => !advisories.has(entry.id));

for (const a of tolerated) {
  console.log(`allowed   ${a.severity} ${a.name} ${a.id}: ${allowed.get(a.id).reason}`);
}
for (const a of advisories.values()) {
  if (!BLOCKING.has(a.severity) && !allowed.has(a.id)) {
    console.log(`reported  ${a.severity} ${a.name} ${a.id}: ${a.title}`);
  }
}
for (const a of blocking) {
  console.error(`BLOCKING  ${a.severity} ${a.name} ${a.id}: ${a.title} (${a.url})`);
}
for (const entry of stale) {
  console.error(`STALE     ${entry.id} (${entry.package}) is allowlisted but no longer reported - remove it from .github/audit-allowlist.json`);
}

if (blocking.length || stale.length) {
  process.exit(1);
}
console.log(`npm audit: no unallowed high/critical advisories (${advisories.size} reported, ${tolerated.length} allowlisted)`);
