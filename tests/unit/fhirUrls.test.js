import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { replacementFor, FHIR_BASE, PUBLISHED_DEFINITION_URLS } from 'pedigree/fhirUrls';
import { parseQuestionnaire } from 'pedigree/questionnaire/questionnaireParser';

const SRC = path.resolve(import.meta.dirname, '../../src');

function sourceFiles(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? sourceFiles(full) : /\.(ts|js)$/.test(entry.name) ? [full] : [];
  });
}

describe('open-pedigree FHIR URLs', () => {
  it('maps each retired URL to its published one, and nothing else', () => {
    expect(replacementFor('https://github.com/aehrc/open-pedigree/questionnaire-field-mapping'))
      .toBe(FHIR_BASE + 'StructureDefinition/questionnaire-field-mapping');
    expect(replacementFor('https://github.com/aehrc/open-pedigree/StructureDefinition/fetus-date-of-death'))
      .toBe(FHIR_BASE + 'StructureDefinition/fetus-date-of-death');
    expect(replacementFor('https://github.com/aehrc/open-pedigree/Questionnaire/default'))
      .toBe(FHIR_BASE + 'Questionnaire/default');
    expect(replacementFor('https://github.com/aehrc/open-pedigree?externalID')).toBeNull();
    expect(replacementFor('https://github.com/aehrc/open-pedigree')).toBeNull();
    expect(replacementFor('http://hl7.org/fhir/StructureDefinition/Patient')).toBeNull();
    // (a name that was never published gets no made-up replacement)
    expect(replacementFor('https://github.com/aehrc/open-pedigree/questionnaire-foo')).toBeNull();
    expect(replacementFor('https://github.com/aehrc/open-pedigree/StructureDefinition/PedigreeIndividual#PedigreeIndividual.lifeStatus'))
      .toBe(FHIR_BASE + 'StructureDefinition/PedigreeIndividual#PedigreeIndividual.lifeStatus');
  });

  it("a retired URL of an extension open-pedigree doesn't read (a host's own) doesn't reject the Questionnaire", () => {
    const questionnaire = {
      resourceType: 'Questionnaire',
      item: [{
        linkId: 'tab', type: 'group', text: 'Tab',
        item: [{
          linkId: 'note', type: 'string', text: 'Note',
          extension: [{ url: 'https://github.com/aehrc/open-pedigree/questionnaire-redcap-source',
            extension: [{ url: 'instrument', valueString: 'f' }, { url: 'field', valueString: 'x' }] }],
        }],
      }],
    };
    expect(() => parseQuestionnaire(questionnaire)).not.toThrow();
  });

  it('every published URL is under the published base', () => {
    for (const url of PUBLISHED_DEFINITION_URLS) {
      expect(url.startsWith(FHIR_BASE)).toBe(true);
    }
  });

  it('no source file names one of open-pedigree\'s own FHIR URLs under the retired base', () => {
    const offenders = sourceFiles(SRC)
      .filter((file) => !file.endsWith('fhirUrls.ts'))
      .filter((file) => /github\.com\/aehrc\/open-pedigree\/(StructureDefinition|Questionnaire|questionnaire-)/.test(fs.readFileSync(file, 'utf8')));
    expect(offenders).toEqual([]);
  });

  it('a Questionnaire using a retired extension URL is refused, naming the URL to use', () => {
    const questionnaire = {
      resourceType: 'Questionnaire',
      item: [{
        linkId: 'tab', type: 'group', text: 'Tab',
        item: [{
          linkId: 'note', type: 'string', text: 'Note',
          extension: [{ url: 'https://github.com/aehrc/open-pedigree/questionnaire-field-mapping', valueCode: 'mapsToField' }],
        }],
      }],
    };
    expect(() => parseQuestionnaire(questionnaire)).toThrow(
      'The Questionnaire uses https://github.com/aehrc/open-pedigree/questionnaire-field-mapping, which open-pedigree no longer reads: use '
      + FHIR_BASE + 'StructureDefinition/questionnaire-field-mapping instead.');
  });

  it('a Questionnaire on the published URLs, or linking the repository, parses', () => {
    const questionnaire = {
      resourceType: 'Questionnaire',
      item: [{
        linkId: 'tab', type: 'group', text: 'Tab', extension: [{ url: 'https://github.com/aehrc/open-pedigree', valueString: 'see' }],
        item: [{ linkId: 'note', type: 'string', text: 'Note' }],
      }],
    };
    expect(() => parseQuestionnaire(questionnaire)).not.toThrow();
  });
});
