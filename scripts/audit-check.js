// CI gate over `npm audit` (see .github/workflows/security-scan.yml). Fails on any high or
// critical advisory, dev dependencies included, unless .github/audit-allowlist.json lists its
// GHSA id for that package - an advisory with no fixed version anywhere can't be cleared by an
// upgrade, and Dependabot raises neither an alert nor a PR for every advisory npm audit
// reports, so it stays visible here rather than in a log nobody reads.
//
// An entry only applies while npm audit reports no fix for that package; once one exists the
// advisory blocks again. It also never covers an advisory that npm audit --omit=dev reports.
// That is only a partial check of what ships: webpack bundles some devDependencies too
// (raphael, @fortawesome/fontawesome-free, buffer, util), so an entry's reason has to say why
// the package doesn't reach dist/.
//
// An allowlisted advisory that is no longer reported (fixed, or withdrawn upstream) is a
// warning, not a failure - it can change on the registry side without any change here, and
// shouldn't turn every open PR red - so remove the entry when the warning appears.
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const BLOCKING = new Set(['high', 'critical']);
const GHSA = /GHSA(-[0-9a-z]{4}){3}/i;
const allowlistPath = path.join(__dirname, '..', '.github', 'audit-allowlist.json');

function fail(message) {
  console.error(message);
  process.exit(2);
}

const allowlist = JSON.parse(fs.readFileSync(allowlistPath, 'utf8'));
if (!Array.isArray(allowlist)) {
  fail('.github/audit-allowlist.json must be an array of {id, package, reason} entries');
}
for (const entry of allowlist) {
  if (!entry || !GHSA.test(entry.id || '') || !entry.package || !entry.reason) {
    fail('.github/audit-allowlist.json: each entry needs a GHSA id, a package and a reason: ' + JSON.stringify(entry));
  }
}
const keyOf = (id, name) => id.toUpperCase() + ' ' + name;
const allowed = new Map(allowlist.map(entry => [keyOf(entry.id, entry.package), entry]));

// npm audit exits non-zero whenever it finds anything, so read its JSON rather than its status.
function audit(extraArgs) {
  const result = spawnSync('npm', ['audit', '--json', ...extraArgs], {
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
    shell: process.platform === 'win32', // npm is npm.cmd there
  });
  if (result.error) {
    fail('could not run npm audit: ' + result.error.message);
  }
  let report;
  try {
    report = JSON.parse(result.stdout);
  } catch {
    report = null;
  }
  if (!report || report.error) {
    fail('npm audit failed:\n' + result.stdout + result.stderr);
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
      const ghsa = String(via.url || '').match(GHSA);
      const id = ghsa ? ghsa[0] : String(via.source || via.url || via.title);
      advisories.set(keyOf(id, via.name), {
        id, name: via.name, severity: via.severity, title: via.title, url: via.url,
        fixAvailable: Boolean(vulnerability.fixAvailable),
      });
    }
  }
  return advisories;
}

const advisories = audit([]);
// Only needed when an allowlist entry matches something - skip the second registry call otherwise.
const production = [...allowed.keys()].some(key => advisories.has(key)) ? audit(['--omit=dev']) : new Map();

const isAllowed = (key, a) => allowed.has(key) && !a.fixAvailable && !production.has(key);
const blocking = [...advisories].filter(([key, a]) => BLOCKING.has(a.severity) && !isAllowed(key, a));
const tolerated = [...advisories].filter(([key, a]) => isAllowed(key, a));
const stale = [...allowed].filter(([key]) => !advisories.has(key));

for (const [key, a] of tolerated) {
  console.log(`allowed   ${a.severity} ${a.name} ${a.id}: ${allowed.get(key).reason}`);
}
for (const [key, a] of advisories) {
  if (!BLOCKING.has(a.severity) && !isAllowed(key, a)) {
    console.log(`reported  ${a.severity} ${a.name} ${a.id}: ${a.title}`);
  }
}
for (const [key, a] of blocking) {
  let why = '';
  if (allowed.has(key)) {
    why = a.fixAvailable ? ' - allowlisted, but a fix is now available' : ' - allowlisted, but it reaches a production dependency';
  }
  console.error(`BLOCKING  ${a.severity} ${a.name} ${a.id}: ${a.title} (${a.url})${why}`);
}
for (const [, entry] of stale) {
  // ::warning:: shows as an annotation on the GitHub Actions run.
  console.log(`::warning::${entry.id} (${entry.package}) is allowlisted but no longer reported - remove it from .github/audit-allowlist.json`);
}

if (blocking.length) {
  process.exit(1);
}
console.log(`npm audit: no unallowed high/critical advisories (${advisories.size} reported, ${tolerated.length} allowlisted)`);
