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
  // The adopted extension's value: true -> "in", in an object that names the adopted url, whichever
  // order its keys are in, in any quoting style (plain, JSON-escaped, XML-escaped).
  out = out.replace(/\{[^{}]*\}/g, (object) => {
    if (!/StructureDefinition\\?\/adopted(?:&quot;|\\?")/.test(object)) {
      return object;
    }
    return object.replace(/valueBoolean((?:&quot;|\\?")\s*:\s*)true/, (m, sep) => {
      const quote = sep.startsWith('&quot;') ? '&quot;' : sep.startsWith('\\"') ? '\\"' : '"';
      return 'valueCode' + sep + quote + 'in' + quote;
    });
  });
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
module.exports = { rewrite, OLD, NEW };
