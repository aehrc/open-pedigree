// CI gate over `npm audit` (see .github/workflows/security-scan.yml). Fails on any high or
// critical advisory, dev dependencies included, unless .github/audit-allowlist.json lists its
// GHSA id for that package - an advisory with no fixed version anywhere (e.g. one reached
// only through webpack-dev-server) can't be cleared by an upgrade, and Dependabot raises
// neither an alert nor a PR for every advisory npm audit reports, so it stays visible here
// rather than in a log nobody reads. The allowlist never covers an advisory that also reaches
// a production dependency (npm audit --omit=dev), since that is in the shipped bundle. Also
// fails when an allowlisted advisory no longer appears at all, so an entry is removed as soon
// as the fix lands instead of lingering.
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const BLOCKING = new Set(['high', 'critical']);
const allowlistPath = path.join(__dirname, '..', '.github', 'audit-allowlist.json');

const allowlist = JSON.parse(fs.readFileSync(allowlistPath, 'utf8'));
const allowed = new Map(allowlist.map(entry => [entry.id + ' ' + entry.package, entry]));

// npm audit exits non-zero whenever it finds anything, so read its JSON rather than its status.
function audit(extraArgs) {
  const result = spawnSync('npm', ['audit', '--json', ...extraArgs], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  if (result.error) {
    console.error('could not run npm audit: ' + result.error.message);
    process.exit(2);
  }
  let report;
  try {
    report = JSON.parse(result.stdout);
  } catch {
    report = null;
  }
  if (!report || report.error) {
    console.error('npm audit failed:\n' + result.stdout + result.stderr);
    process.exit(2);
  }
  // A package's `via` holds advisory objects (its own) and strings (packages it depends on);
  // only the objects are advisories. Keyed by advisory and package, since one advisory can
  // affect several packages.
  const advisories = new Map();
  for (const vulnerability of Object.values(report.vulnerabilities || {})) {
    for (const via of vulnerability.via) {
      if (typeof via !== 'object') {
        continue;
      }
      const ghsa = String(via.url || '').match(/GHSA-[0-9a-z]{4}-[0-9a-z]{4}-[0-9a-z]{4}/);
      const id = ghsa ? ghsa[0] : String(via.source);
      advisories.set(id + ' ' + via.name, { id, name: via.name, severity: via.severity, title: via.title, url: via.url });
    }
  }
  return advisories;
}

const advisories = audit([]);
const production = audit(['--omit=dev']);

const isAllowed = (key) => allowed.has(key) && !production.has(key);
const blocking = [...advisories].filter(([key, a]) => BLOCKING.has(a.severity) && !isAllowed(key));
const tolerated = [...advisories].filter(([key]) => isAllowed(key));
const stale = [...allowed].filter(([key]) => !advisories.has(key));

for (const [key, a] of tolerated) {
  console.log(`allowed   ${a.severity} ${a.name} ${a.id}: ${allowed.get(key).reason}`);
}
for (const [key, a] of advisories) {
  if (!BLOCKING.has(a.severity) && !isAllowed(key)) {
    console.log(`reported  ${a.severity} ${a.name} ${a.id}: ${a.title}`);
  }
}
for (const [key, a] of blocking) {
  const why = allowed.has(key) ? ' - allowlisted, but it reaches a production dependency' : '';
  console.error(`BLOCKING  ${a.severity} ${a.name} ${a.id}: ${a.title} (${a.url})${why}`);
}
for (const [, entry] of stale) {
  console.error(`STALE     ${entry.id} (${entry.package}) is allowlisted but no longer reported - remove it from .github/audit-allowlist.json`);
}

if (blocking.length || stale.length) {
  process.exit(1);
}
console.log(`npm audit: no unallowed high/critical advisories (${advisories.size} reported, ${tolerated.length} allowlisted)`);
