import { cloneObject, Timer } from 'pedigree/model/helpers';
import PedigreeEditorParameters from 'pedigree/pedigreeEditorParameters';

/**
 * ...
 *
 * @class Controller
 * @constructor
 */

export default class Controller {

    constructor() {
        document.addEventListener('pedigree:graph:clear',               (e) => this.handleClearGraph(e));
        document.addEventListener('pedigree:undo',                      (e) => this.handleUndo(e));
        document.addEventListener('pedigree:redo',                      (e) => this.handleRedo(e));
        document.addEventListener('pedigree:node:remove',               (e) => this.handleRemove(e));
        document.addEventListener('pedigree:node:setproperty',          (e) => this.handleSetProperty(e));
        document.addEventListener('pedigree:node:modify',               (e) => this.handleModification(e));
        document.addEventListener('pedigree:person:drag:newparent',     (e) => this.handlePersonDragToNewParent(e));
        document.addEventListener('pedigree:person:drag:newpartner',    (e) => this.handlePersonDragToNewPartner(e));
        document.addEventListener('pedigree:person:drag:newsibling',    (e) => this.handlePersonDragToNewSibling(e));
        document.addEventListener('pedigree:person:newparent',          (e) => this.handlePersonNewParents(e));
        document.addEventListener('pedigree:person:newsibling',         (e) => this.handlePersonNewSibling(e));
        document.addEventListener('pedigree:person:newpartnerandchild', (e) => this.handlePersonNewPartnerAndChild(e));
        document.addEventListener('pedigree:partnership:newchild',      (e) => this.handleRelationshipNewChild(e));
    }

    handleUndo(event: any): any {
        editor.getActionStack().undo();
    }

    handleRedo(event: any): any {
        editor.getActionStack().redo();
    }

    handleReload(event: any): any {
        editor.reloadPatient();
    }

    handleClearGraph(event: any): any {
        var changeSet = editor.getGraph().clearAll();
        editor.getView().applyChanges(changeSet, true);

        editor.getWorkspace().centerAroundNode(0, false);

        if (!event.detail?.noUndoRedo) {
            editor.getActionStack().addState( event );
        }
    }

    handleRemove(event: any): any {
        var nodeID = event.detail.nodeID;

        // get the list of affected nodes
        var disconnectedList = editor.getGraph().getDisconnectedSetIfNodeRemoved(nodeID);

        var removeSelected = function() {
            try {
                var changeSet = editor.getGraph().removeNodes(disconnectedList);

                editor.getView().applyChanges(changeSet, true);

                var changeSet2 = editor.getGraph().improvePosition();
                editor.getView().applyChanges(changeSet2, true);

                if (!event.detail?.noUndoRedo) {
                    editor.getActionStack().addState( event );
                }
            } catch(err) {
            }
        };

        // if there is only one node or this removal is done as part of an undo/redo action
        // => just remove without asking any questions or highlighting any nodes
        if (disconnectedList.length <= 1 || event.detail.hasOwnProperty('noUndoRedo')) {
            removeSelected();
            return;
        }

        // otherwise remove current highlighting and highlight all nodes which will be removed
        editor.getView().unmarkAll();
        for (var i = 0; i < disconnectedList.length; i++) {
            var nextHighlight = disconnectedList[i];
            editor.getView().getNode(nextHighlight).getGraphics().markPermanently();
        }

        var unhighlightSelected = function() {
            for (var i2 = 0; i2 < disconnectedList.length; i2++) {
                var nextHighlight2 = disconnectedList[i2];
                editor.getView().getNode(nextHighlight2).getGraphics().unmark();
            }
        };

        // ...and display a OK/Cancel dialogue, calling "removeSelected()" on OK and "unhighlightSelected" on Cancel
        if (window.confirm('All highlighted nodes will be removed. Do you want to proceed?')) {
            removeSelected();
        } else {
            unhighlightSelected();
        }
    }

    handleSetProperty(event: any): any {
        var nodeID     = event.detail.nodeID;
        var properties = event.detail.properties;
        var undoEvent  = {'eventName': event.type, 'memo': {'nodeID': nodeID, 'properties': cloneObject(event.detail.properties)}};

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

                // prepare undo event
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
                    // some browsers may not treat the date string as provided by the date widget the same way,
                    // so convert to the least common denominator which seems to be the toDateString()
                    if (propValue != '') {
                        try {
                            var parsedDate = new Date(propValue);
                            propValue = parsedDate.toDateString();
                        } catch (err) {
                            // in case date did not parse: set date exactly as provided
                        }
                    }
                }

                // sometimes UNDO includes more then the property itself: e.g. changing life status
                // from "dead" to "alive" also clears the death date. Need to add it to the "undo" event
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

                node[propertySetFunction](propValue);

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
                    // this updates the relationship lines, as well as any lines
                    // crossed by the relationship llines to maintain correct crossing graphics
                    needUpdateRelationship = true;
                }

                if (propertySetFunction == 'setLostContact') {
                    // it is hard to say which of the incoming/outgoing lines needs to be redraws/updated,
                    // so it is easier to just redraw all
                    needUpdateAllRelationships = true;
                }
            }
        }

        // some properties should be the same for all the twins. If one of those
        // was changed, need to update all the twins
        if (twinUpdate) {
            var allTwins = editor.getGraph().getAllTwinsSortedByOrder(nodeID);
            for (var propSetFunc in twinUpdate) {
                if (twinUpdate.hasOwnProperty(propSetFunc)) {
                    var twinPropValue = twinUpdate[propSetFunc];

                    for (var i = 0; i < allTwins.length; i++) {
                        var twin = allTwins[i];
                        if (twin == nodeID) {
                            continue;
                        }
                        var twinNode = editor.getView().getNode(twin);
                        twinNode[propSetFunc](twinPropValue);
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
            var changeSet2 = {'moved': rels};
            editor.getView().applyChanges(changeSet2, true);
        }

        if (needUpdateRelationship) {
            var relID = editor.getGraph().isRelationship(nodeID) ? nodeID : editor.getGraph().getParentRelationship(nodeID);
            var changeSet3 = {'moved': [relID]};
            editor.getView().applyChanges(changeSet3, true);
        }

        editor.getNodeMenu().update();  // for example, user selected a wrong gender in the nodeMenu, which
        // gets reverted back - need to select the correct one in the nodeMenu as well

        if (!event.detail?.noUndoRedo && changedValue) {
            editor.getActionStack().addState( event, undoEvent );
        }
    }

    handleModification(event: any): any {
        try {
            var nodeID        = event.detail.nodeID;
            var modifications = event.detail.modifications;

            var node = editor.getView().getNode(nodeID);

            for (var modificationType in modifications) {
                if (modifications.hasOwnProperty(modificationType)) {
                    var modValue = modifications[modificationType];

                    if (modificationType == 'addTwin') {
                        var numNewTwins = modValue - 1; // current node is one of the twins, so need to create one less
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

            if (!event.detail?.noUndoRedo) {
                editor.getActionStack().addState( event );
            }

        } catch(err) {
        }
    }

    handlePersonDragToNewParent(event: any): any {

        var personID = event.detail.personID;
        var parentID = event.detail.parentID;
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

            if (!event.detail?.noUndoRedo) {
                editor.getActionStack().addState( event );
            }

        } catch(err) {
        }
    }

    handlePersonNewParents(event: any): any {

        var personID = event.detail.personID;
        if (!editor.getGraph().isPerson(personID)) {
            return;
        }

        var changeSet = editor.getGraph().addNewParents(personID);
        editor.getView().applyChanges(changeSet, true);

        if (!event.detail?.noUndoRedo) {
            editor.getActionStack().addState( event );
        }

        return changeSet['new'][0]; // new relationship
    }

    handlePersonNewSibling(event: any): any {

        // { "personID": id, "childParams": data.params.parameters, "preferLeft": false };
        var personID    = event.detail.personID;
        var childParams = event.detail.childParams ? cloneObject(event.detail.childParams) : {};
        var numTwins    = event.detail.twins ? event.detail.twins : 1;
        var numPersons  = event.detail.groupSize ? event.detail.groupSize : 0;

        var parentRelationship = editor.getGraph().getParentRelationship(personID);

        if (parentRelationship === null) {
            // need to add new parents
            parentRelationship = editor.getController().handlePersonNewParents( { 'memo': { 'personID': personID, 'noUndoRedo': true } } );
        }

        if (event.detail.twins) {
            var nextEvent = { 'nodeID': personID, 'modifications': { 'addTwin': event.detail.twins }, 'noUndoRedo': true };
            editor.getController().handleModification( { 'memo': nextEvent } );
        } else {
            var nextEvent2 = { 'partnershipID': parentRelationship, 'childParams': childParams, 'noUndoRedo': true } as any;
            if (event.detail.groupSize) {
                nextEvent2['groupSize'] = event.detail.groupSize;
            }

            editor.getController().handleRelationshipNewChild( { 'memo': nextEvent2 } );
        }

        if (!event.detail?.noUndoRedo) {
            editor.getActionStack().addState( event );
        }
    }

    handlePersonDragToNewSibling(event: any): any {

        var sibling1 = event.detail.sibling1ID;
        var sibling2 = event.detail.sibling2ID;

        var parentRelationship = editor.getGraph().getParentRelationship(sibling1);
        if (parentRelationship == null) {
            parentRelationship = editor.getGraph().getParentRelationship(sibling2);
        }

        if (parentRelationship === null) {
            // need to add new parents
            parentRelationship = editor.getController().handlePersonNewParents( { 'memo': { 'personID': sibling1, 'noUndoRedo': true } } );
        }

        if (editor.getGraph().getParentRelationship(sibling2) != parentRelationship) {
            // assign sibling 2 to this relationship: covers the case when none have parents or sibling1 has parents
            editor.getController().handlePersonDragToNewParent( { 'memo': { 'personID': sibling2, 'parentID': parentRelationship, 'noUndoRedo': true } } );
        } else {
            // assign sibling 1 to this relationship
            editor.getController().handlePersonDragToNewParent( { 'memo': { 'personID': sibling1, 'parentID': parentRelationship, 'noUndoRedo': true } } );
        }

        if (!event.detail?.noUndoRedo) {
            editor.getActionStack().addState( event );
        }
    }

    handlePersonNewPartnerAndChild(event: any): any {
        var timer = new Timer();

        try {

            var personID    = event.detail.personID;
            if (!editor.getGraph().isPerson(personID)) {
                return;
            }
            var preferLeft  = event.detail.preferLeft;
            var childParams = event.detail.childParams ? cloneObject(event.detail.childParams) : {};
            var numTwins    = event.detail.twins ? event.detail.twins : 1;
            var numPersons  = event.detail.groupSize ? event.detail.groupSize : 0;

            if (editor.getGraph().isChildless(personID)) {
                childParams['isAdopted'] = true;
            }

            if (numPersons > 0) {
                childParams['numPersons'] = numPersons;
            }

            var changeSet = editor.getGraph().addNewRelationship(personID, childParams, preferLeft, numTwins);
            editor.getView().applyChanges(changeSet, true);

            if (!event.detail?.noUndoRedo) {
                editor.getActionStack().addState( event );
            }

        } catch(err) {
        }

        timer.printSinceLast('=== Total new partner+child runtime: ');
    }

    handlePersonDragToNewPartner(event: any): any {

        var personID  = event.detail.personID;
        var partnerID = event.detail.partnerID;
        if (!editor.getGraph().isPerson(personID) || !editor.getGraph().isPerson(partnerID)) {
            return;
        }

        var childProperties = {} as any;
        if (editor.getGraph().isChildless(personID) || editor.getGraph().isChildless(partnerID)) {
            childProperties = { 'isAdopted': true };
        }

        // when partnering up a node with unknown gender with a node of known gender
        // change the unknown gender to the opposite of known
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

        // TODO: propagate change of gender down the partnership chain

        var changeSet = editor.getGraph().assignPartner(personID, partnerID, childProperties);
        editor.getView().applyChanges(changeSet, true);

        if (!event.detail?.noUndoRedo) {
            editor.getActionStack().addState( event );
        }
    }

    handleRelationshipNewChild(event: any): any {

        var partnershipID = event.detail.partnershipID;
        if (!editor.getGraph().isRelationship(partnershipID)) {
            return;
        }

        var numTwins = event.detail.twins ? event.detail.twins : 1;

        var childParams = cloneObject(event.detail.childParams);
        if (editor.getGraph().isChildless(partnershipID)) {
            childParams['isAdopted'] = true;
        }

        var numPersons = event.detail.groupSize ? event.detail.groupSize : 0;
        if (numPersons > 0) {
            childParams['numPersons'] = numPersons;
        }

        var changeSet = editor.getGraph().addNewChild(partnershipID, childParams, numTwins);
        editor.getView().applyChanges(changeSet, true);

        if (!event.detail?.noUndoRedo) {
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
