import AbstractTerminology from 'pedigree/terminology/abstractTerminology';
import Sifter from 'sifter';

export default class StaticTerminology extends AbstractTerminology {
  _terms: any;
  _sifter: any;
  _lookup: any;

  constructor(type: any, validIdRegex: any, searchCount: any, terms: any) {
    super(type, validIdRegex, searchCount);
    this._terms = terms;
    this._sifter = new Sifter(terms);
    this._lookup = {};
    for (const t of terms) {
      this._lookup[t.value] = t.text;
    }
  }

  lookupTerm(id: any, onSuccess: any, onError: any, onComplete: any): void {
    if (this._lookup.hasOwnProperty(id)) {
      onSuccess(id, this._lookup[id]);
    } else {
      onError('Term ' + id + ' not found');
    }
    onComplete();
  }

  searchForTerms(searchTerm: any, onSuccess: any, onError: any, onComplete: any): void {
    const foundTerms = this._sifter.search(searchTerm, {
      fields: ['text'],
      sort: [{ field: 'text', direction: 'asc' }],
      limit: this._searchCount,
    });
    const result: any[] = [];
    for (const ft of foundTerms.items) {
      result.push(this._terms[ft.id]);
    }
    onSuccess(searchTerm, result);
    if (onComplete) {
      onComplete();
    }
  }
}
