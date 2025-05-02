# PathItem.getIntersections Function Call Hierarchy

## 1. Main Function: PathItem.getIntersections

```javascript
getIntersections: function(path, include, _matrix, _returnFirst) {
    // NOTE: For self-intersection, path is null. This means you can also
    // just call path.getIntersections() without an argument to get self
    // intersections.
    // NOTE: The hidden argument _matrix is used internally to override the
    // passed path's transformation matrix.
    var self = this === path || !path, // self-intersections?
        matrix1 = this._matrix._orNullIfIdentity(),
        matrix2 = self ? matrix1
            : (_matrix || path._matrix)._orNullIfIdentity();
    // First check the bounds of the two paths. If they don't intersect,
    // we don't need to iterate through their curves.
    return self || this.getBounds(matrix1).intersects(
            path.getBounds(matrix2), /*#=*/Numerical.EPSILON)
            ? Curve.getIntersections(
                    this.getCurves(), !self && path.getCurves(), include,
                    matrix1, matrix2, _returnFirst)
            : [];
}
```

## 2. Curve.getIntersections

```javascript
function getIntersections(curves1, curves2, include, matrix1, matrix2, _returnFirst) {
    var epsilon = /*#=*/Numerical.GEOMETRIC_EPSILON,
        self = !curves2;
    if (self)
        curves2 = curves1;
    var length1 = curves1.length,
        length2 = curves2.length,
        values1 = new Array(length1),
        values2 = self ? values1 : new Array(length2),
        locations = [];

    for (var i = 0; i < length1; i++) {
        values1[i] = curves1[i].getValues(matrix1);
    }
    if (!self) {
        for (var i = 0; i < length2; i++) {
            values2[i] = curves2[i].getValues(matrix2);
        }
    }
    var boundsCollisions = CollisionDetection.findCurveBoundsCollisions(
            values1, values2, epsilon);
    for (var index1 = 0; index1 < length1; index1++) {
        var curve1 = curves1[index1],
            v1 = values1[index1];
        if (self) {
            // First check for self-intersections within the same curve.
            getSelfIntersection(v1, curve1, locations, include);
        }
        // Check for intersections with potentially intersecting curves.
        var collisions1 = boundsCollisions[index1];
        if (collisions1) {
            for (var j = 0; j < collisions1.length; j++) {
                // There might be already one location from the above
                // self-intersection check:
                if (_returnFirst && locations.length)
                    return locations;
                var index2 = collisions1[j];
                if (!self || index2 > index1) {
                    var curve2 = curves2[index2],
                        v2 = values2[index2];
                    getCurveIntersections(
                            v1, v2, curve1, curve2, locations, include);
                }
            }
        }
    }
    return locations;
}
```

## 3. CollisionDetection.findCurveBoundsCollisions

```javascript
findCurveBoundsCollisions: function(curves1, curves2, tolerance, bothAxis) {
    function getBounds(curves) {
        var min = Math.min,
            max = Math.max,
            bounds = new Array(curves.length);
        for (var i = 0; i < curves.length; i++) {
            var v = curves[i];
            bounds[i] = [
                min(v[0], v[2], v[4], v[6]),
                min(v[1], v[3], v[5], v[7]),
                max(v[0], v[2], v[4], v[6]),
                max(v[1], v[3], v[5], v[7])
            ];
        }
        return bounds;
    }

    var bounds1 = getBounds(curves1),
        bounds2 = !curves2 || curves2 === curves1
            ? bounds1
            : getBounds(curves2);
    if (bothAxis) {
        var hor = this.findBoundsCollisions(
                bounds1, bounds2, tolerance || 0, false, true),
            ver = this.findBoundsCollisions(
                bounds1, bounds2, tolerance || 0, true, true),
            list = [];
        for (var i = 0, l = hor.length; i < l; i++) {
            list[i] = { hor: hor[i], ver: ver[i] };
        }
        return list;
    }
    return this.findBoundsCollisions(bounds1, bounds2, tolerance || 0);
}
```

## 4. CollisionDetection.findBoundsCollisions

```javascript
findBoundsCollisions: function(boundsA, boundsB, tolerance,
    sweepVertical, onlySweepAxisCollisions) {
    var self = !boundsB || boundsA === boundsB,
        allBounds = self ? boundsA : boundsA.concat(boundsB),
        lengthA = boundsA.length,
        lengthAll = allBounds.length;

    // Binary search utility function.
    function binarySearch(indices, coord, value) {
        var lo = 0,
            hi = indices.length;
        while (lo < hi) {
            var mid = (hi + lo) >>> 1; // Same as Math.floor((hi + lo) / 2)
            if (allBounds[indices[mid]][coord] < value) {
                lo = mid + 1;
            } else {
                hi = mid;
            }
        }
        return lo - 1;
    }

    // Set coordinates for primary and secondary axis
    var pri0 = sweepVertical ? 1 : 0,
        pri1 = pri0 + 2,
        sec0 = sweepVertical ? 0 : 1,
        sec1 = sec0 + 2;
    // Create array with all indices sorted by lower boundary on primary axis
    var allIndicesByPri0 = new Array(lengthAll);
    for (var i = 0; i < lengthAll; i++) {
        allIndicesByPri0[i] = i;
    }
    allIndicesByPri0.sort(function(i1, i2) {
        return allBounds[i1][pri0] - allBounds[i2][pri0];
    });
    // Sweep along primary axis
    var activeIndicesByPri1 = [],
        allCollisions = new Array(lengthA);
    
    // Sweep along primary axis. Indices of active bounds are kept in an
    // array sorted by higher boundary on primary axis.
    var activeIndicesByPri1 = [],
        allCollisions = new Array(lengthA);
    for (var i = 0; i < lengthAll; i++) {
        var curIndex = allIndicesByPri0[i],
            curBounds = allBounds[curIndex],
            // The original index in boundsA or boundsB:
            origIndex = self ? curIndex : curIndex - lengthA,
            isCurrentA = curIndex < lengthA,
            isCurrentB = self || !isCurrentA,
            curCollisions = isCurrentA ? [] : null;
        if (activeIndicesByPri1.length) {
            // remove (prune) indices that are no longer active.
            var pruneCount = binarySearch(activeIndicesByPri1, pri1,
                    curBounds[pri0] - tolerance) + 1;
            activeIndicesByPri1.splice(0, pruneCount);
            // Add collisions for current index.
            if (self && onlySweepAxisCollisions) {
                // All active indexes can be added, no further checks needed
                curCollisions = curCollisions.concat(activeIndicesByPri1);
               // Add current index to collisions of all active indexes
                for (var j = 0; j < activeIndicesByPri1.length; j++) {
                    var activeIndex = activeIndicesByPri1[j];
                    allCollisions[activeIndex].push(origIndex);
                }
            } else {
                var curSec1 = curBounds[sec1],
                    curSec0 = curBounds[sec0];
                for (var j = 0; j < activeIndicesByPri1.length; j++) {
                    var activeIndex = activeIndicesByPri1[j],
                        activeBounds = allBounds[activeIndex],
                        isActiveA = activeIndex < lengthA,
                        isActiveB = self || activeIndex >= lengthA;

                    // Check secondary axis bounds if necessary.
                    if (
                        onlySweepAxisCollisions ||
                        (
                            isCurrentA && isActiveB ||
                            isCurrentB && isActiveA
                        ) && (
                            curSec1 >= activeBounds[sec0] - tolerance &&
                            curSec0 <= activeBounds[sec1] + tolerance
                        )
                    ) {
                        // Add current index to collisions of active
                        // indices and vice versa.
                        if (isCurrentA && isActiveB) {
                            curCollisions.push(
                                self ? activeIndex : activeIndex - lengthA);
                        }
                        if (isCurrentB && isActiveA) {
                            allCollisions[activeIndex].push(origIndex);
                        }
                    }
                }
            }
        }
        if (isCurrentA) {
            if (boundsA === boundsB) {
                // If both arrays are the same, add self collision.
                curCollisions.push(curIndex);
            }
            // Add collisions for current index.
            allCollisions[curIndex] = curCollisions;
        }
        // Add current index to active indices. Keep array sorted by
        // their higher boundary on the primary axis.s
        if (activeIndicesByPri1.length) {
            var curPri1 = curBounds[pri1],
                index = binarySearch(activeIndicesByPri1, pri1, curPri1);
            activeIndicesByPri1.splice(index + 1, 0, curIndex);
        } else {
            activeIndicesByPri1.push(curIndex);
        }
    }
    // Sort collision indices in ascending order.
    for (var i = 0; i < allCollisions.length; i++) {
        var collisions = allCollisions[i];
        if (collisions) {
            collisions.sort(function(i1, i2) { return i1 - i2; });
        }
    }
    
    return allCollisions;
}
```

## 5. getSelfIntersection

```javascript
function getSelfIntersection(v1, c1, locations, include) {
    var info = Curve.classify(v1);
    if (info.type === 'loop') {
        var roots = info.roots;
        addLocation(locations, include,
                c1, roots[0],
                c1, roots[1]);
    }
  return locations;
}
```

## 6. Curve.classify

```javascript
classify: function() {
    return Curve.classify(this.getValues());
}
```

### Static Implementation

```javascript
classify: function(v) {
    // See: Loop and Blinn, 2005, Resolution Independent Curve Rendering
    // using Programmable Graphics Hardware, GPU Gems 3 chapter 25
    //
    // Possible types:
    //   'line'       (d1 == d2 == d3 == 0)
    //   'quadratic'  (d1 == d2 == 0)
    //   'serpentine' (d > 0)
    //   'cusp'       (d == 0)
    //   'loop'       (d < 0)
    //   'arch'       (serpentine, cusp or loop with roots outside 0..1)
    //
    // NOTE: Roots for serpentine, cusp and loop curves are only
    // considered if they are within 0..1. If the roots are outside,
    // then we degrade the type of curve down to an 'arch'.

    var x0 = v[0], y0 = v[1],
        x1 = v[2], y1 = v[3],
        x2 = v[4], y2 = v[5],
        x3 = v[6], y3 = v[7],
        // Calculate coefficients of I(s, t), of which the roots are
        // inflection points.
        a1 = x0 * (y3 - y2) + y0 * (x2 - x3) + x3 * y2 - y3 * x2,
        a2 = x1 * (y0 - y3) + y1 * (x3 - x0) + x0 * y3 - y0 * x3,
        a3 = x2 * (y1 - y0) + y2 * (x0 - x1) + x1 * y0 - y1 * x0,
        d3 = 3 * a3,
        d2 = d3 - a2,
        d1 = d2 - a2 + a1,
        // Normalize the vector (d1, d2, d3) to keep error consistent.
        l = Math.sqrt(d1 * d1 + d2 * d2 + d3 * d3),
        s = l !== 0 ? 1 / l : 0,
        isZero = Numerical.isZero,
        serpentine = 'serpentine'; // short-cut
    d1 *= s;
    d2 *= s;
    d3 *= s;

    function type(type, t1, t2) {
        var hasRoots = t1 !== undefined,
            t1Ok = hasRoots && t1 > 0 && t1 < 1,
            t2Ok = hasRoots && t2 > 0 && t2 < 1;
        // Degrade to arch for serpentine, cusp or loop if no solutions
        // within 0..1 are found. loop requires 2 solutions to be valid.
        if (hasRoots && (!(t1Ok || t2Ok)
                || type === 'loop' && !(t1Ok && t2Ok))) {
            type = 'arch';
            t1Ok = t2Ok = false;
        }
        return {
            type: type,
            roots: t1Ok || t2Ok
                    ? t1Ok && t2Ok
                        ? t1 < t2 ? [t1, t2] : [t2, t1] // 2 solutions
                        : [t1Ok ? t1 : t2] // 1 solution
                    : null
        };
    }

    if (isZero(d1)) {
        return isZero(d2)
                ? type(isZero(d3) ? 'line' : 'quadratic') // 5. / 4.
                : type(serpentine, d3 / (3 * d2));        // 3b.
    }
    var d = 3 * d2 * d2 - 4 * d1 * d3;
    if (isZero(d)) {
        return type('cusp', d2 / (2 * d1));               // 3a.
    }
    var f1 = d > 0 ? Math.sqrt(d / 3) : Math.sqrt(-d),
        f2 = 2 * d1;
    return type(d > 0 ? serpentine : 'loop',              // 1. / 2.
            (d2 + f1) / f2,
            (d2 - f1) / f2);
}
```

## 7. getCurveIntersections

```javascript
function getCurveIntersections(v1, v2, c1, c2, locations, include) {
    // Avoid checking curves if completely out of control bounds.
    var epsilon = /*#=*/Numerical.EPSILON,
        min = Math.min,
        max = Math.max;

    if (max(v1[0], v1[2], v1[4], v1[6]) + epsilon >
        min(v2[0], v2[2], v2[4], v2[6]) &&
        min(v1[0], v1[2], v1[4], v1[6]) - epsilon <
        max(v2[0], v2[2], v2[4], v2[6]) &&
        max(v1[1], v1[3], v1[5], v1[7]) + epsilon >
        min(v2[1], v2[3], v2[5], v2[7]) &&
        min(v1[1], v1[3], v1[5], v1[7]) - epsilon <
        max(v2[1], v2[3], v2[5], v2[7])) {
        // Now detect and handle overlaps:
        var overlaps = getOverlaps(v1, v2);
        if (overlaps) {
            for (var i = 0; i < 2; i++) {
                var overlap = overlaps[i];
                addLocation(locations, include,
                        c1, overlap[0],
                        c2, overlap[1], true);
            }
        } else {
            var straight1 = Curve.isStraight(v1),
                straight2 = Curve.isStraight(v2),
                straight = straight1 && straight2,
                flip = straight1 && !straight2,
                before = locations.length;
            // Determine the correct intersection method based on whether
            // one or curves are straight lines:
            (straight
                ? addLineIntersection
                : straight1 || straight2
                    ? addCurveLineIntersections
                    : addCurveIntersections)(
                        flip ? v2 : v1, flip ? v1 : v2,
                        flip ? c2 : c1, flip ? c1 : c2,
                        locations, include, flip,
                        // Define the defaults for these parameters of
                        // addCurveIntersections():
                        // recursion, calls, tMin, tMax, uMin, uMax
                        0, 0, 0, 1, 0, 1);
            // Handle special case for overlapping endpoints
            if (!straight || locations.length === before) {
                // Check for special cases of overlapping endpoints:
                // 1. Check for both curves ending at the same point
                var c1p1 = c1.getPoint1(), c1p2 = c1.getPoint2(),
                    c2p1 = c2.getPoint1(), c2p2 = c2.getPoint2();
                if (c1p1.isClose(c2p1, epsilon))
                    addLocation(locations, include, c1, 0, c2, 0, true);
                if (c1p1.isClose(c2p2, epsilon))
                    addLocation(locations, include, c1, 0, c2, 1, true);
                if (c1p2.isClose(c2p1, epsilon))
                    addLocation(locations, include, c1, 1, c2, 0, true);
                if (c1p2.isClose(c2p2, epsilon))
                    addLocation(locations, include, c1, 1, c2, 1, true);
            }
        }
    }
    return locations;
}
```

## 8. getOverlaps

```javascript
function getOverlaps(v1, v2) {
    // Linear curves can only overlap if they are collinear. Instead of
    // using the #isCollinear() check, we pick the longer of the two curves
    // treated as lines, and see how far the starting and end points of the
    // other line are from this line (assumed as an infinite line). But even
    // if the curves are not straight, they might just have tiny handles
    // within geometric epsilon distance, so we have to check for that too.

    function getSquaredLineLength(v) {
        var x = v[6] - v[0],
            y = v[7] - v[1];
        return x * x + y * y;
    }

    var abs = Math.abs,
        getDistance = Line.getDistance,
        timeEpsilon = /*#=*/Numerical.CURVETIME_EPSILON,
        geomEpsilon = /*#=*/Numerical.GEOMETRIC_EPSILON,
        straight1 = Curve.isStraight(v1),
        straight2 = Curve.isStraight(v2),
        straightBoth = straight1 && straight2,
        flip = getSquaredLineLength(v1) < getSquaredLineLength(v2),
        l1 = flip ? v2 : v1,
        l2 = flip ? v1 : v2,
        // Get l1 start and end point values for faster referencing.
        px = l1[0], py = l1[1],
        vx = l1[6] - px, vy = l1[7] - py;
    // See if the starting and end point of curve two are very close to the
    // picked line. Note that the curve for the picked line might not
    // actually be a line, so we have to perform more checks after.
    if (getDistance(px, py, vx, vy, l2[0], l2[1], true) < geomEpsilon &&
        getDistance(px, py, vx, vy, l2[6], l2[7], true) < geomEpsilon) {
        // If not both curves are straight, check against both of their
        // handles, and treat them as straight if they are very close.
        if (!straightBoth &&
            getDistance(px, py, vx, vy, l1[2], l1[3], true) < geomEpsilon &&
            getDistance(px, py, vx, vy, l1[4], l1[5], true) < geomEpsilon &&
            getDistance(px, py, vx, vy, l2[2], l2[3], true) < geomEpsilon &&
            getDistance(px, py, vx, vy, l2[4], l2[5], true) < geomEpsilon) {
            straight1 = straight2 = straightBoth = true;
        }
    } else if (straightBoth) {
        // If both curves are straight and not very close to each other,
        // there can't be a solution.
        return null;
    }
    if (straight1 ^ straight2) {
        // If one curve is straight, the other curve must be straight too,
        // otherwise they cannot overlap.
        return null;
    }

    var v = [v1, v2],
        pairs = [];
    // Iterate through all end points:
    // First p1 of curve 1 & 2, then p2 of curve 1 & 2.
    for (var i = 0; i < 4 && pairs.length < 2; i++) {
        var i1 = i & 1,  // 0, 1, 0, 1
            i2 = i1 ^ 1, // 1, 0, 1, 0
            t1 = i >> 1, // 0, 0, 1, 1
            t2 = Curve.getTimeOf(v[i1], new Point(
                v[i2][t1 ? 6 : 0],
                v[i2][t1 ? 7 : 1]));
        if (t2 != null) {  // If point is on curve
            var pair = i1 ? [t1, t2] : [t2, t1];
            // Filter out tiny overlaps.
            if (!pairs.length ||
                abs(pair[0] - pairs[0][0]) > timeEpsilon &&
                abs(pair[1] - pairs[0][1]) > timeEpsilon) {
                pairs.push(pair);
            }
        }
        // We checked 3 points but found no match, curves can't overlap.
        if (i > 2 && !pairs.length)
            break;
    }
    if (pairs.length !== 2) {
        pairs = null;
    } else if (!straightBoth) {
        // Straight pairs don't need further checks. If we found 2 pairs,
        // the end points on v1 & v2 should be the same.
        var o1 = Curve.getPart(v1, pairs[0][0], pairs[1][0]),
            o2 = Curve.getPart(v2, pairs[0][1], pairs[1][1]);
        // Check if handles of the overlapping curves are the same too.
        if (abs(o2[2] - o1[2]) > geomEpsilon ||
            abs(o2[3] - o1[3]) > geomEpsilon ||
            abs(o2[4] - o1[4]) > geomEpsilon ||
            abs(o2[5] - o1[5]) > geomEpsilon)
            pairs = null;
    }
    return pairs;
}
```

## 9. addLocation

```javascript
function addLocation(locations, include, c1, t1, c2, t2, overlap) {
    // Determine if locations at the beginning / end of the curves should be
    // excluded, in case the two curves are neighbors, but do not exclude
    // connecting points between two curves if they were part of overlap
    // checks, as they could be self-overlapping.
    // NOTE: We don't pass p1 and p2, because v1 and v2 may be transformed
    // by their path.matrix, while c1 and c2 are untransformed. Passing null
    // for point in CurveLocation() will do the right thing.
    var excludeStart = !overlap && c1.getPrevious() === c2,
        excludeEnd = !overlap && c1 !== c2 && c1.getNext() === c2,
        tMin = /*#=*/Numerical.CURVETIME_EPSILON,
        tMax = 1 - tMin;
    // Check t1 and t2 against correct bounds, based on excludeStart/End:
    // - excludeStart means the start of c1 connects to the end of c2
    // - excludeEnd means the end of c1 connects to the start of c2
    // - If either c1 or c2 are at the end of the path, exclude their end,
    //   which connects back to the beginning, but only if it's not part of
    //   a found overlap. The normal intersection will already be found at
    //   the beginning, and would be added twice otherwise.
    if (t1 !== null && t1 >= (excludeStart ? tMin : 0) &&
        t1 <= (excludeEnd ? tMax : 1)) {
        if (t2 !== null && t2 >= (excludeEnd ? tMin : 0) &&
            t2 <= (excludeStart ? tMax : 1)) {
            var loc1 = new CurveLocation(c1, t1, null, overlap),
                loc2 = new CurveLocation(c2, t2, null, overlap);
            // Link the two locations to each other.
            loc1._intersection = loc2;
            loc2._intersection = loc1;
            if (!include || include(loc1)) {
                CurveLocation.insert(locations, loc1, true);
            }
        }
    }
}
```

## 10. addCurveIntersections

```javascript
function addCurveIntersections(v1, v2, c1, c2, locations, include, flip,
        recursion, calls, tMin, tMax, uMin, uMax) {
    // Avoid deeper recursion, by counting the total amount of recursions,
    // as well as the total amount of calls, to avoid massive call-trees as
    // suggested by @iconexperience in #904#issuecomment-225283430.
    // See also: #565 #899 #1074
    if (++calls >= 4096 || ++recursion >= 40)
        return calls;
    // Use an epsilon smaller than CURVETIME_EPSILON to compare curve-time
    // parameters in fat-line clipping code.
    var fatLineEpsilon = 1e-9,
        // Let P be the first curve and Q be the second
        q0x = v2[0], q0y = v2[1], q3x = v2[6], q3y = v2[7],
        getSignedDistance = Line.getSignedDistance,
        // Calculate the fat-line L for Q is the baseline l and two
        // offsets which completely encloses the curve P.
        d1 = getSignedDistance(q0x, q0y, q3x, q3y, v2[2], v2[3]),
        d2 = getSignedDistance(q0x, q0y, q3x, q3y, v2[4], v2[5]),
        factor = d1 * d2 > 0 ? 3 / 4 : 4 / 9,
        dMin = factor * Math.min(0, d1, d2),
        dMax = factor * Math.max(0, d1, d2),
        // Calculate non-parametric bezier curve D(ti, di(t)):
        // - di(t) is the distance of P from baseline l of the fat-line
        // - ti is equally spaced in [0, 1]
        dp0 = getSignedDistance(q0x, q0y, q3x, q3y, v1[0], v1[1]),
        dp1 = getSignedDistance(q0x, q0y, q3x, q3y, v1[2], v1[3]),
        dp2 = getSignedDistance(q0x, q0y, q3x, q3y, v1[4], v1[5]),
        dp3 = getSignedDistance(q0x, q0y, q3x, q3y, v1[6], v1[7]),
        // Get the top and bottom parts of the convex-hull
        hull = getConvexHull(dp0, dp1, dp2, dp3),
        top = hull[0],
        bottom = hull[1],
        tMinClip,
        tMaxClip;
    // Stop iteration if all points and control points are collinear.
    if (d1 === 0 && d2 === 0
            && dp0 === 0 && dp1 === 0 && dp2 === 0 && dp3 === 0
        // Clip convex-hull with dMin and dMax, taking into account that
        // there will be no intersections if one of the results is null.
        || (tMinClip = clipConvexHull(top, bottom, dMin, dMax)) == null
        || (tMaxClip = clipConvexHull(top.reverse(), bottom.reverse(),
            dMin, dMax)) == null)
        return calls;
    // tMin and tMax are within the range (0, 1). Project it back to the
    // original parameter range for v2.
    var tMinNew = tMin + (tMax - tMin) * tMinClip,
        tMaxNew = tMin + (tMax - tMin) * tMaxClip;
    if (Math.max(uMax - uMin, tMaxNew - tMinNew) < fatLineEpsilon) {
        // We have isolated the intersection with sufficient precision
        var t = (tMinNew + tMaxNew) / 2,
            u = (uMin + uMax) / 2;
        addLocation(locations, include,
                flip ? c2 : c1, flip ? u : t,
                flip ? c1 : c2, flip ? t : u);
    } else {
        // Apply the result of the clipping to curve 1:
        v1 = Curve.getPart(v1, tMinClip, tMaxClip);
        var uDiff = uMax - uMin;
        if (tMaxClip - tMinClip > 0.8) {
            // Subdivide the curve which has converged the least.
            if (tMaxNew - tMinNew > uDiff) {
                var parts = Curve.subdivide(v1, 0.5),
                    t = (tMinNew + tMaxNew) / 2;
                calls = addCurveIntersections(
                        v2, parts[0], c2, c1, locations, include, !flip,
                        recursion, calls, uMin, uMax, tMinNew, t);
                calls = addCurveIntersections(
                        v2, parts[1], c2, c1, locations, include, !flip,
                        recursion, calls, uMin, uMax, t, tMaxNew);
            } else {
                var parts = Curve.subdivide(v2, 0.5),
                    u = (uMin + uMax) / 2;
                calls = addCurveIntersections(
                        parts[0], v1, c2, c1, locations, include, !flip,
                        recursion, calls, uMin, u, tMinNew, tMaxNew);
                calls = addCurveIntersections(
                        parts[1], v1, c2, c1, locations, include, !flip,
                        recursion, calls, u, uMax, tMinNew, tMaxNew);
            }
        } else { // Iterate
            // For some unclear reason we need to check against uDiff === 0
            // here, to prevent a regression from happening, see #1638.
            // Maybe @iconexperience could shed some light on this.
            if (uDiff === 0 || uDiff >= fatLineEpsilon) {
                calls = addCurveIntersections(
                        v2, v1, c2, c1, locations, include, !flip,
                        recursion, calls, uMin, uMax, tMinNew, tMaxNew);
            } else {
                // The interval on the other curve is already tight enough,
                // therefore we keep iterating on the same curve.
                calls = addCurveIntersections(
                        v1, v2, c1, c2, locations, include, flip,
                        recursion, calls, tMinNew, tMaxNew, uMin, uMax);
            }
        }
    }
    return calls;
}
```

## 11. getConvexHull

```javascript
function getConvexHull(dq0, dq1, dq2, dq3) {
    var p0 = [ 0, dq0 ],
        p1 = [ 1 / 3, dq1 ],
        p2 = [ 2 / 3, dq2 ],
        p3 = [ 1, dq3 ],
        // Find vertical signed distance of p1 and p2 from line [p0, p3]
        dist1 = dq1 - (2 * dq0 + dq3) / 3,
        dist2 = dq2 - (dq0 + 2 * dq3) / 3,
        hull;
    // Check if p1 and p2 are on the opposite side of the line [p0, p3]
    if (dist1 * dist2 < 0) {
        // p1 and p2 lie on different sides of [p0, p3]. The hull is a
        // quadrilateral and line [p0, p3] is NOT part of the hull so we are
        // pretty much done here. The top part includes p1, we will reverse
        // it later if that is not the case.
        hull = [[p0, p1, p3], [p0, p2, p3]];
    } else {
        // p1 and p2 lie on the same sides of [p0, p3]. The hull can be a
        // triangle or a quadrilateral and line [p0, p3] is part of the
        // hull. Check if the hull is a triangle or a quadrilateral. We have
        // a triangle if the vertical distance of one of the middle points
        // (p1, p2) is equal or less than half the vertical distance of the
        // other middle point.
        var distRatio = dist1 / dist2;
        hull = [
            // p2 is inside, the hull is a triangle.
            distRatio >= 2 ? [p0, p1, p3]
            // p1 is inside, the hull is a triangle.
            : distRatio <= 0.5 ? [p0, p2, p3]
            // Hull is a quadrilateral, we need all lines in correct order.
            : [p0, p1, p2, p3],
            // Line [p0, p3] is part of the hull.
            [p0, p3]
        ];
    }
    // Flip hull if dist1 is negative or if it is zero and dist2 is negative
    return (dist1 || dist2) < 0 ? hull.reverse() : hull;
}
```

## 12. clipConvexHull

```javascript
function clipConvexHull(hullTop, hullBottom, dMin, dMax) {
    if (hullTop[0][1] < dMin) {
        // Left of hull is below dMin, walk through hull to find intersection
        return clipConvexHullPart(hullTop, hullBottom, dMin, false);
    } else if (hullBottom[0][1] > dMax) {
        // Left of hull is above dMax, walk through hull to find intersection
        return clipConvexHullPart(hullTop, hullBottom, dMax, true);
    } else {
        // Left of hull is between dMin and dMax, no clipping needed
        return 0;
    }
}
```

## 13. Curve.isStraight

```javascript
isStraight: function(p1, h1, h2, p2) {
    if (h1.isZero() && h2.isZero()) {
        // No handles.
        return true;
    } else {
        var v = p2.subtract(p1);
        if (v.isZero()) {
            // Zero-length line, with some handles defined.
            return false;
        } else if (v.isCollinear(h1) && v.isCollinear(h2)) {
            // Collinear handles: In addition to v.isCollinear(h) checks, we
            // need to measure the distance to the line, in order to be able
            // to use the same epsilon as in Curve#getTimeOf(), see #1066.
            var l = new Line(p1, p2),
                epsilon = /*#=*/Numerical.GEOMETRIC_EPSILON;
            if (l.getDistance(p1.add(h1)) < epsilon &&
                l.getDistance(p2.add(h2)) < epsilon) {
                // Project handles onto line to see if they are in range:
                var div = v.dot(v),
                    s1 = v.dot(h1) / div,
                    s2 = v.dot(h2) / div;
                return s1 >= 0 && s1 <= 1 && s2 <= 0 && s2 >= -1;
            }
        }
    }
    return false;
}
```

## 14. Line.getSignedDistance

```javascript
getSignedDistance: function(px, py, vx, vy, x, y) {
    return (vx === 0 ? x - px
            : vy === 0 ? py - y
            : ((y - py) * vx - (x - px) * vy)
                / Math.sqrt(vx * vx + vy * vy));
}
```

## 15. clipConvexHullPart

```javascript
function clipConvexHullPart(hullPart, hullOther, dValue, dMin) {
    // Walk through the hull part and find the first edge that intersects
    // the dValue line.
    if (hullPart.length > 1 && hullOther.length > 1) {
        var px0 = hullPart[0][0],
            py0 = hullPart[0][1],
            px1,
            py1;
        // Find the segment that intersects the dValue line
        for (var i = 1, l = hullPart.length; i < l; i++) {
            px1 = hullPart[i][0];
            py1 = hullPart[i][1];
            // Check if the edge intersects the dValue line
            if (py0 <= dValue && py1 > dValue || py0 > dValue && py1 <= dValue) {
                // Find the intersection point
                var pxIntersect = px0 + (px1 - px0) * (dValue - py0) / (py1 - py0);
                
                // Walk through the other hull part and find the first edge that
                // intersects the dValue line.
                var qx0 = hullOther[0][0],
                    qy0 = hullOther[0][1],
                    qx1,
                    qy1;
                // Find the segment that intersects the dValue line
                for (var j = 1, m = hullOther.length; j < m; j++) {
                    qx1 = hullOther[j][0];
                    qy1 = hullOther[j][1];
                    // Check if the edge intersects the dValue line
                    if (qy0 <= dValue && qy1 > dValue || qy0 > dValue && qy1 <= dValue) {
                        // Find the intersection point
                        var qxIntersect = qx0 + (qx1 - qx0) * (dValue - qy0) / (qy1 - qy0);
                        // Return the t-value of the intersection
                        return pxIntersect < qxIntersect
                                ? pxIntersect
                                : qxIntersect;
                    }
                    qx0 = qx1;
                    qy0 = qy1;
                }
                // If we get here, there's no intersection with the other hull part
                return pxIntersect;
            }
            px0 = px1;
            py0 = py1;
        }
    }
    // If we get here, there's no intersection with this hull part
    return null;
}
```

## 11. addCurveLineIntersections

```javascript
function addCurveLineIntersections(v1, v2, c1, c2, locations, include, flip) {
    // addCurveLineIntersections() is called so that v1 is always the curve
    // and v2 the line. flip indicates whether the curves need to be flipped
    // in the call to addLocation().
    var x1 = v2[0], y1 = v2[1],
        x2 = v2[6], y2 = v2[7],
        roots = getCurveLineIntersections(v1, x1, y1, x2 - x1, y2 - y1);
    // NOTE: count could be -1 for infinite solutions, but that should only
    // happen with lines, in which case we should not be here.
    for (var i = 0, l = roots.length; i < l; i++) {
        // For each found solution on the rotated curve, get the point on
        // the real curve and with that the location on the line.
        var t1 = roots[i],
            p1 = Curve.getPoint(v1, t1),
            t2 = Curve.getTimeOf(v2, p1);
        if (t2 !== null) {
            // Only use the time values if there was no recursion, and let
            // addLocation() figure out the actual time values otherwise.
            addLocation(locations, include,
                    flip ? c2 : c1, flip ? t2 : t1,
                    flip ? c1 : c2, flip ? t1 : t2);
        }
    }
    return locations;
}
```

## 12. addLineIntersection

```javascript
function addLineIntersection(v1, v2, c1, c2, locations, include, flip) {
    var pt = Line.intersect(
            v1[0], v1[1], v1[6], v1[7],
            v2[0], v2[1], v2[6], v2[7]);
    if (pt) {
        addLocation(locations, include,
                flip ? c2 : c1, null,
                flip ? c1 : c2, null,
                true);
    }
    return locations;
}
```

## 13. Numerical Utilities

## 14. CurveLocation

```javascript
var CurveLocation = Base.extend(/** @lends CurveLocation# */{
    _class: 'CurveLocation',
    // DOCS: CurveLocation class description
    initialize: function CurveLocation(curve, time, point, _overlap, _distance) {
        // Merge intersections very close to the end of a curve with the
        // beginning of the next curve.
        if (time >= /*#=*/(1 - Numerical.CURVETIME_EPSILON)) {
            var next = curve.getNext();
            if (next) {
                time = 0;
                curve = next;
            }
        }
        this._setCurve(curve);
        this._time = time;
        this._point = point || curve.getPointAtTime(time);
        this._overlap = _overlap;
        this._distance = _distance;
        // Properties related to linked intersection locations
        this._intersection = this._next = this._previous = null;
    },
    
    // ... [methods omitted for brevity] ...
});
```
