import AbstractNode from 'pedigree/view/abstractNode';
import AbstractPersonVisuals from 'pedigree/view/abstractPersonVisuals';

export default class AbstractPerson extends AbstractNode {
  // Static slot to thread gender through super() call into _generateGraphics
  static _pendingGender: any = null;

  _gender: any;
  _isAdopted: any;

  constructor(x: any, y: any, gender: any, id: any) {
    AbstractPerson._pendingGender = gender;
    super(x, y, id);
    this._isAdopted = false;
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

  setAdopted(isAdopted: any): void {
    this._isAdopted = isAdopted;
    if (isAdopted) {
      this.getGraphics().drawAdoptedShape();
    } else {
      this.getGraphics().removeAdoptedShape();
    }
  }

  isAdopted(): any {
    return this._isAdopted;
  }

  getAdopted(): any {
    return this.isAdopted();
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
