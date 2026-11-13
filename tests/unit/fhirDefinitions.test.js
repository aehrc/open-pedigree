import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { FHIR_BASE, PUBLISHED_DEFINITION_URLS, DEFAULT_QUESTIONNAIRE_URL } from 'pedigree/fhirUrls';
import { DEFAULT_QUESTIONNAIRE } from 'pedigree/questionnaire/defaultQuestionnaire';

// The published definitions (fhir/, built into the Pages site by scripts/build-fhir-site.js):
// shape checks only, not full FHIR validation.
const FHIR_DIR = path.resolve(import.meta.dirname, '../../fhir');

const definitions = fs.readdirSync(FHIR_DIR).flatMap((type) => fs.readdirSync(path.join(FHIR_DIR, type))
  .filter((file) => file.endsWith('.json'))
  .map((file) => ({ type, id: file.slice(0, -5), resource: JSON.parse(fs.readFileSync(path.join(FHIR_DIR, type, file), 'utf8')) })));

describe('published FHIR definitions', () => {
  it('there is one for every URL open-pedigree publishes', () => {
    const urls = definitions.map((d) => d.resource.url).concat([DEFAULT_QUESTIONNAIRE.url]);
    for (const url of PUBLISHED_DEFINITION_URLS) {
      expect(urls, url).toContain(url);
    }
    expect(DEFAULT_QUESTIONNAIRE.url).toBe(DEFAULT_QUESTIONNAIRE_URL);
  });

  it('every definition in fhir/ is one open-pedigree lists as published', () => {
    for (const { resource } of definitions) {
      expect(PUBLISHED_DEFINITION_URLS, resource.url).toContain(resource.url);
    }
  });

  it('each sits at the path its canonical URL names, and says what it is', () => {
    for (const { type, id, resource } of definitions) {
      expect(resource.resourceType, `${type}/${id}`).toBe(type);
      expect(resource.id).toBe(id);
      expect(resource.url).toBe(FHIR_BASE + type + '/' + id);
      expect(resource.status).toBe('active');
      for (const key of ['name', 'title', 'description', 'publisher']) {
        expect(typeof resource[key] === 'string' && resource[key].trim().length > 0, `${type}/${id} ${key}`).toBe(true);
      }
    }
  });

  it('each extension fixes its own url, says where it is used, and either takes a value or has parts', () => {
    const extensions = definitions.filter((d) => d.type === 'StructureDefinition' && d.resource.type === 'Extension');
    expect(extensions.length).toBe(9);
    for (const { id, resource } of extensions) {
      const elements = resource.differential.element;
      expect(elements.find((e) => e.id === 'Extension.url').fixedUri, id).toBe(resource.url);
      expect(resource.baseDefinition).toBe('http://hl7.org/fhir/StructureDefinition/Extension');
      expect(resource.context.length, id).toBeGreaterThan(0);
      const value = elements.find((e) => e.id === 'Extension.value[x]');
      const parts = elements.filter((e) => e.sliceName);
      expect(Boolean(value && value.type) !== (parts.length > 0), id).toBe(true);
    }
  });

  it('a bound value names a published value set, whose code system is published', () => {
    const byUrl = Object.fromEntries(definitions.map((d) => [d.resource.url, d.resource]));
    const bound = definitions.flatMap((d) => (d.resource.differential ? d.resource.differential.element : []).filter((e) => e.binding));
    expect(bound.length).toBeGreaterThan(0);
    for (const element of bound) {
      const valueSet = byUrl[element.binding.valueSet];
      expect(valueSet, element.binding.valueSet).toBeTruthy();
      for (const include of valueSet.compose.include) {
        expect(byUrl[include.system], include.system).toBeTruthy();
      }
    }
  });

  it('adoption direction has exactly in and out', () => {
    const codeSystem = definitions.find((d) => d.type === 'CodeSystem' && d.id === 'adoption-direction').resource;
    expect(codeSystem.concept.map((c) => c.code)).toEqual(['in', 'out']);
  });
});
