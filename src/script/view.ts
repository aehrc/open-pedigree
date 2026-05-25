import Raphael from 'pedigree/raphael';
import { arrayContains, Timer } from 'pedigree/model/helpers';
import Partnership from 'pedigree/view/partnership';
import Person from 'pedigree/view/person';
import PersonGroup from 'pedigree/view/personGroup';
import LineSet from 'pedigree/view/lineSet';
import PedigreeEditorParameters from 'pedigree/pedigreeEditorParameters';
import { drawCornerCurve, drawLevelChangeCurve } from 'pedigree/view/graphicHelpers';

/**
 * View is responsible for graphical representation of th epedigree as well as user interaction
 *
 * @class View
 * @constructor
 */

export default class View {
    _nodeMap: any;
    hoverModeZones: any;
    _currentMarkedNew: any;
    _currentGrownNodes: any;
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

        this._nodeMap = {};    // {nodeID} : {AbstractNode}

        this.hoverModeZones = editor.getPaper().set();

        this._currentMarkedNew   = [];
        this._currentGrownNodes  = [];
        this._currentHoveredNode = null;
        this._currentDraggable   = null;

        this._lineSet = new LineSet();   // used to track intersecting lines
    }

    /**
     * Pre-generates paths and pre-computes bounding boxes for shapes which are commonly used in the graph.
     * Raphael is slow and re-computing each path/box for every node is noticeably slow
     *
     * @method preGenerateGraphics
     */
    preGenerateGraphics(): any {
        // 1) menu button
        this.__menuButton_svgPath = 'M1.213,5.849C1.213,5.849,1.213,5.849,1.213,5.849C1.213,5.849,1.213,5.848,1.213,5.848C1.213,5.848,1.213,5.849,1.213,5.849C1.213,5.849,1.213,5.849,1.213,5.849M1.213,5.848C1.213,5.848,4.676,9.3114,4.676,9.3114C4.676,9.3114,1.2126,12.774,1.2126,12.774C1.2126,12.774,2.486,14.048,2.486,14.048C2.486,14.048,7.222,9.311,7.222,9.311C7.222,9.311,2.486,4.574,2.486,4.574C2.486,4.574,1.213,5.848,1.213,5.8476C1.2131999999999998,5.8476,1.2131999999999998,5.8476,1.2131999999999998,5.8476M7.348799999999999,13.9614C7.348799999999999,13.9614,16.0002,13.9614,16.0002,13.9614C16.0002,13.9614,16.0002,12.161999999999999,16.0002,12.161999999999999C16.0002,12.161999999999999,7.348799999999999,12.161999999999999,7.348799999999999,12.161999999999999C7.348799999999999,12.161999999999999,7.348799999999999,13.9614,7.348799999999999,13.9614C7.348799999999999,13.9614,7.348799999999999,13.9614,7.348799999999999,13.9614M9.949799999999998,10.2114C9.949799999999998,10.2114,16.0002,10.2114,16.0002,10.2114C16.0002,10.2114,16.0002,8.411999999999999,16.0002,8.411999999999999C16.0002,8.411999999999999,9.949799999999998,8.411999999999999,9.949799999999998,8.411999999999999C9.949799999999998,8.411999999999999,9.949799999999998,10.2114,9.949799999999998,10.2114C9.949799999999998,10.2114,9.949799999999998,10.2114,9.949799999999998,10.2114M7.348799999999999,4.6613999999999995C7.348799999999999,4.6613999999999995,7.348799999999999,6.462,7.348799999999999,6.462C7.348799999999999,6.462,16.0002,6.462,16.0002,6.462C16.0002,6.462,16.0002,4.661,16.0,4.6614C16.0,4.6614,7.349,4.6614,7.349,4.6614C7.349,4.6614,7.349,4.6614,7.349,4.6614';
        this.__menuButton_BBox    = Raphael.pathBBox(this.__menuButton_svgPath);

        // 2) delete button
        this.__deleteButton_svgPath = 'M14.867,12.851C14.867,12.851,11.566,9.55,11.566,9.55C11.566,9.55,14.866,6.249,14.866,6.249C14.866,6.249,13.169,4.551,13.169,4.551C13.169,4.551,9.868,7.852,9.868,7.852C9.868,7.852,6.567,4.551,6.567,4.551C6.567,4.551,4.87,6.249,4.87,6.249C4.87,6.249,8.171,9.55,8.171,9.55C8.171,9.55,4.87,12.851,4.870,12.851C4.870,12.851,6.568,14.549,6.568,14.549C6.568,14.549,9.868,11.248,9.868,11.248C9.868,11.248,13.169,14.549,13.169,14.549C13.169,14.549,14.867,12.851,14.867,12.851';
        this.__deleteButton_BBox    = Raphael.pathBBox(this.__deleteButton_svgPath);

        // 4) proband arrow
        this.__arrow_svgPath = 'M8.348,23.029C8.348,23.029,0.791,30.584,0.791,30.584C0.791,30.584,3.515,33.308,3.515,33.308C3.515,33.308,11.07,25.752,11.0704,25.752C11.07,25.752,13.114,27.795,13.114,27.795C13.114,27.795,15.598,18.524,15.598,18.524C15.598,18.524,6.327,21.008,6.327,21.008C6.327,21.008,8.348,23.029,8.348,23.0285C8.348,23.029,8.348,23.029,8.348,23.029';
        this.__probandArrowPath = Raphael.transformPath(this.__arrow_svgPath, ['s', 1.1, 1.1, 0, 0]);
    }

    /**
     * Returns a map of node IDs to nodes
     *
     * @method getNodeMap
     * @return {Object}
     */
    getNodeMap(): any {
        return this._nodeMap;
    }

    /**
     * Returns a node with the given node ID
     *
     * @method getNode
     * @param {nodeId} id of the node to be returned
     * @return {AbstractNode}
     */
    getNode(nodeId: any): any {
        if (!this._nodeMap.hasOwnProperty(nodeId)) {
            throw 'ERROR';
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

    /**
     * Returns the person node containing x and y coordinates, or null if outside all person nodes
     *
     * @method getPersonNodeNear
     * @return {Object} or null
     */
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

    /**
     * Returns the node that is currently selected
     *
     * @method getCurrentHoveredNode
     * @return {AbstractNode}
     */
    getCurrentHoveredNode(): any {
        return this._currentHoveredNode;
    }

    /**
     * Returns the currently dragged element
     *
     * @method getCurrentDraggable
     * @return Either a handle from a hoverbox, or a PlaceHolder
     */
    getCurrentDraggable(): any {
        return this._currentDraggable;
    }

    /**
     * Returns the Object that is currently being dragged
     *
     * @method setCurrentDraggable
     * @param draggable A handle or a PlaceHolder
     */
    setCurrentDraggable(draggable: any): any {
        this._currentDraggable = draggable;
    }

    /**
     * Removes given node from node index (Does not delete the node visuals).
     *
     * @method removeFromNodeMap
     * @param {nodeId} id of the node to be removed
     */
    removeFromNodeMap(nodeID: any): any {
        delete this.getNodeMap()[nodeID];
    }

    /**
     * Creates a new set of raphael objects representing a curve from (xFrom, yFrom) trough (...,yTop) to (xTo, yTo).
     * The bend from (xTo,yTo) to vertical level yTop will happen "lastBend" pixels from xTo.
     * In case the flat part intersects any existing known lines a special crossing is drawn and added to the set.
     *
     * @method drawCurvedLineWithCrossings
     */
    drawCurvedLineWithCrossings(id: any, xFrom: any, yFrom: any, yTop: any, xTo: any, yTo: any, lastBend: any, attr: any, twoLines: any, secondLineBelow: any): any {

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
                // draw one continuous curve
                if (goesRight) {
                    drawLevelChangeCurve( xFromAndBit, yFrom, xFromAfter2Corners, yTop, attr, twoLines, -2.5, 2.5, 2.5, -2.5 );
                } else {
                    drawLevelChangeCurve( xFromAndBit, yFrom, xFromAfter2Corners, yTop, attr, twoLines, 2.5, 2.5, -2.5, -2.5 );
                }
            }
            this.drawLineWithCrossings(id, xFromAfter2Corners, yTop, xBeforeFinalBend, yTop, attr, twoLines, !goesRight, true);
        }

        if (xBeforeFinalBend != xTo) {
            // curve down to yTo level
            if (Math.abs(yTo - yTop) >= cornerRadius*2) {
                // draw corner
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
                // draw one continuous curve
                if (goesRight) {
                    drawLevelChangeCurve( xBeforeFinalBend, yTop, xFinalBend, yTo, attr, twoLines, 2.5, 2.5, -2.5, -2.5 );
                } else {
                    drawLevelChangeCurve( xBeforeFinalBend, yTop, xFinalBend, yTo, attr, twoLines, 2.5, -2.5, -2.5, 2.5 );
                }
            }
            this.drawLineWithCrossings(id, xFinalBend, yTo, xTo, yTo, attr, twoLines, !goesRight);
        }
    }

    /**
     * Creates a new set of raphael objects representing a line segment from (x1,y1) to (x2,y2).
     * In case this line segment intersects any existing known segments a special crossing is drawn and added to the set.
     *
     * @method drawLineWithCrossings
     */
    drawLineWithCrossings(owner: any, x1: any, y1: any, x2: any, y2: any, attr: any, twoLines: any, secondLineBelow: any, bothEndsGoDown?: any): any {

        // make sure line goes from the left to the right (and if vertical from the top to the bottom):
        // this simplifies drawing the line piece by piece from intersection to intersection
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

        // sort intersections by distance form the start
        var compareDistanceToStart = function( p1: any, p2: any ) {
            var dist1 = (x1-p1.x)*(x1-p1.x) + (y1-p1.y)*(y1-p1.y);
            var dist2 = (x1-p2.x)*(x1-p2.x) + (y1-p2.y)*(y1-p2.y);
            return dist1 - dist2;
        };
        intersections.sort(compareDistanceToStart);

        for (var lineNum = 0; lineNum < (twoLines ? 2 : 1); lineNum++) {

            // TODO: this is a bit hairy, just a quick hack to make two nice parallel curves
            //       for consang. relationships: simple raphael.transform() does not work well
            //       because then the curves around crossings wont be exactly above the crossing
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
                    // a curve above the crossing
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
                    // a curve on the right around crossing
                    raphaelPath += ' L ' + intersectPoint.x        + ' ' + (intersectPoint.y - 10);
                    raphaelPath += ' C ' + (intersectPoint.x - 1)  + ' ' + (intersectPoint.y - 7) +
                                               ' ' + (intersectPoint.x + 7)  + ' ' + (intersectPoint.y - 7) +
                                               ' ' + (intersectPoint.x + 7)  + ' ' + (intersectPoint.y);
                    raphaelPath += ' C ' + (intersectPoint.x + 7)  + ' ' + (intersectPoint.y + 7) +
                                               ' ' + (intersectPoint.x - 1)  + ' ' + (intersectPoint.y + 7) +
                                               ' ' + (intersectPoint.x)      + ' ' + (intersectPoint.y + 10);
                }
                // else: some diagonal line: presumably there should be none, if there are some
                //       everything will be ok except there will be no special intersection graphic drawn
            }
            raphaelPath += ' L ' + x2 + ' ' + y2;
            editor.getPaper().path(raphaelPath).attr(attr).toBack();
        }
    }

    /**
     * Creates a new node in the graph and returns it. The node type is obtained from
     * editor.getGraph() and may be on of Person, Partnership or ... TODO. The position
     * of the node is also obtained form editor.getGraph()
     *
     * @method addPerson
     * @param {Number} [id] The id of the node
     * @return {Person}
     */
    addNode(id: any): any {
        var positionedGraph = editor.getGraph();

        if (!positionedGraph.isValidID(id)) {
            throw 'addNode(): Invalid id';
        }

        var node;
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

    moveNode(id: any, animate?: any): any {
        var positionedGraph = editor.getGraph();
        var graphPos = positionedGraph.getPosition(id);
        var position = editor.convertGraphCoordToCanvasCoord(graphPos.x, graphPos.y );
        this.getNode(id).setPos(position.x, position.y, animate);
    }

    changeNodeIds(changedIdsSet: any): any {
        var newNodeMap = {} as any;

        // change all IDs at once so that have both new and old references at the same time
        for (var oldID in this._nodeMap) {
            var node  = this.getNode(oldID);

            var newID = changedIdsSet.hasOwnProperty(oldID) ? changedIdsSet[oldID] : oldID;
            node.setID( newID );

            newNodeMap[newID] = node;
        }

        this._nodeMap = newNodeMap;

        this._lineSet.replaceIDs(changedIdsSet);
    }

    /**
     * Enters hover-mode state, which is when a handle or a PlaceHolder is being dragged around the screen
     *
     * @method enterHoverMode
     * @param sourceNode The node whose handle is being dragged, or the placeholder that is being dragged
     * @param hoverTypes Should be 'parent', 'child' or 'partner'. Only nodes which can be in the correponding
     *                   relationship with sourceNode will be highlighted
     * dragged on top of them.
     */
    enterHoverMode(sourceNode: any, hoverType: any): any {

        var me = this;
        var validTargets = this.getValidDragTargets(sourceNode.getID(), hoverType);

        validTargets.each(function(nodeID: any) {
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

    /**
     * Exits hover-mode state, which is when a handle or a PlaceHolder is being dragged around the screen
     *
     * @method exitHoverMode
     */
    exitHoverMode(): any {
        this._currentHoveredNode = null;

        this.hoverModeZones.remove();

        var me = this;
        this._currentGrownNodes.each(function(nodeID: any) {
            var node = me.getNode(nodeID);
            node.getGraphics().shrink();
            node.getGraphics().getHoverBox().setHighlighted(false);
        });

        this._currentGrownNodes = [];
    }

    unmarkAll(): any {
        for (var i = 0; i < this._currentMarkedNew.length; i++) {
            var node = this.getNode(this._currentMarkedNew[i]);
            node.getGraphics().unmark();
        }
        this._currentMarkedNew = [];
    }

    getValidDragTargets(sourceNodeID: any, hoverType: any): any {
        var result = [] as any[];
        switch (hoverType) {
        case 'sibling':
            result = editor.getGraph().getPossibleSiblingsOf(sourceNodeID);
            break;
        case 'child':
            // all person nodes which are not ancestors of sourse node and which do not already have parents
            result = editor.getGraph().getPossibleChildrenOf(sourceNodeID);
            break;
        case 'parent':
            result = editor.getGraph().getPossibleParentsOf(sourceNodeID);
            break;
        case 'partnerR':
        case 'partnerL':
            // all person nodes of the other gender or unknown gender (who ar enot already partners)
            result = editor.getGraph().getPossiblePartnersOf(sourceNodeID);
            break;
        case 'PlaceHolder':
            // all nodes which can be this placehodler: e.g. all that can be child of it's parents &&
            // partners of it's partners
            throw 'TODO';
        default:
            throw 'Incorrect hoverType';
        }
        return result;
    }

    applyChanges(changeSet: any, markNew: any): any {
        // applies change set of the form {"new": {list of nodes}, "moved": {list of nodes} }

        var timer = new Timer();
        var timer2 = new Timer();

        try {

            this.unmarkAll();

            // to simplify code which deals woith removed nodes making other mnodes to move
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
                var affectedByLineRemoval = {} as any;

                for (var i = 0; i < changeSet.removed.length; i++) {
                    var nextRemoved = changeSet.removed[i];

                    this.getNodeMap()[nextRemoved].remove();
                    this.removeFromNodeMap(nextRemoved);

                    var affected = this._lineSet.removeAllLinesAffectedByOwnerMovement(nextRemoved);

                    for (var j = 0; j < affected.length; j++) {
                        if (!arrayContains(changeSet.removed, affected[j])) { // ignore nodes which are removed anyway
                            affectedByLineRemoval[affected[j]] = true;
                        }
                    }
                }

                // for each removed node all nodes with higher ids get their IDs shifted down by 1
                var idChanged = false;
                var changedIDs = {} as any;
                var maxCurrentNodeId = this.getMaxNodeID();
                for (var i2 = 0; i2 < changeSet.removedInternally.length; i2++) {
                    var nextRemovedInt = changeSet.removedInternally[i2];
                    for (var u = nextRemovedInt + 1; u <= maxCurrentNodeId; u++) {
                        idChanged = true;
                        if (!changedIDs.hasOwnProperty(u)) {
                            changedIDs[u] = u - 1;
                        } else {
                            changedIDs[u]--;
                        }
                    }
                }

                // change all IDs at once so that have both new and old references at the same time
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


            var movedPersons       = [] as any[];
            var movedRelationships = [] as any[];
            var newPersons         = [] as any[];
            var newRelationships   = [] as any[];
            var animate            = {} as any;

            if (changeSet.hasOwnProperty('moved')) {
                // remove all lines so that we start drawing anew
                for (var i3 = 0; i3 < changeSet.moved.length; i3++) {
                    var nextMoved = changeSet.moved[i3];
                    if (editor.getGraph().isRelationship(nextMoved)) {
                        var affected2 = this._lineSet.removeAllLinesAffectedByOwnerMovement(nextMoved);
                        for (var j2 = 0; j2 < affected2.length; j2++) {
                            var movedNode = affected2[j2];
                            if (!arrayContains(changeSet.moved, movedNode)) {
                                changeSet.moved.push(movedNode);
                            }
                        }
                    }
                }

                // move actual nodes
                for (var i4 = 0; i4 < changeSet.moved.length; i4++) {
                    var nextMoved2 = changeSet.moved[i4];
                    if (editor.getGraph().isRelationship(nextMoved2)) {
                        movedRelationships.push(nextMoved2);
                    } else {
                        movedPersons.push(nextMoved2);
                    }
                }
            }
            if (changeSet.hasOwnProperty('new')) {
                for (var i5 = 0; i5 < changeSet['new'].length; i5++) {
                    var nextNew = changeSet['new'][i5];
                    if (editor.getGraph().isRelationship(nextNew)) {
                        newRelationships.push(nextNew);
                    } else {
                        newPersons.push(nextNew);
                    }
                }
            }

            timer.printSinceLast('=== Bookkeeping/sorting runtime: ');


            for (var i6 = 0; i6 < movedPersons.length; i6++) {
                this.moveNode(movedPersons[i6], animate.hasOwnProperty(movedPersons[i6]));
            }

            timer.printSinceLast('=== Move persons runtime: ');

            for (var i7 = 0; i7 < newPersons.length; i7++) {
                var newPerson = this.addNode(newPersons[i7]);
                if (markNew) {
                    newPerson.getGraphics().markPermanently();
                    this._currentMarkedNew.push(newPersons[i7]);
                }
            }

            timer.printSinceLast('=== New persons runtime: ');

            for (var i8 = 0; i8 < movedRelationships.length; i8++) {
                this.moveNode(movedRelationships[i8]);
            }

            timer.printSinceLast('=== Move rels runtime: ');

            for (var i9 = 0; i9 < newRelationships.length; i9++) {
                this.addNode(newRelationships[i9]);
            }

            timer.printSinceLast('=== New rels runtime: ');

            if (changeSet.hasOwnProperty('highlight')) {
                for (var i10 = 0; i10 < changeSet.highlight.length; i10++) {
                    var nextHighlight = changeSet.highlight[i10];
                    this.getNode(nextHighlight).getGraphics().markPermanently();
                    this._currentMarkedNew.push(nextHighlight);
                }
            }

            // re-evaluate which buttons & handles are appropriate for the nodes (e.g. twin button appears/disappears)
            for (var nodeID in this._nodeMap) {
                if (this._nodeMap.hasOwnProperty(nodeID)) {
                    if (editor.getGraph().isPerson(nodeID) && !this.getNode(nodeID).getGraphics().getHoverBox().isMenuToggled()) {
                        this.getNode(nodeID).getGraphics().getHoverBox().removeButtons();
                        this.getNode(nodeID).getGraphics().getHoverBox().removeHandles();
                    }
                }
            }

            // TODO: move the viewport to make changeSet.makevisible nodes visible on screen

            timer.printSinceLast('=== highlight & update handles runtime: ');
            timer2.printSinceLast('=== Total apply changes runtime: ');

        } catch(err) {
        }
    }
}
