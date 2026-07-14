import { ChildlessBehavior } from 'pedigree/view/abstractNode';
import AbstractPerson from 'pedigree/view/abstractPerson';
import PersonVisuals from 'pedigree/view/personVisuals';

declare const editor: any;

/**
 * Person is a class representing any AbstractPerson that has sufficient information to be
 * displayed on the final pedigree graph (printed or exported). Person objects
 * contain information about disorders, age and other relevant properties, as well
 * as graphical data to visualize this information.
 *
 * @class Person
 * @constructor
 * @extends AbstractPerson
 * @param {Number} x X coordinate on the Raphael canvas at which the node drawing will be centered
 * @param {Number} y Y coordinate on the Raphael canvas at which the node drawing will be centered
 * @param {String} gender 'M', 'F' or 'U' depending on the gender
 * @param {Number} id Unique ID number
 * @param {Boolean} isProband True if this person is the proband
 */
export default class Person extends AbstractPerson {
  // Static slot to thread isProband through super() call into _generateGraphics
  static _pendingIsProband: any = null;

  _isProband: any;
  _firstName: any;
  _lastName: any;
  _lastNameAtBirth: any;
  _birthDate: any;
  _deathDate: any;
  _conceptionDate: any;
  _gestationAge: any;
  _isAdopted: any;
  _externalID: any;
  _lifeStatus: any;
  _childlessStatus: any;
  _carrierStatus: any;
  _disorders: any;
  _phenotypes: any;
  _candidateGenes: any;
  _twinGroup: any;
  _monozygotic: any;
  _evaluated: any;
  _lostContact: any;
  _linkedPatientRef: any;

  constructor(x: any, y: any, id: any, properties: any) {
    Person._pendingIsProband = (id === 0);
    const gender = properties.hasOwnProperty('gender') ? properties['gender'] : 'U';
    super(x, y, gender, id);
    // need to assign after super() and explicitly pass gender to super()
    // because changing properties requires a redraw, which relies on gender
    // shapes being there already
    this.assignProperties(properties);
  }

  /**
   * Initializes the object responsible for creating graphics for this Person
   *
   * @method _generateGraphics
   * @param {Number} x X coordinate on the Raphael canvas at which the node drawing will be centered
   * @param {Number} y Y coordinate on the Raphael canvas at which the node drawing will be centered
   * @return {PersonVisuals}
   * @private
   */
  _generateGraphics(x: any, y: any): any {
    // 'this' is accessible here because we are called from within super()'s constructor.
    this._isProband = Person._pendingIsProband;
    this._gender = this.parseGender(AbstractPerson._pendingGender);
    this._type = 'Person';
    this._setDefault();
    return new PersonVisuals(this, x, y);
  }

  _setDefault(): void {
    this._firstName = '';
    this._lastName = '';
    this._lastNameAtBirth = '';
    this._birthDate = '';
    this._deathDate = '';
    this._conceptionDate = '';
    this._gestationAge = '';
    this._isAdopted = false;
    this._externalID = '';
    this._lifeStatus = 'alive';
    this._childlessStatus = null;
    this._carrierStatus = '';
    this._disorders = [];
    this._phenotypes = [];
    this._candidateGenes = [];
    this._twinGroup = null;
    this._monozygotic = false;
    this._evaluated = false;
    this._lostContact = false;
    this._linkedPatientRef = '';
  }

  /**
   * Returns True if this node is the proband (i.e. the main patient)
   *
   * @method isProband
   * @return {Boolean}
   */
  isProband(): boolean {
    return this._isProband;
  }

  getLinkedPatientRef(): string {
    return this._linkedPatientRef || '';
  }

  setLinkedPatientRef(ref: string): void {
    this._linkedPatientRef = ref;
  }

  /**
   * Returns the first name of this Person
   *
   * @method getFirstName
   * @return {String}
   */
  getFirstName(): any {
    return this._firstName;
  }

  /**
   * Replaces the first name of this Person with firstName, and displays the label
   *
   * @method setFirstName
   * @param firstName
   */
  setFirstName(firstName: any): void {
    firstName && (firstName = firstName.charAt(0).toUpperCase() + firstName.slice(1));
    this._firstName = firstName;
    this.getGraphics().updateNameLabel();
  }

  /**
   * Returns the last name of this Person
   *
   * @method getLastName
   * @return {String}
   */
  getLastName(): any {
    return this._lastName;
  }

  /**
   * Replaces the last name of this Person with lastName, and displays the label
   *
   * @method setLastName
   * @param lastName
   */
  setLastName(lastName: any): any {
    lastName && (lastName = lastName.charAt(0).toUpperCase() + lastName.slice(1));
    this._lastName = lastName;
    this.getGraphics().updateNameLabel();
    return lastName;
  }

  /**
   * Returns the externalID of this Person
   *
   * @method getExternalID
   * @return {String}
   */
  getExternalID(): any {
    return this._externalID;
  }

  /**
   * Replaces the external ID of this Person with the given ID, and displays the label
   *
   * @method setExternalID
   * @param externalID
   */
  setExternalID(externalID: any): void {
    this._externalID = externalID;
    this.getGraphics().updateExternalIDLabel();
  }

  /**
   * Replaces free-form comments associated with the node and redraws the label
   *
   * @method setComments
   * @param comment
   */
  setComments(comment: any): void {
    if (comment !== this.getComments()) {
      super.setComments(comment);
      this.getGraphics().updateCommentsLabel();
    }
  }

  /**
   * Sets the type of twin
   *
   * @method setMonozygotic
   */
  setMonozygotic(monozygotic: any): void {
    if (monozygotic === this._monozygotic) {
      return;
    }
    this._monozygotic = monozygotic;
  }

  /**
   * Returns the documented evaluation status
   *
   * @method getEvaluated
   * @return {Boolean}
   */
  getEvaluated(): any {
    return this._evaluated;
  }

  /**
   * Sets the documented evaluation status
   *
   * @method setEvaluated
   */
  setEvaluated(evaluationStatus: any): void {
    if (evaluationStatus === this._evaluated) {
      return;
    }
    this._evaluated = evaluationStatus;
    this.getGraphics().updateEvaluationLabel();
  }

  /**
   * Returns the "in contact" status of this node.
   * "False" means proband has lost contact with this individual
   *
   * @method getLostContact
   * @return {Boolean}
   */
  getLostContact(): any {
    return this._lostContact;
  }

  /**
   * Sets the "in contact" status of this node
   *
   * @method setLostContact
   */
  setLostContact(lostContact: any): void {
    if (lostContact === this._lostContact) {
      return;
    }
    this._lostContact = lostContact;
  }

  /**
   * Returns the type of twin: monozygotic or not
   * (always false for non-twins)
   *
   * @method getMonozygotic
   * @return {Boolean}
   */
  getMonozygotic(): any {
    return this._monozygotic;
  }

  /**
   * Assigns this node to the given twin group
   * (a twin group is all the twins from a given pregnancy)
   *
   * @method setTwinGroup
   */
  setTwinGroup(groupId: any): void {
    this._twinGroup = groupId;
  }

  /**
   * Returns the status of this Person
   *
   * @method getLifeStatus
   * @return {String} "alive", "deceased", "stillborn", "unborn", "aborted" or "miscarriage"
   */
  getLifeStatus(): any {
    return this._lifeStatus;
  }

  /**
   * Returns True if this node's status is not 'alive' or 'deceased'.
   *
   * @method isFetus
   * @return {Boolean}
   */
  isFetus(): boolean {
    return (this.getLifeStatus() !== 'alive' && this.getLifeStatus() !== 'deceased');
  }

  /**
   * Returns True is status is 'unborn', 'stillborn', 'aborted', 'miscarriage', 'alive' or 'deceased'
   *
   * @method _isValidLifeStatus
   * @param {String} status
   * @returns {boolean}
   * @private
   */
  _isValidLifeStatus(status: any): boolean {
    return (status === 'unborn' || status === 'stillborn'
      || status === 'aborted' || status === 'miscarriage'
      || status === 'alive' || status === 'deceased');
  }

  /**
   * Changes the life status of this Person to newStatus
   *
   * @method setLifeStatus
   * @param {String} newStatus "alive", "deceased", "stillborn", "unborn", "aborted" or "miscarriage"
   */
  setLifeStatus(newStatus: any): void {
    if (this._isValidLifeStatus(newStatus)) {
      var oldStatus = this._lifeStatus;

      this._lifeStatus = newStatus;

      (newStatus !== 'deceased') && this.setDeathDate('');
      (newStatus === 'alive') && this.setGestationAge();
      this.getGraphics().updateSBLabel();

      if (this.isFetus()) {
        this.setBirthDate('');
        this.setAdopted(false);
        this.setChildlessStatus(null);
      }
      this.getGraphics().updateLifeStatusShapes(oldStatus);
      this.getGraphics().getHoverBox().regenerateHandles();
      this.getGraphics().getHoverBox().regenerateButtons();
    }
  }

  /**
   * Returns the date of the conception date of this Person
   *
   * @method getConceptionDate
   * @return {Date}
   */
  getConceptionDate(): any {
    return this._conceptionDate;
  }

  /**
   * Replaces the conception date with newDate
   *
   * @method setConceptionDate
   * @param {Date} newDate Date of conception
   */
  setConceptionDate(newDate: any): void {
    this._conceptionDate = newDate ? (new Date(newDate)) : '';
    this.getGraphics().updateAgeLabel();
  }

  /**
   * Returns the number of weeks since conception
   *
   * @method getGestationAge
   * @return {Number}
   */
  getGestationAge(): any {
    if (this.getLifeStatus() === 'unborn' && this.getConceptionDate()) {
      var oneWeek = 1000 * 60 * 60 * 24 * 7,
        lastDay = new Date();
      return Math.round((lastDay.getTime() - this.getConceptionDate().getTime()) / oneWeek);
    } else if (this.isFetus()) {
      return this._gestationAge;
    } else {
      return null;
    }
  }

  /**
   * Updates the conception age of the Person given the number of weeks passed since conception
   *
   * @method setGestationAge
   * @param {Number} numWeeks Greater than or equal to 0
   */
  setGestationAge(numWeeks?: any): void {
    try {
      numWeeks = parseInt(numWeeks);
    } catch (err) {
      numWeeks = '';
    }
    if (numWeeks) {
      this._gestationAge = numWeeks;
      var daysAgo = numWeeks * 7,
        d = new Date();
      d.setDate(d.getDate() - daysAgo);
      this.setConceptionDate(d);
    } else {
      this._gestationAge = '';
      this.setConceptionDate(null);
    }
    this.getGraphics().updateAgeLabel();
  }

  /**
   * Returns the the birth date of this Person
   *
   * @method getBirthDate
   * @return {Date}
   */
  getBirthDate(): any {
    return this._birthDate;
  }

  /**
   * Replaces the birth date with newDate
   *
   * @method setBirthDate
   * @param {Date} newDate Must be earlier date than deathDate and a later than conception date
   */
  setBirthDate(newDate: any): void {
    newDate = newDate ? (new Date(newDate)) : '';
    if (!newDate || !this.getDeathDate() || newDate.getTime() < this.getDeathDate().getTime()) {
      this._birthDate = newDate;
      this.getGraphics().updateAgeLabel();
    }
  }

  /**
   * Returns the death date of this Person
   *
   * @method getDeathDate
   * @return {Date}
   */
  getDeathDate(): any {
    return this._deathDate;
  }

  /**
   * Replaces the death date with deathDate
   *
   * @method setDeathDate
   * @param {Date} deathDate Must be a later date than birthDate
   */
  setDeathDate(deathDate: any): any {
    deathDate = deathDate ? (new Date(deathDate)) : '';
    // only set death date if it happens to be after the birth date, or there is no birth or death date
    if (!deathDate || !this.getBirthDate() || deathDate.getTime() > this.getBirthDate().getTime()) {
      this._deathDate = deathDate;
      this._deathDate && (this.getLifeStatus() === 'alive') && this.setLifeStatus('deceased');
    }
    this.getGraphics().updateAgeLabel();
    return this.getDeathDate();
  }

  _isValidCarrierStatus(status: any): boolean {
    return (status === '' || status === 'carrier'
      || status === 'affected' || status === 'presymptomatic');
  }

  /**
   * Sets the global disorder carrier status for this Person
   *
   * @method setCarrier
   * @param status One of {'', 'carrier', 'affected', 'presymptomatic'}
   */
  setCarrierStatus(status?: any): void {
    var numDisorders = this.getDisorders().length;

    if (status === undefined || status === null) {
      if (numDisorders === 0) {
        status = '';
      } else {
        status = this.getCarrierStatus();
        if (status === '') {
          status = 'affected';
        }
      }
    }

    if (!this._isValidCarrierStatus(status)) {
      return;
    }

    if (numDisorders > 0 && status === '') {
      if (numDisorders === 1 && this.getDisorders()[0] === 'affected') {
        this.removeDisorder('affected');
        this.getGraphics().updateDisorderShapes();
      } else {
        status = 'affected';
      }
    } else if (numDisorders === 0 && status === 'affected') {
      this.addDisorder('affected');
      this.getGraphics().updateDisorderShapes();
    }

    if (status !== this._carrierStatus) {
      this._carrierStatus = status;
      this.getGraphics().updateCarrierGraphic();
    }
  }

  /**
   * Returns the global disorder carrier status for this person.
   *
   * @method getCarrier
   * @return {String} Disorder carrier status
   */
  getCarrierStatus(): any {
    return this._carrierStatus;
  }

  /**
   * Returns the list of all colors associated with the node
   * (e.g. all colors of all disorders and all colors of all the genes)
   * @method getAllNodeColors
   * @return {[String]}
   */
  getAllNodeColors(): any {
    let i;
    const result: any[] = [];
    for (i = 0; i < this.getDisorders().length; i++) {
      result.push(editor.getDisorderLegend().getObjectColor(this.getDisorders()[i]));
    }
    for (i = 0; i < this.getGenes().length; i++) {
      result.push(editor.getGeneLegend().getObjectColor(this.getGenes()[i]));
    }
    return result;
  }

  /**
   * Returns a list of disorders of this person.
   *
   * @method getDisorders
   * @return {[String]} List of disorder IDs.
   */
  getDisorders(): any {
    return this._disorders;
  }

  /**
   * Returns a list of disorders of this person, with non-scrambled IDs
   *
   * @method getDisordersForExport
   * @return {Array} List of human-readable versions of disorder IDs
   */
  getDisordersForExport(): any {
    var legend = editor.getDisorderLegend();
    var exportDisorders = this._disorders.slice(0);
    for (var i = 0; i < exportDisorders.length; i++) {
      exportDisorders[i] = legend.desanitizeID(exportDisorders[i]);
    }
    return exportDisorders;
  }

  /**
   * Adds disorder to the list of this node's disorders and updates the Legend.
   *
   * @method addDisorder
   * @param {DisorderTerm} disorder Disorder object or a free-text name string
   */
  addDisorder(disorder: any): void {
    if (typeof disorder != 'object') {
      disorder = editor.getDisorderLegend().getDisorder(disorder);
    }
    if (!this.hasDisorder(disorder.getID())) {
      editor.getDisorderLegend().addCase(disorder.getID(), disorder.getName(), this.getID());
      this.getDisorders().push(disorder.getID());
    } else {
      alert('This person already has the specified disorder');
    }

    // if any "real" disorder has been added
    // the virtual "affected" disorder should be automatically removed
    if (this.getDisorders().length > 1) {
      this.removeDisorder('affected');
    }
  }

  /**
   * Removes disorder from the list of this node's disorders and updates the Legend.
   *
   * @method removeDisorder
   * @param {Number} disorderID id of the disorder to be removed
   */
  removeDisorder(disorderID: any): void {
    if (this.hasDisorder(disorderID)) {
      editor.getDisorderLegend().removeCase(disorderID, this.getID());
      this._disorders = this.getDisorders().filter((d: any) => d !== disorderID);
      this.getGraphics().updateDisorderShapes();
    } else {
      if (disorderID !== 'affected') {
        alert('This person doesn\'t have the specified disorder');
      }
    }
  }

  /**
   * Sets the list of disorders of this person to the given list
   *
   * @method setDisorders
   * @param {Array} disorders List of Disorder objects
   */
  setDisorders(disorders: any): void {
    let i;
    for (i = this.getDisorders().length - 1; i >= 0; i--) {
      this.removeDisorder(this.getDisorders()[i]);
    }
    for (i = 0; i < disorders.length; i++) {
      this.addDisorder(disorders[i]);
    }
    this.getGraphics().updateDisorderShapes();
    this.setCarrierStatus(); // update carrier status
  }

  /**
   * Returns a list of all Phenotype terms associated with the patient
   *
   * @method getPhenotypes
   * @return {Array} List of Phenotype IDs.
   */
  getPhenotypes(): any {
    return this._phenotypes;
  }

  getHPO(): any {
    return this.getPhenotypes();
  }

  /**
   * Returns a list of phenotypes of this person, with non-scrambled IDs
   *
   * @method getPhenotypesForExport
   * @return {Array} List of human-readable versions of Phenotype IDs
   */
  getPhenotypesForExport(): any {
    var legend = editor.getPhenotypeLegend();
    var exportPhenotypes = this._phenotypes.slice(0);
    for (var i = 0; i < exportPhenotypes.length; i++) {
      exportPhenotypes[i] = legend.desanitizeID(exportPhenotypes[i]);
    }
    return exportPhenotypes;
  }

  /**
   * Adds Phenotype term to the list of this node's phenotypes and updates the Legend.
   *
   * @method addPhenotype
   * @param {PhenotypeTerm} phenotype PhenotypeTerm object or a free-text name string
   */
  addPhenotype(phenotype: any): void {
    if (typeof phenotype != 'object') {
      phenotype = editor.getPhenotypeLegend().getTerm(phenotype);
    }
    if (!this.hasPhenotype(phenotype.getID())) {
      editor.getPhenotypeLegend().addCase(phenotype.getID(), phenotype.getName(), this.getID());
      this.getPhenotypes().push(phenotype.getID());
    } else {
      alert('This person already has the specified phenotype');
    }
  }

  /**
   * Removes Phenotype term from the list of this node's terms and updates the Legend.
   *
   * @method removePhenotype
   * @param {Number} phenotypeID id of the term to be removed
   */
  removePhenotype(phenotypeID: any): void {
    if (this.hasPhenotype(phenotypeID)) {
      editor.getPhenotypeLegend().removeCase(phenotypeID, this.getID());
      this._phenotypes = this.getPhenotypes().without(phenotypeID);
    } else {
      alert('This person doesn\'t have the specified Phenotype term');
    }
  }

  setHPO(phenotypes: any): void {
    this.setPhenotypes(phenotypes);
  }

  /**
   * Sets the list of Phenotype terms of this person to the given list
   *
   * @method setPhenotypes
   * @param {Array} phenotypes List of PhenotypeTerm objects
   */
  setPhenotypes(phenotypes: any): void {
    let i;
    if (!Array.isArray(phenotypes)) {
      console.log('Warning: trying to setPhenotypes with non-array: ', phenotypes);
      return;
    }
    for (i = this.getPhenotypes().length - 1; i >= 0; i--) {
      this.removePhenotype(this.getPhenotypes()[i]);
    }
    for (i = 0; i < phenotypes.length; i++) {
      this.addPhenotype(phenotypes[i]);
    }
    this.getGraphics().updateDisorderShapes();
  }

  /**
   * @method hasPhenotype
   * @param {Number} id Term ID, taken from the Phenotype database
   */
  hasPhenotype(id: any): boolean {
    return (this.getPhenotypes().indexOf(id) !== -1);
  }

  /**
   * Adds gene to the list of this node's candidate genes
   *
   * @method addGene
   */
  addGene(geneID: any): void {
    if (typeof geneID != 'object') {
      geneID = editor.getGeneLegend().getTerm(geneID);
    }
    if (!this.hasGene(geneID.getID())) {
      editor.getGeneLegend().addCase(geneID.getID(), geneID.getName(), this.getID());
      this.getGenes().push(geneID.getID());
    } else {
      console.log('This person already has the specified gene');
    }
  }

  /**
   * Removes gene from the list of this node's candidate genes
   *
   * @method removeGene
   */
  removeGene(geneID: any): void {
    if (this.hasGene(geneID)) {
      editor.getGeneLegend().removeCase(geneID, this.getID());
      this._candidateGenes = this.getGenes().without(geneID);
    } else {
      console.log('This person doesn\'t have the specified gene');
    }
  }

  /**
   * Sets the list of candidate genes of this person to the given list
   *
   * @method setGenes
   * @param {Array} genes List of gene names (as strings)
   */
  setGenes(genes: any): void {
    if (!Array.isArray(genes)) {
      console.log('Warning: trying to setGenes with non-array: ', genes);
      return;
    }
    for (var i = this.getGenes().length - 1; i >= 0; i--) {
      this.removeGene(this.getGenes()[i]);
    }
    for (var j = 0; j < genes.length; j++) {
      this.addGene(genes[j]);
    }
    this.getGraphics().updateDisorderShapes();
  }

  /**
   * Returns a list of candidate genes for this person.
   *
   * @method getGenes
   * @return {Array} List of gene names.
   */
  getGenes(): any {
    return this._candidateGenes;
  }

  /**
   * Returns a list of genes of this person, with non-scrambled IDs
   *
   * @method getGenesForExport
   * @return {Array} List of human-readable versions of gene IDs
   */
  getGenesForExport(): any {
    var legend = editor.getGeneLegend();
    var exportGenes = this._candidateGenes.slice(0);
    for (var i = 0; i < exportGenes.length; i++) {
      exportGenes[i] = legend.desanitizeID(exportGenes[i]);
    }
    return exportGenes;
  }

  /**
   * @method hasGene
   * @param id Term ID, taken from the phenotype database
   */
  hasGene(id: any): boolean {
    return (this.getGenes().indexOf(id) != -1);
  }

  /**
   * Removes the node and its visuals.
   *
   * @method remove
   */
  remove(): void {
    this.setDisorders([]);  // remove disorders from the legend
    this.setPhenotypes([]);
    this.setGenes([]);
    super.remove();
  }

  /**
   * Returns disorder with given id if this person has it. Returns null otherwise.
   *
   * @method hasDisorder
   * @param {Number} id Disorder ID, taken from the OMIM database
   * @return {Boolean}
   */
  hasDisorder(id: any): boolean {
    return (this.getDisorders().indexOf(id) !== -1);
  }

  /**
   * Changes the childless status of this Person. Nullifies the status if the given status is not
   * "childless" or "infertile". Modifies the status of the partnerships as well.
   *
   * @method setChildlessStatus
   * @param {String} status Can be "childless", "infertile" or null
   */
  setChildlessStatus(status: any): any {
    if (!this.isValidChildlessStatus(status)) {
      status = null;
    }
    if (status !== this.getChildlessStatus()) {
      this._childlessStatus = status;
      this.getGraphics().updateChildlessShapes();
      this.getGraphics().getHoverBox().regenerateHandles();
    }
    return this.getChildlessStatus();
  }

  /**
   * Returns an object (to be accepted by the menu) with information about this Person
   *
   * @method getSummary
   * @return {Object} Summary object for the menu
   */
  getSummary(): any {
    var onceAlive = editor.getGraph().hasRelationships(this.getID());
    var inactiveStates = onceAlive ? ['unborn', 'aborted', 'miscarriage', 'stillborn'] : false;

    var inactiveGenders: any = false;
    var genderSet = editor.getGraph().getPossibleGenders(this.getID());
    for (var gender in genderSet) {
      if (genderSet.hasOwnProperty(gender)) {
        if (!genderSet[gender]) {
          inactiveGenders = [gender];
        }
      }
    }

    var childlessInactive = this.isFetus();
    var disorders: any[] = [];
    this.getDisorders().forEach(function(disorder: any) {
      var disorderName = editor.getDisorderLegend().getDisorder(disorder).getName();
      disorders.push({id: disorder, value: disorderName});
    });
    var phenotypeTerms: any[] = [];
    this.getPhenotypes().forEach(function(phenotype: any) {
      var termName = editor.getPhenotypeLegend().getTerm(phenotype).getName();
      phenotypeTerms.push({id: phenotype, value: termName});
    });

    var cantChangeAdopted = this.isFetus() || editor.getGraph().hasToBeAdopted(this.getID());

    var inactiveMonozygothic = true;
    var disableMonozygothic  = true;
    var twins = editor.getGraph().getAllTwinsSortedByOrder(this.getID());
    if (twins.length > 1) {
      // check that there are twins and that all twins
      // have the same gender, otherwise can't be monozygothic
      inactiveMonozygothic = false;
      disableMonozygothic  = false;
      for (var i = 0; i < twins.length; i++) {
        if (editor.getGraph().getGender(twins[i]) !== this.getGender()) {
          disableMonozygothic = true;
          break;
        }
      }
    }

    var inactiveCarriers: any[] = [];
    if (disorders.length > 0) {
      if (disorders.length !== 1 || disorders[0].id !== 'affected') {
        inactiveCarriers = [''];
      }
    }
    if (this.getLifeStatus() === 'aborted' || this.getLifeStatus() === 'miscarriage') {
      inactiveCarriers.push('presymptomatic');
    }

    var inactiveLostContact = this.isProband() || !editor.getGraph().isRelatedToProband(this.getID());

    return {
      identifier:      {value : this.getID()},
      first_name:      {value : this.getFirstName()},
      last_name:       {value : this.getLastName()},
      external_id:     {value : this.getExternalID()},
      gender:          {value : this.getGender(), inactive: inactiveGenders},
      date_of_birth:   {value : this.getBirthDate(), inactive: this.isFetus()},
      carrier:         {value : this.getCarrierStatus(), disabled: inactiveCarriers},
      disorders:       {value : disorders},
      candidate_genes: {value : this.getGenes()},
      adopted:         {value : this.isAdopted(), inactive: cantChangeAdopted},
      state:           {value : this.getLifeStatus(), inactive: inactiveStates},
      date_of_death:   {value : this.getDeathDate(), inactive: this.isFetus()},
      comments:        {value : this.getComments(), inactive: false},
      gestation_age:   {value : this.getGestationAge(), inactive : !this.isFetus()},
      childlessSelect: {value : this.getChildlessStatus() ? this.getChildlessStatus() : 'none', inactive : childlessInactive},
      placeholder:     {value : false, inactive: true},
      monozygotic:     {value : this.getMonozygotic(), inactive: inactiveMonozygothic, disabled: disableMonozygothic},
      evaluated:       {value : this.getEvaluated()},
      hpo_positive:    {value : phenotypeTerms},
      nocontact:       {value : this.getLostContact(), inactive: inactiveLostContact},
      link_patient:    {value: this.getLinkedPatientRef(), inactive: !((editor as any).getPatientProvider().canLinkPatient(this.getID()))},
      import_from_record: {value: this.getLinkedPatientRef(), inactive: !((editor as any).getPatientProvider().canImportClinicalData() && !!this.getLinkedPatientRef())}
    };
  }

  /**
   * Returns an object containing all the properties of this node
   * except id, x, y & type
   *
   * @method getProperties
   * @return {Object} in the form
   *
   {
     property: value
   }
   */
  getProperties(): any {
    // note: properties equivalent to default are not set
    var info = super.getProperties();
    if (this.getFirstName() !== '') {
      info['fName'] = this.getFirstName();
    }
    if (this.getLastName() !== '') {
      info['lName'] = this.getLastName();
    }
    if (this.getExternalID() !== '') {
      info['externalID'] = this.getExternalID();
    }
    if (this.getBirthDate() !== '') {
      info['dob'] = this.getBirthDate().toDateString();
    }
    if (this.isAdopted()) {
      info['isAdopted'] = this.isAdopted();
    }
    if (this.getLifeStatus() !== 'alive') {
      info['lifeStatus'] = this.getLifeStatus();
    }
    if (this.getDeathDate() !== '') {
      info['dod'] = this.getDeathDate().toDateString();
    }
    if (this.getGestationAge() != null) {
      info['gestationAge'] = this.getGestationAge();
    }
    if (this.getChildlessStatus() != null) {
      info['childlessStatus'] = this.getChildlessStatus();
    }
    if (this.getDisorders().length > 0) {
      info['disorders'] = this.getDisordersForExport();
    }
    if (this.getPhenotypes().length > 0) {
      info['hpoTerms'] = this.getPhenotypesForExport();
    }
    if (this.getGenes().length > 0) {
      info['candidateGenes'] = this.getGenesForExport();
    }
    if (this._twinGroup !== null) {
      info['twinGroup'] = this._twinGroup;
    }
    if (this._monozygotic) {
      info['monozygotic'] = this._monozygotic;
    }
    if (this._evaluated) {
      info['evaluated'] = this._evaluated;
    }
    if (this._carrierStatus) {
      info['carrierStatus'] = this._carrierStatus;
    }
    if (this.getLostContact()) {
      info['lostContact'] = this.getLostContact();
    }
    if (this.getLinkedPatientRef() != '') {
      info['linkedPatientRef'] = this.getLinkedPatientRef();
    }
    return info;
  }

  /**
   * Applies the properties found in info to this node.
   *
   * @method assignProperties
   * @param info Object
   * @return {Boolean} True if info was successfully assigned
   */
  assignProperties(info: any): any {
    this._setDefault();

    if (super.assignProperties(info)) {
      if (info.fName && this.getFirstName() !== info.fName) {
        this.setFirstName(info.fName);
      }
      if (info.lName && this.getLastName() !== info.lName) {
        this.setLastName(info.lName);
      }
      if (info.externalID && this.getExternalID() !== info.externalID) {
        this.setExternalID(info.externalID);
      }
      if (info.dob && this.getBirthDate() !== info.dob) {
        this.setBirthDate(info.dob);
      }
      if (info.disorders) {
        this.setDisorders(info.disorders);
      }
      if (info.hpoTerms) {
        this.setPhenotypes(info.hpoTerms);
      }
      if (info.candidateGenes) {
        this.setGenes(info.candidateGenes);
      }
      if (info.hasOwnProperty('isAdopted') && this.isAdopted() !== info.isAdopted) {
        this.setAdopted(info.isAdopted);
      }
      if (info.hasOwnProperty('lifeStatus') && this.getLifeStatus() !== info.lifeStatus) {
        this.setLifeStatus(info.lifeStatus);
      }
      if (info.dod && this.getDeathDate() !== info.dod) {
        this.setDeathDate(info.dod);
      }
      if (info.gestationAge && this.getGestationAge() !== info.gestationAge) {
        this.setGestationAge(info.gestationAge);
      }
      if (info.childlessStatus && this.getChildlessStatus() !== info.childlessStatus) {
        this.setChildlessStatus(info.childlessStatus);
      }
      if (info.hasOwnProperty('twinGroup') && this._twinGroup !== info.twinGroup) {
        this.setTwinGroup(info.twinGroup);
      }
      if (info.hasOwnProperty('monozygotic') && this._monozygotic !== info.monozygotic) {
        this.setMonozygotic(info.monozygotic);
      }
      if (info.hasOwnProperty('evaluated') && this._evaluated !== info.evaluated) {
        this.setEvaluated(info.evaluated);
      }
      if (info.hasOwnProperty('carrierStatus') && this._carrierStatus !== info.carrierStatus) {
        this.setCarrierStatus(info.carrierStatus);
      }
      if (info.hasOwnProperty('lostContact') && this.getLostContact() !== info.lostContact) {
        this.setLostContact(info.lostContact);
      }
      if (info.hasOwnProperty('linkedPatientRef') && this.getLinkedPatientRef() != info.linkedPatientRef) {
        this.setLinkedPatientRef(info.linkedPatientRef);
      }
      return true;
    }
    return false;
  }

  // ChildlessBehavior mixin methods
  getChildlessStatus(): any {
    return this._childlessStatus;
  }

  isValidChildlessStatus(status: any): boolean {
    return status == 'infertile' || status == 'childless';
  }
}
