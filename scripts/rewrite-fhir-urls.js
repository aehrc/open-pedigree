#!/usr/bin/env node
// Rewrites open-pedigree's FHIR URLs from the retired github.com/aehrc/open-pedigree/ base to the
// published one (fhirUrls.ts), in each file named on the command line: plain, JSON-escaped (\/)
// and XML/HTML-escaped forms. Identifier systems (?externalID) and plain repository links are left
// alone. Also turns the `adopted` extension's old valueBoolean true into valueCode "in".
// Usage: node scripts/rewrite-fhir-urls.js <file>...
const fs = require('fs');

const OLD = 'https://github.com/aehrc/open-pedigree/';
const NEW = 'https://aehrc.github.io/open-pedigree/fhir/';

function rewrite(text) {
  let out = text
    .replace(/https:\/\/github\.com\/aehrc\/open-pedigree\/(questionnaire-[a-z-]+)/g, NEW + 'StructureDefinition/$1')
    .replace(/https:\/\/github\.com\/aehrc\/open-pedigree\/((?:StructureDefinition|Questionnaire)\/)/g, NEW + '$1')
    // JSON-escaped slashes
    .replace(/https:\\\/\\\/github\.com\\\/aehrc\\\/open-pedigree\\\/(questionnaire-[a-z-]+)/g,
      NEW.replace(/\//g, '\\/') + 'StructureDefinition\\/$1')
    .replace(/https:\\\/\\\/github\.com\\\/aehrc\\\/open-pedigree\\\/((?:StructureDefinition|Questionnaire)\\\/)/g,
      NEW.replace(/\//g, '\\/') + '$1');
  // The adopted extension's value: true -> "in" (any quoting style, next to its url).
  out = out.replace(/(StructureDefinition\\?\/adopted(?:&quot;|\\?")[^{}]{0,40}?)(?:&quot;|\\?")valueBoolean(?:&quot;|\\?")\s*:\s*true/g,
    (m, head) => head + m.slice(head.length).replace(/valueBoolean((?:&quot;|\\?")\s*:\s*)true/, 'valueCode$1' + (m.includes('&quot;') ? '&quot;in&quot;' : m.includes('\\"') ? '\\"in\\"' : '"in"')));
  return out;
}

if (require.main === module) {
  for (const file of process.argv.slice(2)) {
    const before = fs.readFileSync(file, 'utf8');
    const after = rewrite(before);
    if (after !== before) {
      fs.writeFileSync(file, after);
      console.log('rewrote ' + file);
    }
  }
}
module.exports = { rewrite };
