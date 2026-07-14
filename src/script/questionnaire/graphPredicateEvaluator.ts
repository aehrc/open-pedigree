// Closed vocabulary of graph/app-state predicates usable from enableWhen (see design D16).
// Each is pure delegation to an existing Person/DynamicPositionedGraph/PatientProvider method -
// no new graph logic lives here.

export const WHOLE_ITEM_PREDICATES: any = {
  isFetus: (node: any) => node.isFetus(),
  hasRelationships: (node: any, graph: any) => graph.hasRelationships(node.getID()),
  isProband: (node: any) => node.isProband(),
  isRelatedToProband: (node: any, graph: any) => graph.isRelatedToProband(node.getID()),
  hasToBeAdopted: (node: any, graph: any) => graph.hasToBeAdopted(node.getID()),
  isTwin: (node: any, graph: any) => graph.getAllTwinsSortedByOrder(node.getID()).length > 1,
  isTwinWithConsistentGender: (node: any, graph: any) => {
    const twins = graph.getAllTwinsSortedByOrder(node.getID());
    if (twins.length <= 1) {
      return false;
    }
    return twins.every((twinId: any) => graph.getGender(twinId) === node.getGender());
  },
  canLinkPatient: (node: any, graph: any, patientProvider: any) => patientProvider.canLinkPatient(node.getID()),
  canImportClinicalData: (node: any, graph: any, patientProvider: any) =>
    patientProvider.canImportClinicalData() && !!node.getLinkedPatientRef(),
};

/**
 * Evaluates a named whole-item graph/app-state predicate against the given node.
 * Returns false (and logs a warning) for an unrecognised predicate name.
 */
export function evaluateGraphPredicate(name: any, node: any, graph: any, patientProvider: any): boolean {
  const fn = WHOLE_ITEM_PREDICATES[name];
  if (!fn) {
    console.warn('Unrecognised graph/app-state predicate "' + name + '" - treating as unsatisfied');
    return false;
  }
  return !!fn(node, graph, patientProvider);
}

// Per-option predicates resolve to the subset of an item's own answer options that should be
// disabled (not hidden), for radio/select-rendered items - see design D16.
export const PER_OPTION_PREDICATES: any = {
  possibleGenders: (node: any, graph: any): any[] => {
    const genderSet = graph.getPossibleGenders(node.getID());
    const disabled: any[] = [];
    for (const gender in genderSet) {
      if (genderSet.hasOwnProperty(gender) && !genderSet[gender]) {
        disabled.push(gender);
      }
    }
    return disabled;
  },
  carrierAvailability: (node: any): any[] => {
    const disabled: any[] = [];
    const disorders = node.getDisorders();
    if (disorders.length > 0 && (disorders.length !== 1 || disorders[0] !== 'affected')) {
      disabled.push('');
    }
    if (node.getLifeStatus() === 'aborted' || node.getLifeStatus() === 'miscarriage') {
      disabled.push('presymptomatic');
    }
    return disabled;
  },
  lifeStatusAvailability: (node: any, graph: any): any[] => {
    return graph.hasRelationships(node.getID()) ? ['unborn', 'aborted', 'miscarriage', 'stillborn'] : [];
  },
};

/**
 * Evaluates a named per-option predicate, returning the array of option values to disable.
 * Returns an empty array (and logs a warning) for an unrecognised predicate name.
 */
export function evaluatePerOptionPredicate(name: any, node: any, graph: any): any[] {
  const fn = PER_OPTION_PREDICATES[name];
  if (!fn) {
    console.warn('Unrecognised per-option predicate "' + name + '" - no options disabled');
    return [];
  }
  return fn(node, graph);
}
