import { cloneObject, Timer } from 'pedigree/model/helpers';
import PedigreeEditorParameters from 'pedigree/pedigreeEditorParameters';

export default class Controller {
  constructor() {
    document.observe('pedigree:graph:clear',               this.handleClearGraph);
    document.observe('pedigree:undo',                      this.handleUndo);
    document.observe('pedigree:redo',                      this.handleRedo);
    document.observe('pedigree:node:remove',               this.handleRemove);
    document.observe('pedigree:node:setproperty',          this.handleSetProperty);
    document.observe('pedigree:node:modify',               this.handleModification);
    document.observe('pedigree:person:drag:newparent',     this.handlePersonDragToNewParent);
    document.observe('pedigree:person:drag:newpartner',    this.handlePersonDragToNewPartner);
    document.observe('pedigree:person:drag:newsibling',    this.handlePersonDragToNewSibling);
    document.observe('pedigree:person:newparent',          this.handlePersonNewParents);
    document.observe('pedigree:person:newsibling',         this.handlePersonNewSibling);
    document.observe('pedigree:person:newpartnerandchild', this.handlePersonNewPartnerAndChild);
    document.observe('pedigree:partnership:newchild',      this.handleRelationshipNewChild);
  }

  handleUndo(event: any): void {
    editor.getActionStack().undo();
  }

  handleRedo(event: any): void {
    editor.getActionStack().redo();
  }

  handleClearGraph(event: any): void {
    var changeSet = editor.getGraph().clearAll();
    editor.getView().applyChanges(changeSet, true);

    editor.getWorkspace().centerAroundNode(0, false);

    if (!event.memo.noUndoRedo) {
      editor.getActionStack().addState( event );
    }
  }

  handleRemove(event: any): void {
    var nodeID = event.memo.nodeID;

    var disconnectedList = editor.getGraph().getDisconnectedSetIfNodeRemoved(nodeID);

    var removeSelected = function() {
      try {
        var changeSet = editor.getGraph().removeNodes(disconnectedList);

        editor.getView().applyChanges(changeSet, true);

        var changeSet = editor.getGraph().improvePosition();
        editor.getView().applyChanges(changeSet, true);

        if (!event.memo.noUndoRedo) {
          editor.getActionStack().addState( event );
        }
      } catch(err) {
      }
    };

    if (disconnectedList.length <= 1 || event.memo.hasOwnProperty('noUndoRedo')) {
      removeSelected();
      return;
    }

    editor.getView().unmarkAll();
    for (var i = 0; i < disconnectedList.length; i++) {
      var nextHighlight = disconnectedList[i];
      editor.getView().getNode(nextHighlight).getGraphics().markPermanently();
    }

    var unhighlightSelected = function() {
      for (var i = 0; i < disconnectedList.length; i++) {
        var nextHighlight = disconnectedList[i];
        editor.getView().getNode(nextHighlight).getGraphics().unmark();
      }
    };

    if (window.confirm('All highlighted nodes will be removed. Do you want to proceed?')) {
      removeSelected();
    } else {
      unhighlightSelected();
    }
  }

  handleSetProperty(event: any): void {
    var nodeID     = event.memo.nodeID;
    var properties = event.memo.properties;
    var undoEvent  = {'eventName': event.eventName, 'memo': {'nodeID': nodeID, 'properties': cloneObject(event.memo.properties)}};

    var node    = editor.getView().getNode(nodeID);
    var changed = false;

    var twinUpdate: any = undefined;
    var needUpdateAncestors = false;
    var needUpdateRelationship = false;
    var needUpdateAllRelationships = false;

    var changedValue = false;

    for (var propertySetFunction in properties) {
      if (properties.hasOwnProperty(propertySetFunction)) {
        var propValue = properties[propertySetFunction];

        if (!Controller._validatePropertyValue( nodeID, propertySetFunction, propValue)) {
          continue;
        }

        var propertyGetFunction =  propertySetFunction.replace('set','get');
        var oldValue = node[propertyGetFunction]();
        if (oldValue == propValue) {
          continue;
        }

        if (Object.prototype.toString.call(oldValue) === '[object Array]') {
          oldValue = oldValue.slice(0);
        }

        undoEvent.memo.properties[propertySetFunction] = oldValue;

        if (propertySetFunction == 'setDeathDate' || propertySetFunction == 'setBirthDate') {
          if (propValue != '') {
            try {
              var parsedDate = new Date(propValue);
              propValue = parsedDate.toDateString();
            } catch (err) {
            }
          }
        }

        if (propertySetFunction == 'setLifeStatus') {
          undoEvent.memo.properties['setDeathDate']    = node.getDeathDate();
          undoEvent.memo.properties['setGestationAge'] = node.getGestationAge();
          undoEvent.memo.properties['setBirthDate']    = node.getBirthDate();
          undoEvent.memo.properties['setAdopted']      = node.getAdopted();
        }
        if (propertySetFunction == 'setDeathDate') {
          undoEvent.memo.properties['setLifeStatus'] = node.getLifeStatus();
        }
        if (propertySetFunction == 'setDisorders') {
          undoEvent.memo.properties['setCarrierStatus'] = node.getCarrierStatus();
        }
        if (propertySetFunction == 'setCarrierStatus') {
          undoEvent.memo.properties['setDisorders'] = node.getDisorders().slice(0);
        }

        var field = propertySetFunction.replace(/^set/, '').toLowerCase();
        node[propertySetFunction](propValue);
        document.fire(`pedigree:person:set:${field}`, {
          'node': node,
          'value': propValue,
        });

        if (propertySetFunction == 'setDisorders') {
          var newDisorders = node[propertyGetFunction]();
          if (JSON.stringify(oldValue) == JSON.stringify(newDisorders)) {
            continue;
          }
        }

        changedValue = true;

        if (propertySetFunction == 'setGender') {
          if (node.getMonozygotic()) {
            if (!twinUpdate) {
              twinUpdate = {};
            }
            twinUpdate[propertySetFunction] = propValue;
          }
        }

        if (propertySetFunction == 'setAdopted') {
          needUpdateAncestors = true;
          if (!twinUpdate) {
            twinUpdate = {};
          }
          twinUpdate[propertySetFunction] = propValue;
        }

        if (propertySetFunction == 'setMonozygotic') {
          needUpdateRelationship = true;
          if (!twinUpdate) {
            twinUpdate = {};
          }
          twinUpdate[propertySetFunction] = propValue;
        }

        if (propertySetFunction == 'setConsanguinity' || propertySetFunction == 'setBrokenStatus') {
          needUpdateRelationship = true;
        }

        if (propertySetFunction == 'setLostContact') {
          needUpdateAllRelationships = true;
        }
      }
    }

    if (twinUpdate) {
      var allTwins = editor.getGraph().getAllTwinsSortedByOrder(nodeID);
      for (var propertySetFunction in twinUpdate) {
        if (twinUpdate.hasOwnProperty(propertySetFunction)) {
          var propValue = twinUpdate[propertySetFunction];

          for (var i = 0; i < allTwins.length; i++) {
            var twin = allTwins[i];
            if (twin == nodeID) {
              continue;
            }
            var twinNode = editor.getView().getNode(twin);
            twinNode[propertySetFunction](propValue);
            var twinProperties = twinNode.getProperties();
            editor.getGraph().setProperties( twin, twinProperties );
          }
        }
      }
    }

    var allProperties = node.getProperties();
    editor.getGraph().setProperties( nodeID, allProperties );

    if (needUpdateAncestors) {
      var changeSet = editor.getGraph().updateAncestors();
      editor.getView().applyChanges(changeSet, true);
    }

    if (needUpdateAllRelationships) {
      var rels = editor.getGraph().getAllRelatedRelationships(nodeID);
      var changeSet: any = {'moved': rels};
      editor.getView().applyChanges(changeSet, true);
    }

    if (needUpdateRelationship) {
      var relID = editor.getGraph().isRelationship(nodeID) ? nodeID : editor.getGraph().getParentRelationship(nodeID);
      var changeSet: any = {'moved': [relID]};
      editor.getView().applyChanges(changeSet, true);
    }

    editor.getNodeMenu().update();

    if (!event.memo.noUndoRedo && changedValue) {
      editor.getActionStack().addState( event, undoEvent );
    }
  }

  handleModification(event: any): void {
    try {
      var nodeID        = event.memo.nodeID;
      var modifications = event.memo.modifications;

      var node = editor.getView().getNode(nodeID);

      for (var modificationType in modifications) {
        if (modifications.hasOwnProperty(modificationType)) {
          var modValue = modifications[modificationType];

          if (modificationType == 'addTwin') {
            var numNewTwins = modValue - 1;
            for (var i = 0; i < numNewTwins; i++ ) {
              var twinProperty = { 'gender': node.getGender() };
              var changeSet = editor.getGraph().addTwin( nodeID, twinProperty );
              editor.getView().applyChanges(changeSet, true);
            }
            node.assignProperties(editor.getGraph().getProperties(nodeID));
          }

          if (modificationType == 'makePlaceholder') {
            // TODO
          }
        }
      }

      if (!event.memo.noUndoRedo) {
        editor.getActionStack().addState( event );
      }

    } catch(err) {
    }
  }

  handlePersonDragToNewParent(event: any): void {
    var personID = event.memo.personID;
    var parentID = event.memo.parentID;
    if (!editor.getGraph().isPerson(personID) || !editor.getGraph().isValidID(parentID)) {
      return;
    }

    if (editor.getGraph().isChildless(parentID)) {
      editor.getController().handleSetProperty( { 'memo': { 'nodeID': personID, 'properties': { 'setAdopted': true }, 'noUndoRedo': true } } );
    }

    try {
      var changeSet = editor.getGraph().assignParent(parentID, personID);
      editor.getView().applyChanges(changeSet, true);

      if (changeSet.moved.indexOf(personID) != -1) {
        editor.getWorkspace().centerAroundNode(personID, true);
      }

      if (!event.memo.noUndoRedo) {
        editor.getActionStack().addState( event );
      }

    } catch(err) {
    }
  }

  handlePersonNewParents(event: any): any {
    var personID = event.memo.personID;
    if (!editor.getGraph().isPerson(personID)) {
      return;
    }

    var changeSet = editor.getGraph().addNewParents(personID);
    editor.getView().applyChanges(changeSet, true);

    if (!event.memo.noUndoRedo) {
      editor.getActionStack().addState( event );
    }

    return changeSet['new'][0];
  }

  handlePersonNewSibling(event: any): void {
    var personID    = event.memo.personID;
    var childParams = event.memo.childParams ? cloneObject(event.memo.childParams) : {};
    var numTwins    = event.memo.twins ? event.memo.twins : 1;
    var numPersons  = event.memo.groupSize ? event.memo.groupSize : 0;

    var parentRelationship = editor.getGraph().getParentRelationship(personID);

    if (parentRelationship === null) {
      parentRelationship = editor.getController().handlePersonNewParents( { 'memo': { 'personID': personID, 'noUndoRedo': true } } );
    }

    if (event.memo.twins) {
      var nextEvent: any = { 'nodeID': personID, 'modifications': { 'addTwin': event.memo.twins }, 'noUndoRedo': true };
      editor.getController().handleModification( { 'memo': nextEvent } );
    } else {
      var nextEvent: any = { 'partnershipID': parentRelationship, 'childParams': childParams, 'noUndoRedo': true };
      if (event.memo.groupSize) {
        nextEvent['groupSize'] = event.memo.groupSize;
      }

      editor.getController().handleRelationshipNewChild( { 'memo': nextEvent } );
    }

    if (!event.memo.noUndoRedo) {
      editor.getActionStack().addState( event );
    }
  }

  handlePersonDragToNewSibling(event: any): void {
    var sibling1 = event.memo.sibling1ID;
    var sibling2 = event.memo.sibling2ID;

    var parentRelationship = editor.getGraph().getParentRelationship(sibling1);
    if (parentRelationship == null) {
      parentRelationship = editor.getGraph().getParentRelationship(sibling2);
    }

    if (parentRelationship === null) {
      parentRelationship = editor.getController().handlePersonNewParents( { 'memo': { 'personID': sibling1, 'noUndoRedo': true } } );
    }

    if (editor.getGraph().getParentRelationship(sibling2) != parentRelationship) {
      editor.getController().handlePersonDragToNewParent( { 'memo': { 'personID': sibling2, 'parentID': parentRelationship, 'noUndoRedo': true } } );
    } else {
      editor.getController().handlePersonDragToNewParent( { 'memo': { 'personID': sibling1, 'parentID': parentRelationship, 'noUndoRedo': true } } );
    }

    if (!event.memo.noUndoRedo) {
      editor.getActionStack().addState( event );
    }
  }

  handlePersonNewPartnerAndChild(event: any): void {
    var timer = new Timer();

    try {
      var personID    = event.memo.personID;
      if (!editor.getGraph().isPerson(personID)) {
        return;
      }
      var preferLeft  = event.memo.preferLeft;
      var childParams = event.memo.childParams ? cloneObject(event.memo.childParams) : {};
      var numTwins    = event.memo.twins ? event.memo.twins : 1;
      var numPersons  = event.memo.groupSize ? event.memo.groupSize : 0;

      if (editor.getGraph().isChildless(personID)) {
        childParams['isAdopted'] = true;
      }

      if (numPersons > 0) {
        childParams['numPersons'] = numPersons;
      }

      var changeSet = editor.getGraph().addNewRelationship(personID, childParams, preferLeft, numTwins);
      editor.getView().applyChanges(changeSet, true);

      if (!event.memo.noUndoRedo) {
        editor.getActionStack().addState( event );
      }

    } catch(err) {
    }

    timer.printSinceLast('=== Total new partner+child runtime: ');
  }

  handlePersonDragToNewPartner(event: any): void {
    var personID  = event.memo.personID;
    var partnerID = event.memo.partnerID;
    if (!editor.getGraph().isPerson(personID) || !editor.getGraph().isPerson(partnerID)) {
      return;
    }

    var childProperties: any = {};
    if (editor.getGraph().isChildless(personID) || editor.getGraph().isChildless(partnerID)) {
      childProperties = { 'isAdopted': true };
    }

    var node1 = editor.getView().getNode(personID);
    var node2 = editor.getView().getNode(partnerID);

    if (node1.getGender() == 'U' && node2.getGender() != 'U') {
      var gender1 = editor.getGraph().getOppositeGender(partnerID);
      node1.setGender(gender1);
      editor.getGraph().setProperties( personID, node1.getProperties() );
    } else if (node1.getGender() != 'U' && node2.getGender() == 'U') {
      var gender2 = editor.getGraph().getOppositeGender(personID);
      node2.setGender(gender2);
      editor.getGraph().setProperties( partnerID, node2.getProperties() );
    }

    var changeSet = editor.getGraph().assignPartner(personID, partnerID, childProperties);
    editor.getView().applyChanges(changeSet, true);

    if (!event.memo.noUndoRedo) {
      editor.getActionStack().addState( event );
    }
  }

  handleRelationshipNewChild(event: any): void {
    var partnershipID = event.memo.partnershipID;
    if (!editor.getGraph().isRelationship(partnershipID)) {
      return;
    }

    var numTwins = event.memo.twins ? event.memo.twins : 1;

    var childParams = cloneObject(event.memo.childParams);
    if (editor.getGraph().isChildless(partnershipID)) {
      childParams['isAdopted'] = true;
    }

    var numPersons = event.memo.groupSize ? event.memo.groupSize : 0;
    if (numPersons > 0) {
      childParams['numPersons'] = numPersons;
    }

    var changeSet = editor.getGraph().addNewChild(partnershipID, childParams, numTwins);
    editor.getView().applyChanges(changeSet, true);

    if (!event.memo.noUndoRedo) {
      editor.getActionStack().addState( event );
    }
  }

  static _validatePropertyValue(nodeID: any, propertySetFunction: any, propValue: any): any {
    if (propertySetFunction == 'setGender') {
      var possibleGenders = editor.getGraph().getPossibleGenders(nodeID);
      return possibleGenders[propValue];
    }
    return true;
  }
}
