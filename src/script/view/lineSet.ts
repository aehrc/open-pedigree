

/**
 * LineSet is used to track existing lines in the graph and simplify line-crossing-line tracking
 *
 * @class LineSet
 * @constructor
 */
export default class LineSet {
  _lineCrossings: any;
  _lines: any[];

  constructor() {
    this._lineCrossings   = {};  // { owner: {set of owners of lines crossing its lines} }
    this._lines           = [];  // array of sets {owner, x1, y1, x2, y2}
  }

  replaceIDs(changedIdsSet: any): void {
    const newLineCrossings: any = {};
    for (const oldOwnerID in this._lineCrossings) {
      if (this._lineCrossings.hasOwnProperty(oldOwnerID)) {
        const crosses    = this._lineCrossings[oldOwnerID];
        const newCrosses: any = {};

        for (const oldID in crosses) {
          if (crosses.hasOwnProperty(oldID)) {
            const newID = changedIdsSet.hasOwnProperty(oldID) ? changedIdsSet[oldID] : oldID;
            newCrosses[newID] = true;
          }
        }

        const newOwnerID = changedIdsSet.hasOwnProperty(oldOwnerID) ? changedIdsSet[oldOwnerID] : oldOwnerID;
        newLineCrossings[newOwnerID] = newCrosses;
      }
    }
    this._lineCrossings = newLineCrossings;

    for (let i = 0; i < this._lines.length; i++) {
      const oldID = this._lines[i].owner;
      const newID = changedIdsSet.hasOwnProperty(oldID) ? changedIdsSet[oldID] : oldID;
      this._lines[i].owner = newID;
    }
  }

  addLine(owner: any, x1: any, y1: any, x2: any, y2: any): any[] {
    // returns: list of crossings [ {x,y} ... {x, y} ]

    // TODO: improve performance by ordering by y or x coordinate -> not critical for now

    if (!this._lineCrossings.hasOwnProperty(owner)) {
      this._lineCrossings[owner] = {};
    }

    const bendPoints: any[] = [];

    const thisLine = { 'owner': owner, 'x1': x1, 'y1': y1, 'x2': x2, 'y2': y2 };

    // scan through all vertical lines
    for (let i = 0; i < this._lines.length; i++) {
      const line = this._lines[i];
      if (line.owner == owner) {
        continue;
      }

      const crossingPoint = this._getLineCrossing(thisLine, line);
      if (crossingPoint) {
        this._lineCrossings[line.owner][owner] = true;  // that line affects this one
        bendPoints.push(crossingPoint);
      }
    }

    this._lines.push(thisLine);

    return bendPoints;
  }

  removeAllLinesByOwner(owner: any): any {
    //console.log("removing all lines by " + owner);

    if (!this._lineCrossings.hasOwnProperty(owner)) {
      return {};
    }

    for (let i = this._lines.length - 1; i >= 0; i--) {
      const line = this._lines[i];
      if (line.owner == owner) {
        this._lines.splice(i,1);
      }
    }

    const affectedOwners = this._lineCrossings[owner];
    delete this._lineCrossings[owner];

    for (const ownerID in this._lineCrossings) {
      if (this._lineCrossings.hasOwnProperty(ownerID)) {
        const crosses = this._lineCrossings[ownerID];
        if (crosses.hasOwnProperty(owner)) {
          delete crosses[owner];
        }
      }
    }

    //console.log("Removing " + owner + ", affected: " + JSON.stringify(affectedOwners));
    return affectedOwners;
  }

  removeAllLinesAffectedByOwnerMovement(owner: any): any[] {
    const returnNewAffected: any[] = [];

    const processed: any = {};
    processed[owner] = true;

    const affected: any[] = [ owner ];

    while (affected.length > 0) {
      const next = affected.pop();

      const newAffected = this.removeAllLinesByOwner(next);

      for (const o in newAffected) {
        if (newAffected.hasOwnProperty(o)) {
          if (!processed.hasOwnProperty(o)) {
            affected.push(parseInt(o));
            returnNewAffected.push(parseInt(o));
            processed[o] = true;
          }
        }
      }
    }

    //console.log("affected: " + JSON.stringify(returnNewAffected));
    //console.log("this: " + JSON.stringify(this));
    return returnNewAffected;
  }

  _getLineCrossing(line1: any, line2: any): any {
    // Return the coordinates of a point of intersection of the given two line segments.
    // Return null if the line segments are parallel 9even if they cross) or do not intersect
    // (note: ignores intersection at segment ends)
    //
    // The two linesin parametric form:
    //   l1(t) = (x1, y1) + (x2-x1, y2-y1)*t
    //   l2(s) = (u1, v1) + (u2-u1, v2-v1)*s
    //
    //   Intersection, i.e. l1(t) = l2(s) implies two scalar equations:
    //
    //      x1 + (x2-x1)*t = u1 + (u2-u1)*s
    //      y1 + (y2-y1)*t = v1 + (v2-v1)*s
    //
    //      (x2-x1)*t - (u2-u1)*s = u1-x1
    //      (y2-y1)*t - (v2-v1)*s = v1-y1
    //
    //  | a b | | t |  =  | e |
    //  | c d | | s |     | f |

    const a = line1.x2 - line1.x1;
    const b = line2.x1 - line2.x2;
    const c = line1.y2 - line1.y1;
    const d = line2.y1 - line2.y2;
    const e = line2.x1 - line1.x1;
    const f = line2.y1 - line1.y1;

    const denom = a*d - b*c;

    if (Math.abs(denom) <= 0.001) {
      return null;
    } // determinant is ~0, parallel

    const t = (e*d - b*f)/denom;
    const s = (a*f - e*c)/denom;

    if (t <= 0 || t >= 1 || s <= 0 || s >= 1)   // lines intersect but line segments do not, parameters outside of [0,1]
    {
      return 0;
    }                               // (or intersection is at the edge, when t == 0 or t == 1 or s == 0 or s == 1

    const px = line1.x1 + t*(line1.x2 - line1.x1);
    const py = line1.y1 + t*(line1.y2 - line1.y1);

    return { 'x': px, 'y': py };
  }
}
