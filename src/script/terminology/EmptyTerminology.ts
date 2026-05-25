import AbstractTerminology from 'pedigree/terminology/abstractTerminology';

export default class EmptyTerminology extends AbstractTerminology {
  constructor(type: any, validIdRegex: any, searchCount: any) {
    super(type, validIdRegex, searchCount);
  }

  lookupTerm(id: any, onSuccess: any, onError: any, onComplete: any): void {
    onError('Empty Terminology has no terms');
    onComplete();
  }

  searchForTerms(searchTerm: any, onSuccess: any, onError: any, onComplete: any): void {
    onSuccess(searchTerm, []);
    onComplete();
  }
}
