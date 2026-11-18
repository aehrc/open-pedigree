import { describe, it, expect, vi, afterEach } from 'vitest';
import { checkQuestionnaire } from 'pedigree/questionnaire/checkQuestionnaire';
import { parseQuestionnaire } from 'pedigree/questionnaire/questionnaireParser';
import { DEFAULT_QUESTIONNAIRE } from 'pedigree/questionnaire/defaultQuestionnaire';

// checkQuestionnaire (pedigree-questionnaire-launcher): every problem the editor would meet in a
// Questionnaire, each with its item and effect, in document order; never throws.

const BASE = 'https://aehrc.github.io/open-pedigree/fhir/StructureDefinition/';
const mapping = (kind) => ({ url: BASE + 'questionnaire-field-mapping', valueCode: kind });
const action = (name) => ({ url: BASE + 'questionnaire-action', valueCode: name });
const predicate = (name) => ({ url: BASE + 'questionnaire-enable-predicate', valueCode: name });
const q = (items) => ({ resourceType: 'Questionnaire', item: items });
const group = (items) => ({ linkId: 'tab', type: 'group', text: 'Tab', item: items });
const effects = (result) => result.problems.map((p) => [p.linkId, p.effect]);

afterEach(() => vi.restoreAllMocks());
const quiet = () => vi.spyOn(console, 'warn').mockImplementation(() => {});

describe('parseQuestionnaire with a collector', () => {
  // A Questionnaire with one of each problem the parser logs.
  const laden = q([
    group([
      { linkId: 'g', type: 'group', extension: [mapping('mapsToField')], item: [{ linkId: 'g1', type: 'string' }] },
      { linkId: 'f', type: 'string', extension: [mapping('mapsToField')], definition: 'http://x#Thing.nothing' },
      { linkId: 'c', type: 'boolean', extension: [mapping('mapsToCondition')] },
      { linkId: 'l', type: 'string', extension: [mapping('mapsToLegendCondition')] },
      { linkId: 'a', type: 'display', text: 'Go', extension: [mapping('invokesAction'), action('teleport')] },
      { linkId: 'u', type: 'string', extension: [mapping('mapsToSomething')] },
      { linkId: 's', type: 'choice', answerOption: [{ valueString: 'x', initialSelected: true }, { valueString: 'y', initialSelected: true }] },
      { linkId: 'att', type: 'attachment' },
    ]),
    { linkId: 'loose', type: 'string' },
  ]);

  it('gives the same form, and logs the same, with or without a collector', () => {
    const warn = quiet();
    const plain = parseQuestionnaire(laden);
    const plainLog = warn.mock.calls.map((c) => c[0]);
    warn.mockClear();
    const problems = [];
    const collected = parseQuestionnaire(laden, problems);
    expect(collected).toEqual(plain);
    expect(warn.mock.calls.map((c) => c[0])).toEqual(plainLog);
    expect(problems).toHaveLength(plainLog.length);
    expect(parseQuestionnaire(DEFAULT_QUESTIONNAIRE, [])).toEqual(parseQuestionnaire(DEFAULT_QUESTIONNAIRE));
  });

  it('records each logged problem with its item and what the editor does', () => {
    quiet();
    const problems = [];
    parseQuestionnaire(laden, problems);
    expect(problems.map((p) => [p.linkId, p.effect])).toEqual([
      ['g', 'ignored'], ['f', 'ignored'], ['c', 'ignored'], ['l', 'ignored'], ['a', 'ignored'],
      ['u', 'ignored'], ['s', 'ignored'], ['att', 'ignored'], ['loose', 'moved'],
    ]);
    expect(problems[2].message).toBe('Item c declares mapsToCondition but has no item.code - ignoring mapping.');
  });

  it('collects nothing after a collected parse ends', () => {
    const warn = quiet();
    const problems = [];
    parseQuestionnaire(laden, problems);
    const count = problems.length;
    parseQuestionnaire(laden);
    expect(problems).toHaveLength(count);
    expect(warn).toHaveBeenCalled();
  });
});

describe('checkQuestionnaire', () => {
  it('finds nothing wrong with the built-in default Questionnaire', () => {
    const result = checkQuestionnaire(DEFAULT_QUESTIONNAIRE);
    expect(result.problems).toEqual([]);
    expect(result.isFatal()).toBe(false);
    expect(result.toString()).toBe('');
  });

  it('refuses what isn\'t a Questionnaire, without throwing', () => {
    for (const input of [null, undefined, 'Questionnaire', 42, [], { resourceType: 'Patient' }, {}]) {
      const result = checkQuestionnaire(input);
      expect(result.isFatal()).toBe(true);
      expect(result.problems).toHaveLength(1);
    }
    expect(checkQuestionnaire({ resourceType: 'Patient' }).problems[0].message).toContain('a Patient, not a Questionnaire');
  });

  it('refuses a Questionnaire with no items', () => {
    expect(checkQuestionnaire({ resourceType: 'Questionnaire' }).isFatal()).toBe(true);
    expect(checkQuestionnaire(q([])).problems[0].message).toContain('no items');
  });

  it('lists every retired extension URL, each with its replacement', () => {
    const result = checkQuestionnaire(q([group([
      { linkId: 'x', type: 'string', extension: [{ url: 'https://github.com/aehrc/open-pedigree/questionnaire-field-mapping', valueCode: 'mapsToField' }] },
      { linkId: 'y', type: 'boolean', enableWhen: [{ extension: [{ url: 'https://github.com/aehrc/open-pedigree/questionnaire-enable-predicate', valueCode: 'isFetus' }] }] },
    ])]));
    expect(result.problems.map((p) => p.effect)).toEqual(['fatal', 'fatal']);
    expect(result.problems[0].message).toContain(BASE + 'questionnaire-field-mapping');
    expect(result.problems[1].message).toContain(BASE + 'questionnaire-enable-predicate');
  });

  it('reports the parser\'s problems and the references it can\'t resolve, in order', () => {
    quiet();
    const result = checkQuestionnaire(q([group([
      { linkId: 'c', type: 'boolean', extension: [mapping('mapsToCondition')] },
      { linkId: 'tested', type: 'boolean' },
      { linkId: 'result', type: 'string', enableWhen: [{ question: 'tsted', operator: '=', answerBoolean: true }] },
      { linkId: 'lock', type: 'string', disabledWhen: [{ question: 'gone', operator: 'exists', answerBoolean: true }] },
      { linkId: 'gp', type: 'string', enableWhen: [{ extension: [predicate('isGrandparent')] }] },
      { linkId: 'sex', type: 'choice', answerOption: [{ valueString: 'M' }], disablingPredicate: 'impossibleSexes' },
      { linkId: 'tested', type: 'string' },
      { linkId: 'att', type: 'attachment' },
    ])]));
    expect(effects(result)).toEqual([
      ['c', 'ignored'], ['att', 'ignored'],
      ['tested', 'ignored'], ['result', 'ignored'], ['lock', 'ignored'], ['gp', 'ignored'], ['sex', 'ignored'],
    ]);
    expect(result.isFatal()).toBe(false);
    expect(result.problems[3].message).toContain('"tsted", which no item has as its linkId');
    expect(result.problems[4].message).toContain('disabledWhen');
    expect(result.problems[5].message).toMatch(/"isGrandparent" is unknown.*Known predicates: .*isFetus/);
    expect(result.problems[6].message).toMatch(/"impossibleSexes" is unknown.*possibleGenders/);
    expect(result.toString().split('\n')).toHaveLength(7);
    expect(result.toString()).toMatch(/^1\. Item c /);
  });

  it('accepts conditions on items anywhere in the Questionnaire, and known predicates', () => {
    const result = checkQuestionnaire(q([
      group([{ linkId: 'later', type: 'string', enableWhen: [{ question: 'first', operator: 'exists', answerBoolean: true }] }]),
      { linkId: 'tab2', type: 'group', text: 'Two', item: [
        { linkId: 'first', type: 'boolean' },
        { linkId: 'fetal', type: 'integer', enableWhen: [{ extension: [predicate('isFetus')] }] },
      ] },
    ]));
    expect(result.problems).toEqual([]);
  });

  it('never throws, whatever the items hold', () => {
    quiet();
    const odd = q([null, 5, 'x', { linkId: 'a', type: 'string', enableWhen: 'nonsense', disabledWhen: [null, 3] }, { type: 'group' }]);
    expect(() => checkQuestionnaire(odd)).not.toThrow();
    expect(checkQuestionnaire(odd).problems.every((p) => typeof p.message === 'string')).toBe(true);
  });
});

describe('checkQuestionnaire: what the editor drops or can never evaluate', () => {
  it('reports an item with no linkId, once, with how many items inside it go too', () => {
    const result = checkQuestionnaire(q([group([
      { type: 'string', text: 'Age' },
      { type: 'group', text: 'Sub', item: [{ linkId: 'a', type: 'string' }, { linkId: 'b', type: 'string' }] },
      { linkId: 'kept', type: 'string' },
    ])]));
    expect(result.problems.map((p) => p.message)).toEqual([
      'An item with no linkId ("Age") isn\'t on the form: every item needs a linkId.',
      'An item with no linkId ("Sub") isn\'t on the form, nor are the 2 items inside it: every item needs a linkId.',
    ]);
  });

  it('reports what sits inside an item the editor dropped, and a condition on it', () => {
    quiet();
    const result = checkQuestionnaire(q([group([
      { linkId: 'scan', type: 'attachment', item: [{ linkId: 'note', type: 'string' }] },
      { linkId: 'seen', type: 'string', enableWhen: [{ question: 'scan', operator: 'exists', answerBoolean: true }] },
    ])]));
    expect(effects(result)).toEqual([['scan', 'ignored'], ['note', 'ignored'], ['seen', 'ignored']]);
    expect(result.problems[1].message).toContain('sits inside scan, which the editor dropped');
    expect(result.problems[2].message).toContain('is on scan, which isn\'t on the form');
  });

  it('reports an operator the editor doesn\'t know, a missing one, and nothing to compare with', () => {
    const result = checkQuestionnaire(q([group([
      { linkId: 'tested', type: 'boolean' },
      { linkId: 'a', type: 'string', enableWhen: [{ question: 'tested', operator: '==', answerBoolean: true }] },
      { linkId: 'b', type: 'string', enableWhen: [{ question: 'tested', answerBoolean: true }] },
      { linkId: 'c', type: 'string', disabledWhen: [{ question: 'tested', operator: '=' }] },
      { linkId: 'd', type: 'string', enableWhen: [{ question: 'tested', operator: 'exists', answerBoolean: true }] },
    ])]));
    expect(effects(result)).toEqual([['a', 'ignored'], ['b', 'ignored'], ['c', 'ignored']]);
    expect(result.problems[0].message).toContain('operator "=="');
    expect(result.problems[1].message).toContain('has no operator');
    expect(result.problems[2].message).toContain('no answer value');
  });

  it('reports a linkId the editor uses for its own items', () => {
    const result = checkQuestionnaire(q([group([{ linkId: 'editRecord', type: 'string' }])]));
    expect(effects(result)).toEqual([['editRecord', 'ignored']]);
    expect(result.problems[0].message).toContain('its own linked-record items');
  });

  it('says what the editor does with what it can\'t use', () => {
    expect(checkQuestionnaire(q([])).problems[0].message).toContain('form would be empty');
    expect(checkQuestionnaire({ resourceType: 'Bundle' }).problems[0].message).toContain('can\'t build a form from it');
  });
});
