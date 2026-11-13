import { describe, it, expect } from 'vitest';
import { createRequire } from 'module';
import fs from 'fs';
import path from 'path';
import { FHIR_BASE, RETIRED_BASE } from 'pedigree/fhirUrls';

const require = createRequire(import.meta.url);
const { rewrite, OLD, NEW } = require('../../scripts/rewrite-fhir-urls.js');
const siteBuilder = require('../../scripts/build-fhir-site.js');

const OLD_ADOPTED = 'https://github.com/aehrc/open-pedigree/StructureDefinition/adopted';
const NEW_ADOPTED = 'https://aehrc.github.io/open-pedigree/fhir/StructureDefinition/adopted';

describe('scripts/rewrite-fhir-urls.js', () => {
  it('moves each kind of URL to the published base, and leaves identifier systems and repository links', () => {
    expect(rewrite('https://github.com/aehrc/open-pedigree/questionnaire-field-mapping'))
      .toBe(NEW + 'StructureDefinition/questionnaire-field-mapping');
    expect(rewrite('https://github.com/aehrc/open-pedigree/StructureDefinition/PedigreeIndividual#PedigreeIndividual.lifeStatus'))
      .toBe(NEW + 'StructureDefinition/PedigreeIndividual#PedigreeIndividual.lifeStatus');
    expect(rewrite('https://github.com/aehrc/open-pedigree/Questionnaire/default|1.0')).toBe(NEW + 'Questionnaire/default|1.0');
    expect(rewrite('https:\\/\\/github.com\\/aehrc\\/open-pedigree\\/StructureDefinition\\/linked-record-ref'))
      .toBe('https:\\/\\/aehrc.github.io\\/open-pedigree\\/fhir\\/StructureDefinition\\/linked-record-ref');
    expect(rewrite('https://github.com/aehrc/open-pedigree?externalID')).toBe('https://github.com/aehrc/open-pedigree?externalID');
    expect(rewrite('https://github.com/aehrc/open-pedigree')).toBe('https://github.com/aehrc/open-pedigree');
  });

  it('turns adopted true into "in" whichever order its keys are in, in plain, escaped and XML JSON', () => {
    expect(rewrite(`{"url":"${OLD_ADOPTED}","valueBoolean":true}`)).toBe(`{"url":"${NEW_ADOPTED}","valueCode":"in"}`);
    expect(rewrite(`{"valueBoolean":true,"url":"${OLD_ADOPTED}"}`)).toBe(`{"valueCode":"in","url":"${NEW_ADOPTED}"}`);
    expect(rewrite(`{&quot;valueBoolean&quot;:true,&quot;url&quot;:&quot;${OLD_ADOPTED}&quot;}`))
      .toBe(`{&quot;valueCode&quot;:&quot;in&quot;,&quot;url&quot;:&quot;${NEW_ADOPTED}&quot;}`);
    // (JSON-escaped slashes, inside a JSON string)
    const OLD_ESCAPED = 'https:\\/\\/github.com\\/aehrc\\/open-pedigree\\/StructureDefinition\\/adopted';
    const NEW_ESCAPED = 'https:\\/\\/aehrc.github.io\\/open-pedigree\\/fhir\\/StructureDefinition\\/adopted';
    expect(rewrite(`{\\"url\\":\\"${OLD_ESCAPED}\\",\\"valueBoolean\\":true}`))
      .toBe(`{\\"url\\":\\"${NEW_ESCAPED}\\",\\"valueCode\\":\\"in\\"}`);
  });

  it("leaves another system's adopted extension alone", () => {
    const theirs = '{"url":"http://example.org/fhir/StructureDefinition/adopted","valueBoolean":true}';
    expect(rewrite(theirs)).toBe(theirs);
  });

  it("leaves another extension's boolean alone", () => {
    const other = '{"url":"https://github.com/aehrc/open-pedigree/StructureDefinition/fetus-date-of-death","valueBoolean":true}';
    expect(rewrite(other)).toBe('{"url":"' + NEW + 'StructureDefinition/fetus-date-of-death","valueBoolean":true}');
  });
});

describe('the published base, wherever it is written', () => {
  it('is the same in fhirUrls.ts, the site builder, the rewrite script and the deploy check', () => {
    expect(NEW).toBe(FHIR_BASE);
    expect(OLD).toBe(RETIRED_BASE);
    expect(siteBuilder.BASE).toBe(FHIR_BASE);
    const workflow = fs.readFileSync(path.resolve(import.meta.dirname, '../../.github/workflows/deploy-pages.yml'), 'utf8');
    expect(workflow).toContain('base=' + FHIR_BASE.replace(/\/$/, ''));
  });
});
