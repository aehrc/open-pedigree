import AbstractTerminology from 'pedigree/terminology/abstractTerminology';

export default class AbstractTerm {
  _type: any;
  _originalId: any;
  _isUnknown: any;
  _id: any;
  _name: any;

  constructor(type: any, id: any, name: any, terminology: any, callWhenReady: any) {
    this._type = type;
    this._originalId = id;
    this._isUnknown = false;
    if (terminology) {
      const sanitizedId = terminology.sanitizeID(id);
      const desanitizedId = terminology.desanitizeID(id);
      if (name == null && !terminology.isValidID(desanitizedId)) {
        name = desanitizedId;
        this._isUnknown = true;
      }

      this._id = sanitizedId;
      this._name = name ? name : 'loading...';

      if (!name && callWhenReady) {
        this._isUnknown = true;
        this.load(terminology, callWhenReady);
      }
    } else {
      console.log('Creating term with no terminology');
      const tempTerminology = new AbstractTerminology(type, /.*/, 20);
      this._id = tempTerminology.sanitizeID(id);
      this._name = tempTerminology.desanitizeID(id);
      this._isUnknown = true;
      if (callWhenReady) {
        callWhenReady();
      }
    }
  }

  getTermType(): any {
    return this._type;
  }

  getID(): any {
    return this._id;
  }

  getName(): any {
    return this._name;
  }

  isUnknown(): any {
    return this._isUnknown;
  }

  load(terminology: any, callWhenReady: any): void {
    terminology.lookupTerm(
      this._id,
      (id: any, name: any) => (this._name = name),
      (err: any) => {
        this._name = terminology.desanitizeID(this._originalId);
        this._isUnknown = true;
      },
      callWhenReady
    );
  }
}
