# PathItem.getIntersections Function Call Hierarchy

This document provides a comprehensive overview of all functions called by `PathItem.getIntersections` in Paper.js. This is intended as a reference for implementing similar functionality in Papyrus2D.

## 1. Main Function: PathItem.getIntersections

**Location**: `/src/path/PathItem.js` (lines 321-339)

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

### 1.1 Dependencies

- `PathItem.getBounds`: Gets the bounding rectangle of the path
- `Rectangle.intersects`: Checks if two rectangles intersect
- `PathItem.getCurves`: Gets all curves in the path
- `Curve.getIntersections`: Main function for finding intersections between curves

## 2. Curve.getIntersections

**Location**: `/src/path/Curve.js` (lines 2106-2154)

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

### 2.1 Dependencies

- `Curve.getValues`: Gets the values of a curve
- `CollisionDetection.findCurveBoundsCollisions`: Finds potential collisions between curve bounds
- `getSelfIntersection`: Checks for self-intersections within a curve
- `getCurveIntersections`: Finds intersections between two curves

## 3. CollisionDetection.findCurveBoundsCollisions

**Location**: `/src/util/CollisionDetection.js` (lines 74-107)

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

### 3.1 Dependencies

- `CollisionDetection.findBoundsCollisions`: Finds collisions between bounds using sweep and prune algorithm

## 4. CollisionDetection.findBoundsCollisions

**Location**: `/src/util/CollisionDetection.js` (lines 143-268)

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
    
    // ... [implementation details omitted for brevity] ...
    
    return allCollisions;
}
```

## 5. getSelfIntersection

**Location**: `/src/path/Curve.js` (lines 2095-2104)

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

### 5.1 Dependencies

- `Curve.classify`: Classifies the type of curve (line, quadratic, serpentine, cusp, loop, arch)
- `addLocation`: Adds an intersection location to the result array

## 6. Curve.classify

**Location**: `/src/path/Curve.js` (lines 173-175)

```javascript
classify: function() {
    return Curve.classify(this.getValues());
}
```

### 6.1 Dependencies

- `Curve.classify` (static method): Determines the type of cubic Bézier curve via discriminant classification

## 7. getCurveIntersections

**Location**: `/src/path/Curve.js` (lines 2028-2093)

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
                // ... [implementation details omitted for brevity] ...
            }
        }
    }
    return locations;
}
```

### 7.1 Dependencies

- `getOverlaps`: Detects overlaps between curves
- `Curve.isStraight`: Checks if a curve is a straight line
- `addLineIntersection`: Adds intersections between two straight lines
- `addCurveLineIntersections`: Adds intersections between a curve and a line
- `addCurveIntersections`: Adds intersections between two curves

## 8. getOverlaps

**Location**: `/src/path/Curve.js` (lines 2160-2251)

```javascript
function getOverlaps(v1, v2) {
    // Linear curves can only overlap if they are collinear
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
        l2 = flip ? v1 : v2;
    
    // ... [implementation details omitted for brevity] ...
    
    return pairs;
}
```

### 8.1 Dependencies

- `Line.getDistance`: Calculates the distance from a point to a line
- `Curve.isStraight`: Checks if a curve is a straight line
- `Curve.getTimeOf`: Gets the curve-time parameter for a point on the curve
- `Curve.getPart`: Gets a sub-curve from a curve

## 9. addLocation

**Location**: `/src/path/Curve.js` (lines 1734-1767)

```javascript
function addLocation(locations, include, c1, t1, c2, t2, overlap) {
    var excludeStart = !overlap && c1.getPrevious() === c2,
        excludeEnd = !overlap && c1.getNext() === c2,
        tMin = /*#=*/Numerical.CURVETIME_EPSILON,
        tMax = 1 - tMin;
    if (t1 < tMin && (excludeStart || t1 < /*#=*/Numerical.EPSILON)) {
        t1 = 0;
    } else if (t1 > tMax && (excludeEnd || t1 > 1 - /*#=*/Numerical.EPSILON)) {
        t1 = 1;
    }
    if (t2 < tMin && (excludeStart || t2 < /*#=*/Numerical.EPSILON)) {
        t2 = 0;
    } else if (t2 > tMax && (excludeEnd || t2 > 1 - /*#=*/Numerical.EPSILON)) {
        t2 = 1;
    }
    
    // ... [implementation details omitted for brevity] ...
    
    return location;
}
```

### 9.1 Dependencies

- `Curve.getPrevious`: Gets the previous curve in the path
- `Curve.getNext`: Gets the next curve in the path
- `CurveLocation`: Class representing a location on a curve

## 10. addCurveIntersections

**Location**: `/src/path/Curve.js` (lines 1769-1866)

```javascript
function addCurveIntersections(v1, v2, c1, c2, locations, include, flip,
        recursion, calls, tMin, tMax, uMin, uMax) {
    // ... [implementation details omitted for brevity] ...
    
    // Subdivide curves if needed
    if (recursion++ > 32) {
        // If we get here, we have a numerical problem. We can't have
        // infinite recursion.
        if (calls < 4) {
            // Try a few more times with slightly relaxed tolerances.
            calls++;
            var newTDiff = (tMax - tMin) / 2,
                newUDiff = (uMax - uMin) / 2;
            addCurveIntersections(v1, v2, c1, c2, locations, include, flip,
                    0, calls, tMin, tMin + newTDiff, uMin, uMin + newUDiff);
            addCurveIntersections(v1, v2, c1, c2, locations, include, flip,
                    0, calls, tMin + newTDiff, tMax, uMin, uMin + newUDiff);
            addCurveIntersections(v1, v2, c1, c2, locations, include, flip,
                    0, calls, tMin, tMin + newTDiff, uMin + newUDiff, uMax);
            addCurveIntersections(v1, v2, c1, c2, locations, include, flip,
                    0, calls, tMin + newTDiff, tMax, uMin + newUDiff, uMax);
        }
    } else {
        // ... [implementation details omitted for brevity] ...
    }
    return locations;
}
```

### 10.1 Dependencies

- `Curve.getConvexHull`: Gets the convex hull of a curve
- `Curve.clipConvexHull`: Clips a convex hull against another convex hull
- `Curve.subdivide`: Subdivides a curve at a given parameter
- `Curve.evaluate`: Evaluates a curve at a given parameter

## 11. addCurveLineIntersections

**Location**: `/src/path/Curve.js` (lines 1991-2015)

```javascript
function addCurveLineIntersections(v1, v2, c1, c2, locations, include, flip) {
    var vc = v1, vl = v2;
    if (flip) {
        vc = v2;
        vl = v1;
    }
    var vcPoints = [
            new Point(vc[0], vc[1]),
            new Point(vc[2], vc[3]),
            new Point(vc[4], vc[5]),
            new Point(vc[6], vc[7])
        ],
        vlPoints = [
            new Point(vl[0], vl[1]),
            new Point(vl[6], vl[7])
        ],
        roots = [];
    // If the line is horizontal or vertical, use the corresponding curve
    // function that is much faster.
    // ... [implementation details omitted for brevity] ...
    return locations;
}
```

### 11.1 Dependencies

- `Point`: Class representing a point in 2D space
- `Curve.solveCubic`: Solves a cubic equation

## 12. addLineIntersection

**Location**: `/src/path/Curve.js` (lines 2017-2026)

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

### 12.1 Dependencies

- `Line.intersect`: Finds the intersection point between two lines

## 13. Numerical Utilities

**Location**: `/src/util/Numerical.js`

Several numerical constants and utility functions are used throughout the intersection code:

- `Numerical.EPSILON`: Small value used for floating-point comparisons
- `Numerical.GEOMETRIC_EPSILON`: Epsilon value for geometric comparisons
- `Numerical.CURVETIME_EPSILON`: Epsilon value for curve-time parameters
- `Numerical.solveQuadratic`: Solves a quadratic equation
- `Numerical.solveCubic`: Solves a cubic equation

## 14. CurveLocation

**Location**: `/src/path/CurveLocation.js`

Class representing a location on a curve, used to store intersection points:

```javascript
var CurveLocation = Base.extend(/** @lends CurveLocation# */{
    _class: 'CurveLocation',
    // DOCS: CurveLocation class description
    initialize: function CurveLocation(curve, time, point, _overlap, _distance) {
        // ... [implementation details omitted for brevity] ...
    },
    
    // ... [methods omitted for brevity] ...
});
```

## Summary

The `PathItem.getIntersections` method relies on a complex hierarchy of functions to efficiently find intersections between paths. The main algorithm uses:

1. **Bounding Box Optimization**: Initial quick check using bounding boxes to avoid unnecessary curve intersection tests
2. **Sweep and Prune Algorithm**: Efficient collision detection between curve bounds
3. **Recursive Subdivision**: For complex curve-curve intersections
4. **Special Case Handling**: For straight lines, overlaps, and self-intersections

This implementation provides a robust and efficient way to find all intersections between complex paths, handling various edge cases and numerical stability issues.
