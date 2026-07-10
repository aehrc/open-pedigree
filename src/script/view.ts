import Raphael from 'pedigree/raphael';
import { arrayContains, Timer } from 'pedigree/model/helpers';
import Partnership from 'pedigree/view/partnership';
import Person from 'pedigree/view/person';
import PersonGroup from 'pedigree/view/personGroup';
import LineSet from 'pedigree/view/lineSet';
import PedigreeEditorParameters from 'pedigree/pedigreeEditorParameters';
import { drawCornerCurve, drawLevelChangeCurve } from 'pedigree/view/graphicHelpers';

export default class View {
  _nodeMap: any;
  hoverModeZones: any;
  _currentMarkedNew: any[];
  _currentGrownNodes: any[];
  _currentHoveredNode: any;
  _currentDraggable: any;
  _lineSet: any;
  __menuButton_svgPath: any;
  __menuButton_BBox: any;
  __deleteButton_svgPath: any;
  __deleteButton_BBox: any;
  __arrow_svgPath: any;
  __probandArrowPath: any;

  constructor() {
    this.preGenerateGraphics();

    this._nodeMap = {};

    this.hoverModeZones = editor.getPaper().set();

    this._currentMarkedNew   = [];
    this._currentGrownNodes  = [];
    this._currentHoveredNode = null;
    this._currentDraggable   = null;

    this._lineSet = new LineSet();
  }

  preGenerateGraphics(): void {
    this.__menuButton_svgPath = 'M1.213,5.849C1.213,5.849,1.213,5.849,1.213,5.849C1.213,5.849,1.213,5.848,1.213,5.848C1.213,5.848,1.213,5.849,1.213,5.849C1.213,5.849,1.213,5.849,1.213,5.849M1.213,5.848C1.213,5.848,4.676,9.3114,4.676,9.3114C4.676,9.3114,1.2126,12.774,1.2126,12.774C1.2126,12.774,2.486,14.048,2.486,14.048C2.486,14.048,7.222,9.311,7.222,9.311C7.222,9.311,2.486,4.574,2.486,4.574C2.486,4.574,1.213,5.848,1.213,5.8476C1.2131999999999998,5.8476,1.2131999999999998,5.8476,1.2131999999999998,5.8476M7.348799999999999,13.9614C7.348799999999999,13.9614,16.0002,13.9614,16.0002,13.9614C16.0002,13.9614,16.0002,12.161999999999999,16.0002,12.161999999999999C16.0002,12.161999999999999,7.348799999999999,12.161999999999999,7.348799999999999,12.161999999999999C7.348799999999999,12.161999999999999,7.348799999999999,13.9614,7.348799999999999,13.9614C7.348799999999999,13.9614,7.348799999999999,13.9614,7.348799999999999,13.9614M9.949799999999998,10.2114C9.949799999999998,10.2114,16.0002,10.2114,16.0002,10.2114C16.0002,10.2114,16.0002,8.411999999999999,16.0002,8.411999999999999C16.0002,8.411999999999999,9.949799999999998,8.411999999999999,9.949799999999998,8.411999999999999C9.949799999999998,8.411999999999999,9.949799999999998,10.2114,9.949799999999998,10.2114C9.949799999999998,10.2114,9.949799999999998,10.2114,9.949799999999998,10.2114M7.348799999999999,4.6613999999999995C7.348799999999999,4.6613999999999995,7.348799999999999,6.462,7.348799999999999,6.462C7.348799999999999,6.462,16.0002,6.462,16.0002,6.462C16.0002,6.462,16.0002,4.661,16.0,4.6614C16.0,4.6614,7.349,4.6614,7.349,4.6614C7.349,4.6614,7.349,4.6614,7.349,4.6614';
    this.__menuButton_BBox    = Raphael.pathBBox(this.__menuButton_svgPath);

    this.__deleteButton_svgPath = 'M14.867,12.851C14.867,12.851,11.566,9.55,11.566,9.55C11.566,9.55,14.866,6.249,14.866,6.249C14.866,6.249,13.169,4.551,13.169,4.551C13.169,4.551,9.868,7.852,9.868,7.852C9.868,7.852,6.567,4.551,6.567,4.551C6.567,4.551,4.87,6.249,4.87,6.249C4.87,6.249,8.171,9.55,8.171,9.55C8.171,9.55,4.87,12.851,4.870,12.851C4.870,12.851,6.568,14.549,6.568,14.549C6.568,14.549,9.868,11.248,9.868,11.248C9.868,11.248,13.169,14.549,13.169,14.549C13.169,14.549,14.867,12.851,14.867,12.851';
    this.__deleteButton_BBox    = Raphael.pathBBox(this.__deleteButton_svgPath);

    this.__arrow_svgPath = 'M8.348,23.029C8.348,23.029,0.791,30.584,0.791,30.584C0.791,30.584,3.515,33.308,3.515,33.308C3.515,33.308,11.07,25.752,11.0704,25.752C11.07,25.752,13.114,27.795,13.114,27.795C13.114,27.795,15.598,18.524,15.598,18.524C15.598,18.524,6.327,21.008,6.327,21.008C6.327,21.008,8.348,23.029,8.348,23.0285C8.348,23.029,8.348,23.029,8.348,23.029';
    this.__probandArrowPath = Raphael.transformPath(this.__arrow_svgPath, ['s', 1.1, 1.1, 0, 0]);
  }

  getNodeMap(): any {
    return this._nodeMap;
  }

  getNode(nodeId: any): any {
    if (!this._nodeMap.hasOwnProperty(nodeId)) {
      return null;
    }
    return this._nodeMap[nodeId];
  }

  getMaxNodeID(): any {
    var max = 0;
    for (var node in this._nodeMap) {
      if (this._nodeMap.hasOwnProperty(node)) {
        if (parseInt(node) > max) {
          max = node as any;
        }
      }
    }
    return max;
  }

  getPersonNodeNear(x: any, y: any): any {
    for (var nodeID in this._nodeMap) {
      if (this._nodeMap.hasOwnProperty(nodeID)) {
        var node = this.getNode(nodeID);
        if ((node.getType() == 'Person' || node.getType() == 'PersonGroup') && node.getGraphics().containsXY(x,y)) {
          return node;
        }
      }
    }
    return null;
  }

  getCurrentHoveredNode(): any {
    return this._currentHoveredNode;
  }

  getCurrentDraggable(): any {
    return this._currentDraggable;
  }

  setCurrentDraggable(draggable: any): void {
    this._currentDraggable = draggable;
  }

  removeFromNodeMap(nodeID: any): void {
    delete this.getNodeMap()[nodeID];
  }

  setUnknownParentsVisible(visible: boolean): void {
    const opacity = visible ? 1 : 0;
    for (var nodeID in this._nodeMap) {
      if (!this._nodeMap.hasOwnProperty(nodeID)) continue;
      var node = this._nodeMap[nodeID];
      if (node.getType() === 'Person' && node.isUnknownParent && node.isUnknownParent()) {
        var g = node.getGraphics();
        // Target only visible elements — deliberately exclude hoverbox and highlight box
        // to avoid restoring their normally-zero opacity and making them visible.
        var gg = g.getGenderGraphics && g.getGenderGraphics();
        if (gg) { gg.attr({ opacity: opacity }); }
        var labels = g.getLabels && g.getLabels();
        if (labels) { labels.attr({ opacity: opacity }); }
        var carrier = g.getCarrierGraphics && g.getCarrierGraphics();
        if (carrier) { carrier.attr({ opacity: opacity }); }
        var evaluation = g.getEvaluationGraphics && g.getEvaluationGraphics();
        if (evaluation) { evaluation.attr({ opacity: opacity }); }
        // Block/restore mouse interaction on the shape
        var shape = g.getGenderShape && g.getGenderShape();
        if (shape && shape.node) {
          shape.node.style.pointerEvents = visible ? '' : 'none';
        }
      }
    }
  }

  drawCurvedLineWithCrossings(id: any, xFrom: any, yFrom: any, yTop: any, xTo: any, yTo: any, lastBend: any, attr: any, twoLines: any, secondLineBelow: any): void {
    if (yFrom == yTop && yFrom == yTo) {
      return this.drawLineWithCrossings(id, xFrom, yFrom, xTo, yTo, attr, twoLines, secondLineBelow);
    }

    var cornerRadius     = PedigreeEditorParameters.attributes.curvedLinesCornerRadius * 0.8;
    var goesRight        = ( xFrom > xTo );
    var xFinalBend: any, xFinalBendVert: any, xBeforeFinalBend: any;
    if (isFinite(lastBend)) {
      xFinalBend       = goesRight ? xTo + lastBend                  : xTo - lastBend;
      xFinalBendVert   = goesRight ? xTo + lastBend + cornerRadius   : xTo - lastBend - cornerRadius;
      xBeforeFinalBend = goesRight ? xTo + lastBend + cornerRadius*2 : xTo - lastBend - cornerRadius*2;
    } else {
      xBeforeFinalBend = xTo;
    }
    var xFromAndBit        = goesRight ? xFrom - cornerRadius/2        : xFrom + cornerRadius/2;
    var xFromAfterCorner   = goesRight ? xFromAndBit - cornerRadius    : xFromAndBit + cornerRadius;
    var xFromAfter2Corners = goesRight ? xFromAndBit - 2*cornerRadius  : xFromAndBit + 2 * cornerRadius;


    if (yFrom <= yTop) {
      this.drawLineWithCrossings(id, xFrom, yFrom, xBeforeFinalBend, yFrom, attr, twoLines, !goesRight, true);
    } else {
      this.drawLineWithCrossings(id, xFrom, yFrom, xFromAndBit, yFrom, attr, twoLines, !goesRight, true);

      if (Math.abs(yFrom - yTop) >= cornerRadius*2) {
        if (goesRight) {
          drawCornerCurve( xFromAndBit, yFrom, xFromAfterCorner, yFrom-cornerRadius, true, attr, twoLines, -2.5, 2.5, 2.5, -2.5 );
        } else {
          drawCornerCurve( xFromAndBit, yFrom, xFromAfterCorner, yFrom-cornerRadius, true, attr, twoLines, 2.5, 2.5, -2.5, -2.5 );
        }
        this.drawLineWithCrossings(id, xFromAfterCorner, yFrom-cornerRadius, xFromAfterCorner, yTop+cornerRadius, attr, twoLines, goesRight);
        if (goesRight) {
          drawCornerCurve( xFromAfterCorner, yTop+cornerRadius, xFromAfter2Corners, yTop, false, attr, twoLines, -2.5, 2.5, 2.5, -2.5 );
        } else {
          drawCornerCurve( xFromAfterCorner, yTop+cornerRadius, xFromAfter2Corners, yTop, false, attr, twoLines, 2.5, 2.5, -2.5, -2.5 );
        }
      } else {
        if (goesRight) {
          drawLevelChangeCurve( xFromAndBit, yFrom, xFromAfter2Corners, yTop, attr, twoLines, -2.5, 2.5, 2.5, -2.5 );
        } else {
          drawLevelChangeCurve( xFromAndBit, yFrom, xFromAfter2Corners, yTop, attr, twoLines, 2.5, 2.5, -2.5, -2.5 );
        }
      }
      this.drawLineWithCrossings(id, xFromAfter2Corners, yTop, xBeforeFinalBend, yTop, attr, twoLines, !goesRight, true);
    }

    if (xBeforeFinalBend != xTo) {
      if (Math.abs(yTo - yTop) >= cornerRadius*2) {
        if (goesRight) {
          drawCornerCurve( xBeforeFinalBend, yTop, xFinalBendVert, yTop+cornerRadius, true, attr, twoLines, 2.5, 2.5, -2.5, -2.5 );
        } else {
          drawCornerCurve( xBeforeFinalBend, yTop, xFinalBendVert, yTop+cornerRadius, true, attr, twoLines, 2.5, -2.5, -2.5, 2.5 );
        }
        this.drawLineWithCrossings(id, xFinalBendVert, yTop+cornerRadius, xFinalBendVert, yTo-cornerRadius, attr, twoLines, !goesRight);
        if (goesRight) {
          drawCornerCurve( xFinalBendVert, yTo-cornerRadius, xFinalBend, yTo, false, attr, twoLines, 2.5, 2.5, -2.5, -2.5 );
        } else {
          drawCornerCurve( xFinalBendVert, yTo-cornerRadius, xFinalBend, yTo, false, attr, twoLines, 2.5, -2.5, -2.5, 2.5 );
        }
      } else {
        if (goesRight) {
          drawLevelChangeCurve( xBeforeFinalBend, yTop, xFinalBend, yTo, attr, twoLines, 2.5, 2.5, -2.5, -2.5 );
        } else {
          drawLevelChangeCurve( xBeforeFinalBend, yTop, xFinalBend, yTo, attr, twoLines, 2.5, -2.5, -2.5, 2.5 );
        }
      }
      this.drawLineWithCrossings(id, xFinalBend, yTo, xTo, yTo, attr, twoLines, !goesRight);
    }
  }

  drawLineWithCrossings(owner: any, x1: any, y1: any, x2: any, y2: any, attr: any, twoLines: any, secondLineBelow: any, bothEndsGoDown?: any): void {
    if (x1 > x2 || ((x1 == x2) && (y1 > y2))) {
      var tx = x1;
      var ty = y1;
      x1 = x2;
      y1 = y2;
      x2 = tx;
      y2 = ty;
    }

    var isHorizontal = (y1 == y2);
    var isVertical   = (x1 == x2);

    var intersections = this._lineSet.addLine( owner, x1, y1, x2, y2 );

    var compareDistanceToStart = function( p1: any, p2: any ) {
      var dist1 = (x1-p1.x)*(x1-p1.x) + (y1-p1.y)*(y1-p1.y);
      var dist2 = (x1-p2.x)*(x1-p2.x) + (y1-p2.y)*(y1-p2.y);
      return dist1 - dist2;
    };
    intersections.sort(compareDistanceToStart);

    for (var lineNum = 0; lineNum < (twoLines ? 2 : 1); lineNum++) {
      if (twoLines) {
        if (!bothEndsGoDown) {
          x1 += (-2.5 + lineNum * 7.5);
          x2 += (-2.5 + lineNum * 7.5);
        } else {
          x1 -= 2.5;
          x2 += 2.5;
        }

        if (secondLineBelow) {
          y1 += ( 2.5 - lineNum * 7.5);
          y2 += ( 2.5 - lineNum * 7.5);
        } else {
          y1 += (-2.5 + lineNum * 7.5);
          y2 += (-2.5 + lineNum * 7.5);
        }
      }

      var raphaelPath = 'M ' + x1 + ' ' + y1;
      for (var i = 0; i < intersections.length; i++) {
        var intersectPoint = intersections[i];

        var distance = function(p1: any, p2: any) {
          return (p1.x-p2.x)*(p1.x-p2.x) + (p1.y-p2.y)*(p1.y-p2.y);
        };

        var noCrossSymbolProximity = isHorizontal ? 20*20 : 9*9;

        if (distance(intersectPoint, {'x': x1, 'y': y1}) < noCrossSymbolProximity) {
          continue;
        }
        if (distance(intersectPoint, {'x': x2, 'y': y2}) < noCrossSymbolProximity) {
          continue;
        }

        if (isHorizontal) {
          if (twoLines) {
            if (secondLineBelow) {
              intersectPoint.y += ( 2.5 - lineNum * 7.5);
            } else {
              intersectPoint.y += (-2.5 + lineNum * 7.5);
            }
          }
          raphaelPath += ' L ' + (intersectPoint.x - 10) + ' ' + intersectPoint.y;
          raphaelPath += ' C ' + (intersectPoint.x - 7)  + ' ' + (intersectPoint.y + 1) +
                                     ' ' + (intersectPoint.x - 7)  + ' ' + (intersectPoint.y - 7) +
                                     ' ' + (intersectPoint.x)      + ' ' + (intersectPoint.y - 7);
          raphaelPath += ' C ' + (intersectPoint.x + 7)  + ' ' + (intersectPoint.y - 7) +
                                     ' ' + (intersectPoint.x + 7)  + ' ' + (intersectPoint.y + 1) +
                                     ' ' + (intersectPoint.x + 10) + ' ' + (intersectPoint.y);
        } else if (isVertical) {
          if (twoLines) {
            intersectPoint.x += ( -2.5 + lineNum * 7.5);
          }
          raphaelPath += ' L ' + intersectPoint.x        + ' ' + (intersectPoint.y - 10);
          raphaelPath += ' C ' + (intersectPoint.x - 1)  + ' ' + (intersectPoint.y - 7) +
                                     ' ' + (intersectPoint.x + 7)  + ' ' + (intersectPoint.y - 7) +
                                     ' ' + (intersectPoint.x + 7)  + ' ' + (intersectPoint.y);
          raphaelPath += ' C ' + (intersectPoint.x + 7)  + ' ' + (intersectPoint.y + 7) +
                                     ' ' + (intersectPoint.x - 1)  + ' ' + (intersectPoint.y + 7) +
                                     ' ' + (intersectPoint.x)      + ' ' + (intersectPoint.y + 10);
        }
      }
      raphaelPath += ' L ' + x2 + ' ' + y2;
      editor.getPaper().path(raphaelPath).attr(attr).toBack();
    }
  }

  addNode(id: any): any {
    var positionedGraph = editor.getGraph();

    if (!positionedGraph.isValidID(id)) {
      throw 'addNode(): Invalid id';
    }

    var node: any;
    var properties = positionedGraph.getProperties(id);

    var graphPos = positionedGraph.getPosition(id);
    var position = editor.convertGraphCoordToCanvasCoord(graphPos.x, graphPos.y );

    if (positionedGraph.isRelationship(id)) {
      node = new Partnership(position.x, position.y, id, properties);
    } else if (positionedGraph.isPersonGroup(id)) {
      node = new PersonGroup(position.x, position.y, id, properties);
    } else if (positionedGraph.isPerson(id)) {
      node = new Person(position.x, position.y, id, properties);
    } else {
      throw 'addNode(): unsupported node type';
    }

    this.getNodeMap()[id] = node;

    return node;
  }

  moveNode(id: any, animate?: any): void {
    var positionedGraph = editor.getGraph();
    var graphPos = positionedGraph.getPosition(id);
    var position = editor.convertGraphCoordToCanvasCoord(graphPos.x, graphPos.y );
    this.getNode(id).setPos(position.x, position.y, animate);
  }

  changeNodeIds(changedIdsSet: any): void {
    var newNodeMap: any = {};

    for (var oldID in this._nodeMap) {
      var node  = this.getNode(oldID);

      var newID = changedIdsSet.hasOwnProperty(oldID) ? changedIdsSet[oldID] : oldID;
      node.setID( newID );

      newNodeMap[newID] = node;
    }

    this._nodeMap = newNodeMap;

    this._lineSet.replaceIDs(changedIdsSet);
  }

  enterHoverMode(sourceNode: any, hoverType: any): void {
    var me = this;
    var validTargets = this.getValidDragTargets(sourceNode.getID(), hoverType);

    validTargets.forEach(function(nodeID: any) {
      me._currentGrownNodes.push(nodeID);

      var node = me.getNode(nodeID);
      node.getGraphics().grow();

      var hoverModeZone = node.getGraphics().getHoverBox().getHoverZoneMask().clone().toFront();
      hoverModeZone.hover(
        function() {
          me._currentHoveredNode = nodeID;
          node.getGraphics().getHoverBox().setHighlighted(true);
        },
        function() {
          me._currentHoveredNode = null;
          node.getGraphics().getHoverBox().setHighlighted(false);
        });

      me.hoverModeZones.push(hoverModeZone);
    });
  }

  exitHoverMode(): void {
    this._currentHoveredNode = null;

    this.hoverModeZones.remove();

    var me = this;
    this._currentGrownNodes.forEach(function(nodeID: any) {
      var node = me.getNode(nodeID);
      node.getGraphics().shrink();
      node.getGraphics().getHoverBox().setHighlighted(false);
    });

    this._currentGrownNodes = [];
  }

  unmarkAll(): void {
    for (var i = 0; i < this._currentMarkedNew.length; i++) {
      var node = this.getNode(this._currentMarkedNew[i]);
      node.getGraphics().unmark();
    }
    this._currentMarkedNew = [];
  }

  getValidDragTargets(sourceNodeID: any, hoverType: any): any {
    var result = [];
    switch (hoverType) {
    case 'sibling':
      result = editor.getGraph().getPossibleSiblingsOf(sourceNodeID);
      break;
    case 'child':
      result = editor.getGraph().getPossibleChildrenOf(sourceNodeID);
      break;
    case 'parent':
      result = editor.getGraph().getPossibleParentsOf(sourceNodeID);
      break;
    case 'partnerR':
    case 'partnerL':
      result = editor.getGraph().getPossiblePartnersOf(sourceNodeID);
      break;
    case 'PlaceHolder':
      throw 'TODO';
    default:
      throw 'Incorrect hoverType';
    }
    return result;
  }

  applyChanges(changeSet: any, markNew: any): void {
    var timer = new Timer();
    var timer2 = new Timer();

    try {
      this.unmarkAll();

      if (!changeSet.hasOwnProperty('moved')) {
        changeSet['moved'] = [];
      }
      if (!changeSet.hasOwnProperty('removed')) {
        changeSet['removed'] = [];
      }
      if (!changeSet.hasOwnProperty('removedInternally')) {
        changeSet['removedInternally'] = [];
      }

      if (changeSet.hasOwnProperty('removed')) {
        var affectedByLineRemoval: any = {};

        for (var i = 0; i < changeSet.removed.length; i++) {
          var nextRemoved = changeSet.removed[i];

          this.getNodeMap()[nextRemoved].remove();
          this.removeFromNodeMap(nextRemoved);

          var affected = this._lineSet.removeAllLinesAffectedByOwnerMovement(nextRemoved);

          for (var j = 0; j < affected.length; j++) {
            if (!arrayContains(changeSet.removed, affected[j])) {
              affectedByLineRemoval[affected[j]] = true;
            }
          }
        }

        var idChanged = false;
        var changedIDs: any = {};
        var maxCurrentNodeId = this.getMaxNodeID();
        for (var i = 0; i < changeSet.removedInternally.length; i++) {
          var nextRemoved = changeSet.removedInternally[i];
          for (var u = nextRemoved + 1; u <= maxCurrentNodeId; u++) {
            idChanged = true;
            if (!changedIDs.hasOwnProperty(u)) {
              changedIDs[u] = u - 1;
            } else {
              changedIDs[u]--;
            }
          }
        }

        if (idChanged) {
          this.changeNodeIds(changedIDs);
        }

        for (var node in affectedByLineRemoval) {
          if (affectedByLineRemoval.hasOwnProperty(node)) {
            var newID = changedIDs.hasOwnProperty(node) ? changedIDs[node] : node;
            if (!arrayContains(changeSet.moved, newID)) {
              changeSet.moved.push(newID);
            }
          }
        }
      }

      timer.printSinceLast('=== Removal runtime: ');

      var movedPersons       = [];
      var movedRelationships = [];
      var newPersons         = [];
      var newRelationships   = [];
      var animate: any       = {};

      if (changeSet.hasOwnProperty('moved')) {
        for (var i = 0; i < changeSet.moved.length; i++) {
          var nextMoved = changeSet.moved[i];
          if (editor.getGraph().isRelationship(nextMoved)) {
            var affected = this._lineSet.removeAllLinesAffectedByOwnerMovement(nextMoved);
            for (var j = 0; j < affected.length; j++) {
              var affectedNode = affected[j];
              if (!arrayContains(changeSet.moved, affectedNode)) {
                changeSet.moved.push(affectedNode);
              }
            }
          }
        }

        for (var i = 0; i < changeSet.moved.length; i++) {
          var nextMoved = changeSet.moved[i];
          if (editor.getGraph().isRelationship(nextMoved)) {
            movedRelationships.push(nextMoved);
          } else {
            movedPersons.push(nextMoved);
          }
        }
      }
      if (changeSet.hasOwnProperty('new')) {
        for (var i = 0; i < changeSet['new'].length; i++) {
          var nextNew = changeSet['new'][i];
          if (editor.getGraph().isRelationship(nextNew)) {
            newRelationships.push(nextNew);
          } else {
            newPersons.push(nextNew);
          }
        }
      }

      timer.printSinceLast('=== Bookkeeping/sorting runtime: ');

      for (var i = 0; i < movedPersons.length; i++) {
        this.moveNode(movedPersons[i], animate.hasOwnProperty(movedPersons[i]));
      }

      timer.printSinceLast('=== Move persons runtime: ');

      for (var i = 0; i < newPersons.length; i++) {
        var newPerson = this.addNode(newPersons[i]);
        if (markNew) {
          newPerson.getGraphics().markPermanently();
          this._currentMarkedNew.push(newPersons[i]);
        }
      }

      timer.printSinceLast('=== New persons runtime: ');

      for (var i = 0; i < movedRelationships.length; i++) {
        this.moveNode(movedRelationships[i]);
      }

      timer.printSinceLast('=== Move rels runtime: ');

      for (var i = 0; i < newRelationships.length; i++) {
        this.addNode(newRelationships[i]);
      }

      timer.printSinceLast('=== New rels runtime: ');

      if (changeSet.hasOwnProperty('highlight')) {
        for (var i = 0; i < changeSet.highlight.length; i++) {
          var nextHighlight = changeSet.highlight[i];
          this.getNode(nextHighlight).getGraphics().markPermanently();
          this._currentMarkedNew.push(nextHighlight);
        }
      }

      for (var nodeID in this._nodeMap) {
        if (this._nodeMap.hasOwnProperty(nodeID)) {
          if (editor.getGraph().isPerson(nodeID) && !this.getNode(nodeID).getGraphics().getHoverBox().isMenuToggled()) {
            this.getNode(nodeID).getGraphics().getHoverBox().removeButtons();
            this.getNode(nodeID).getGraphics().getHoverBox().removeHandles();
          }
        }
      }

      timer.printSinceLast('=== highlight & update handles runtime: ');
      timer2.printSinceLast('=== Total apply changes runtime: ');

    } catch(err) {
    }
  }
}
