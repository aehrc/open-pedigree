import DisorderTerm, { DisorderTermType } from 'pedigree/terminology/disorderTerm';
import GeneTerm, { GeneTermType } from 'pedigree/terminology/geneTerm';
import PhenotypeTerm, { PhenotypeTermType } from 'pedigree/terminology/phenotypeTerm';
import AbstractTerm from 'pedigree/terminology/abstractTerm';

export default class AbstractTerminology {
  _type: any;
  _validIdRegex: any;
  _searchCount: any;

  constructor(type: any, validIdRegex: any, searchCount: any) {
    this._type = type;
    this._validIdRegex = validIdRegex;
    this._searchCount = searchCount || 20;
  }

  getType(): any {
    return this._type;
  }

  isValidID(id: any): boolean {
    if (this._validIdRegex) {
      return this._validIdRegex.test(id);
    }
    return true;
  }

  getSearchCount(): any {
    return this._searchCount;
  }

  desanitizeID(id: any): any {
    let temp = id;
    temp = temp.replace(/_C_/g, ':');
    temp = temp.replace(/_L_/g, '(');
    temp = temp.replace(/_J_/g, ')');
    temp = temp.replace(/_D_/g, '.');
    temp = temp.replace(/_S_/g, '/');
    temp = temp.replace(/__/g, ' ');
    return temp;
  }

  sanitizeID(id: any): any {
    let temp = id;
    temp = temp.replace(/[:]/g, '_C_');
    temp = temp.replace(/[([]/g, '_L_');
    temp = temp.replace(/[)]]/g, '_J_');
    temp = temp.replace(/[.]/g, '_D_');
    temp = temp.replace(/\//g, '_S_');
    temp = temp.replace(/[^a-zA-Z0-9,;_\-*]/g, '__');
    return temp;
  }

  lookupTerm(id: any, onSuccess: any, onError: any, onComplete: any): void {
    throw 'Unimplemented method - should be using subclass';
  }

  searchForTerms(searchTerm: any, onSuccess: any, onError: any, onComplete: any): void {
    throw 'Unimplemented method - should be using subclass';
  }

  createTerm(id: any, name: any, callWhenReady: any): any {
    if (this._type === DisorderTermType) {
      return new DisorderTerm(id, name, this, callWhenReady);
    }
    if (this._type === GeneTermType) {
      return new GeneTerm(id, name, this, callWhenReady);
    }
    if (this._type === PhenotypeTermType) {
      return new PhenotypeTerm(id, name, this, callWhenReady);
    }
    console.error('No explicit class for type \'' + this._type + '\'');
    return new AbstractTerm(this._type, id, name, this, callWhenReady);
  }
}
