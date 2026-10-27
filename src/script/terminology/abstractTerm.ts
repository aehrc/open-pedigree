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

  /** Gives a still-unknown term the name a saved coding confirmed for it (see Legend.seedTermName). */
  nameAs(name: any): void {
    this._name = name;
    this._isUnknown = false;
  }

  load(terminology: any, callWhenReady: any): void {
    // Unknown only while loading: a term whose name was found is known, so it's exported with its
    // coding (see DefaultFhirTerminologyHelper), not as bare text. A lookup that fails, or answers
    // without a name, hasn't found it: the term is named by its ID and stays unknown.
    const notFound = () => {
      this._name = terminology.desanitizeID(this._originalId);
      this._isUnknown = true;
    };
    terminology.lookupTerm(
      this._id,
      (id: any, name: any) => {
        if (typeof name === 'string' && name.trim() !== '') {
          this._name = name.trim();
          this._isUnknown = false;
        } else {
          notFound();
        }
      },
      (err: any) => notFound(),
      callWhenReady
    );
  }

}
