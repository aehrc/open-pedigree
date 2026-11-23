import AbstractNode from 'pedigree/view/abstractNode';
import AbstractPersonVisuals from 'pedigree/view/abstractPersonVisuals';

export default class AbstractPerson extends AbstractNode {
  // Static slot to thread gender through super() call into _generateGraphics
  static _pendingGender: any = null;

  _gender: any;
  _isAdopted: any;
  _isAdoptedOut: any;

  constructor(x: any, y: any, gender: any, id: any) {
    AbstractPerson._pendingGender = gender;
    super(x, y, id);
    this._isAdopted = false;
    this._isAdoptedOut = false;
  }

  _generateGraphics(x: any, y: any): any {
    // 'this' is accessible here because we are called from within super()'s constructor.
    // _gender must be set before AbstractPersonVisuals constructor calls getGender().
    this._gender = this.parseGender(AbstractPerson._pendingGender);
    this._type = 'AbstractPerson';
    return new AbstractPersonVisuals(this, x, y);
  }

  parseGender(gender: any): any {
    return gender.toUpperCase() == 'M' || gender.toUpperCase() == 'F' ? gender.toUpperCase() : 'U';
  }

  getGender(): any {
    return this._gender;
  }

  isPersonGroup(): boolean {
    return this._type == 'PersonGroup';
  }

  setGender(gender: any): void {
    gender = this.parseGender(gender);
    if (this._gender != gender) {
      this._gender = gender;
      this.getGraphics().setGenderGraphics();
      this.getGraphics().getHoverBox().regenerateHandles();
      this.getGraphics().getHoverBox().regenerateButtons();
    }
  }

  /**
   * Adopted in: brought into the family drawn (the parents drawn, if any, are adoptive). Adopted
   * in and adopted out exclude each other: setting one clears the other.
   */
  setAdopted(isAdopted: any): void {
    this._isAdopted = !!isAdopted;
    if (this._isAdopted) {
      this._isAdoptedOut = false;
    }
    this._updateAdoptedShape();
  }

  isAdopted(): any {
    return this._isAdopted;
  }

  getAdopted(): any {
    return this.isAdopted();
  }

  /** Adopted out: born into the family drawn and adopted elsewhere (the parents drawn are birth parents). */
  setAdoptedOut(isAdoptedOut: any): void {
    this._isAdoptedOut = !!isAdoptedOut;
    if (this._isAdoptedOut) {
      this._isAdopted = false;
    }
    this._updateAdoptedShape();
  }

  isAdoptedOut(): any {
    return this._isAdoptedOut;
  }

  getAdoptedOut(): any {
    return this.isAdoptedOut();
  }

  /** The adoption direction as a code: 'in', 'out', or '' (not adopted). */
  getAdoption(): string {
    return this._isAdopted ? 'in' : (this._isAdoptedOut ? 'out' : '');
  }

  /** Sets the direction from a code: 'in' or 'out'; any other value means not adopted. */
  setAdoption(code: any): void {
    if (code === 'in') {
      this.setAdopted(true);
    } else if (code === 'out') {
      this.setAdoptedOut(true);
    } else {
      this._isAdopted = false;
      this._isAdoptedOut = false;
      this._updateAdoptedShape();
    }
  }

  // Brackets for either direction.
  _updateAdoptedShape(): void {
    if (this._isAdopted || this._isAdoptedOut) {
      this.getGraphics().drawAdoptedShape();
    } else {
      this.getGraphics().removeAdoptedShape();
    }
  }

  getProperties(): any {
    const info = super.getProperties();
    info['gender'] = this.getGender();
    return info;
  }

  assignProperties(properties: any): any {
    if (!super.assignProperties(properties)) {
      return false;
    }
    if (!properties.gender) {
      return false;
    }
    if (this.getGender() != this.parseGender(properties.gender)) {
      this.setGender(properties.gender);
    }
    return true;
  }
}
