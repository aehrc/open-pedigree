import { describe, it, expect } from 'vitest';
import { evaluateEnableWhen } from 'pedigree/questionnaire/enableWhenEvaluator';

describe('evaluateEnableWhen', () => {
  it('returns true when there is no enableWhen', () => {
    expect(evaluateEnableWhen(undefined, undefined, {})).toBe(true);
    expect(evaluateEnableWhen([], 'all', {})).toBe(true);
  });

  it('= operator matches boolean answers', () => {
    const enableWhen = [{ question: 'q1', operator: '=', answerBoolean: true }];
    expect(evaluateEnableWhen(enableWhen, 'all', { q1: true })).toBe(true);
    expect(evaluateEnableWhen(enableWhen, 'all', { q1: false })).toBe(false);
    expect(evaluateEnableWhen(enableWhen, 'all', {})).toBe(false);
  });

  it('!= operator', () => {
    const enableWhen = [{ question: 'q1', operator: '!=', answerString: 'no' }];
    expect(evaluateEnableWhen(enableWhen, 'all', { q1: 'yes' })).toBe(true);
    expect(evaluateEnableWhen(enableWhen, 'all', { q1: 'no' })).toBe(false);
  });

  it('exists operator', () => {
    const existsTrue = [{ question: 'q1', operator: 'exists', answerBoolean: true }];
    const existsFalse = [{ question: 'q1', operator: 'exists', answerBoolean: false }];
    expect(evaluateEnableWhen(existsTrue, 'all', { q1: 'anything' })).toBe(true);
    expect(evaluateEnableWhen(existsTrue, 'all', {})).toBe(false);
    expect(evaluateEnableWhen(existsFalse, 'all', {})).toBe(true);
    expect(evaluateEnableWhen(existsFalse, 'all', { q1: 'anything' })).toBe(false);
  });

  it('ordering operators for integers', () => {
    expect(evaluateEnableWhen([{ question: 'age', operator: '>', answerInteger: 18 }], 'all', { age: 20 })).toBe(true);
    expect(evaluateEnableWhen([{ question: 'age', operator: '>', answerInteger: 18 }], 'all', { age: 10 })).toBe(false);
    expect(evaluateEnableWhen([{ question: 'age', operator: '<=', answerInteger: 18 }], 'all', { age: 18 })).toBe(true);
  });

  it('coding answers compare by code', () => {
    const enableWhen = [{ question: 'q1', operator: '=', answerCoding: { code: 'F' } }];
    expect(evaluateEnableWhen(enableWhen, 'all', { q1: { code: 'F', display: 'Female' } })).toBe(true);
    expect(evaluateEnableWhen(enableWhen, 'all', { q1: { code: 'M', display: 'Male' } })).toBe(false);
  });

  it('enableBehavior "all" requires every condition to be satisfied', () => {
    const enableWhen = [
      { question: 'q1', operator: '=', answerBoolean: true },
      { question: 'q2', operator: '=', answerBoolean: true },
    ];
    expect(evaluateEnableWhen(enableWhen, 'all', { q1: true, q2: true })).toBe(true);
    expect(evaluateEnableWhen(enableWhen, 'all', { q1: true, q2: false })).toBe(false);
  });

  it('enableBehavior "any" requires only one condition to be satisfied', () => {
    const enableWhen = [
      { question: 'q1', operator: '=', answerBoolean: true },
      { question: 'q2', operator: '=', answerBoolean: true },
    ];
    expect(evaluateEnableWhen(enableWhen, 'any', { q1: true, q2: false })).toBe(true);
    expect(evaluateEnableWhen(enableWhen, 'any', { q1: false, q2: false })).toBe(false);
  });
});
