import { describe, it, expect, vi } from 'vitest';
import { evaluateGraphPredicate, evaluatePerOptionPredicate } from 'pedigree/questionnaire/graphPredicateEvaluator';

function makeNode(overrides) {
  return {
    getID: () => 1,
    getGender: () => 'F',
    getLinkedPatientRef: () => '',
    getDisorders: () => [],
    getLifeStatus: () => 'alive',
    isFetus: () => false,
    isProband: () => false,
    ...overrides,
  };
}

describe('evaluateGraphPredicate (whole-item predicates)', () => {
  it('isFetus delegates to node.isFetus()', () => {
    expect(evaluateGraphPredicate('isFetus', makeNode({ isFetus: () => true }), {}, {})).toBe(true);
    expect(evaluateGraphPredicate('isFetus', makeNode({ isFetus: () => false }), {}, {})).toBe(false);
  });

  it('hasRelationships delegates to graph.hasRelationships(id)', () => {
    const graph = { hasRelationships: vi.fn(() => true) };
    expect(evaluateGraphPredicate('hasRelationships', makeNode(), graph, {})).toBe(true);
    expect(graph.hasRelationships).toHaveBeenCalledWith(1);
  });

  it('isProband delegates to node.isProband()', () => {
    expect(evaluateGraphPredicate('isProband', makeNode({ isProband: () => true }), {}, {})).toBe(true);
  });

  it('isRelatedToProband delegates to graph.isRelatedToProband(id)', () => {
    const graph = { isRelatedToProband: () => false };
    expect(evaluateGraphPredicate('isRelatedToProband', makeNode(), graph, {})).toBe(false);
  });

  it('hasToBeAdopted delegates to graph.hasToBeAdopted(id)', () => {
    const graph = { hasToBeAdopted: () => true };
    expect(evaluateGraphPredicate('hasToBeAdopted', makeNode(), graph, {})).toBe(true);
  });

  it('isTwin is true only when there is more than one twin', () => {
    const soloGraph = { getAllTwinsSortedByOrder: () => [1] };
    const twinGraph = { getAllTwinsSortedByOrder: () => [1, 2] };
    expect(evaluateGraphPredicate('isTwin', makeNode(), soloGraph, {})).toBe(false);
    expect(evaluateGraphPredicate('isTwin', makeNode(), twinGraph, {})).toBe(true);
  });

  it('isTwinWithConsistentGender is false for a solo node and checks all twins share gender', () => {
    const soloGraph = { getAllTwinsSortedByOrder: () => [1] };
    expect(evaluateGraphPredicate('isTwinWithConsistentGender', makeNode(), soloGraph, {})).toBe(false);

    const consistentGraph = { getAllTwinsSortedByOrder: () => [1, 2], getGender: () => 'F' };
    expect(evaluateGraphPredicate('isTwinWithConsistentGender', makeNode({ getGender: () => 'F' }), consistentGraph, {})).toBe(true);

    const inconsistentGraph = { getAllTwinsSortedByOrder: () => [1, 2], getGender: (id) => (id === 1 ? 'F' : 'M') };
    expect(evaluateGraphPredicate('isTwinWithConsistentGender', makeNode({ getGender: () => 'F' }), inconsistentGraph, {})).toBe(false);
  });

  it('canLinkPatient delegates to patientProvider.canLinkPatient(id)', () => {
    const patientProvider = { canLinkPatient: () => true };
    expect(evaluateGraphPredicate('canLinkPatient', makeNode(), {}, patientProvider)).toBe(true);
  });

  it('canImportClinicalData requires both provider capability and a linked patient', () => {
    const patientProvider = { canImportClinicalData: () => true };
    expect(evaluateGraphPredicate('canImportClinicalData', makeNode({ getLinkedPatientRef: () => '' }), {}, patientProvider)).toBe(false);
    expect(evaluateGraphPredicate('canImportClinicalData', makeNode({ getLinkedPatientRef: () => 'Patient/1' }), {}, patientProvider)).toBe(true);
  });

  it('returns false and warns for an unrecognised predicate name', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(evaluateGraphPredicate('notARealPredicate', makeNode(), {}, {})).toBe(false);
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });
});

describe('evaluatePerOptionPredicate (per-option predicates)', () => {
  it('possibleGenders returns the disabled gender codes', () => {
    const graph = { getPossibleGenders: () => ({ M: true, F: true, U: false }) };
    expect(evaluatePerOptionPredicate('possibleGenders', makeNode(), graph)).toEqual(['U']);
  });

  it('carrierAvailability disables "" once more than one disorder (or a non-"affected" single disorder) is present', () => {
    expect(evaluatePerOptionPredicate('carrierAvailability', makeNode({ getDisorders: () => [] }), {})).toEqual([]);
    expect(evaluatePerOptionPredicate('carrierAvailability', makeNode({ getDisorders: () => ['affected'] }), {})).toEqual([]);
    expect(evaluatePerOptionPredicate('carrierAvailability', makeNode({ getDisorders: () => ['diabetes'] }), {})).toEqual(['']);
    expect(evaluatePerOptionPredicate('carrierAvailability', makeNode({ getDisorders: () => ['a', 'b'] }), {})).toEqual(['']);
  });

  it('carrierAvailability disables "presymptomatic" for aborted/miscarriage life status', () => {
    expect(evaluatePerOptionPredicate('carrierAvailability', makeNode({ getLifeStatus: () => 'aborted' }), {})).toEqual(['presymptomatic']);
    expect(evaluatePerOptionPredicate('carrierAvailability', makeNode({ getLifeStatus: () => 'miscarriage' }), {})).toEqual(['presymptomatic']);
    expect(evaluatePerOptionPredicate('carrierAvailability', makeNode({ getLifeStatus: () => 'alive' }), {})).toEqual([]);
  });

  it('lifeStatusAvailability disables unborn/aborted/miscarriage/stillborn once the node has ever had relationships', () => {
    const onceAlive = { hasRelationships: () => true };
    const neverAlive = { hasRelationships: () => false };
    expect(evaluatePerOptionPredicate('lifeStatusAvailability', makeNode(), onceAlive)).toEqual(['unborn', 'aborted', 'miscarriage', 'stillborn']);
    expect(evaluatePerOptionPredicate('lifeStatusAvailability', makeNode(), neverAlive)).toEqual([]);
  });

  it('returns an empty array and warns for an unrecognised predicate name', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(evaluatePerOptionPredicate('notARealPredicate', makeNode(), {})).toEqual([]);
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });
});
