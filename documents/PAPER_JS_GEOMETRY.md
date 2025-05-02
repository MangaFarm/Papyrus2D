# Paper.js Geometry Implementation Documentation

## 1. Overview

Paper.js is a powerful JavaScript library for vector graphics manipulation, particularly excelling in geometric operations and boolean operations. This document details the geometric implementation in Paper.js, with a focus on boolean operations.

## 2. File Structure and Key Classes

### 2.1 Basic Structure

The geometric implementation in Paper.js is distributed across the following files:

- **Basic Classes**:
  - `/src/basic/Point.js`: Represents points and vectors in two-dimensional space
  - `/src/util/Numerical.js`: Utilities for numerical calculations (epsilon values, equation solvers, etc.)

- **Path-Related Classes**:
  - `/src/path/PathItem.js`: Base class for all path-related items
  - `/src/path/Path.js`: Represents a single path
  - `/src/path/CompoundPath.js`: Represents a compound path consisting of multiple sub-paths
  - `/src/path/Segment.js`: Represents segments of a path (anchor points and handles)
  - `/src/path/Curve.js`: Represents Bézier curves between segments
  - `/src/path/CurveLocation.js`: Represents specific locations on a curve

- **Boolean Operation Implementation**:
  - `/src/path/PathItem.Boolean.js`: Main implementation of boolean operations

- **Utility Classes**:
  - `/src/path/PathFlattener.js`: Converts curves to straight lines
  - `/src/path/PathFitter.js`: Fits Bézier curves to a sequence of points
  - `/src/util/CollisionDetection.js`: Collision detection algorithms

### 2.2 Class Hierarchy

```
Item
└── PathItem
    ├── Path
    └── CompoundPath
```

- **Item**: Base class for all graphic items
- **PathItem**: Base class for path-related items (parent of Path and CompoundPath)
- **Path**: Represents a single path
- **CompoundPath**: Represents a compound path consisting of multiple sub-paths

## 3. Key Component Details

### 3.1 Point (`/src/basic/Point.js`)

Basic class representing points and vectors in two-dimensional space.

**Key Methods**:
- `add()`, `subtract()`: Vector operations
- `multiply()`, `divide()`: Scaling
- `dot()`, `cross()`: Dot and cross products
- `normalize()`: Normalization
- `rotate()`: Rotation
- `getDistance()`: Distance calculation
- `isCollinear()`: Collinearity check

### 3.2 Segment (`/src/path/Segment.js`)

Class representing segments of a path. Consists of an anchor point (point) and two handles (handleIn, handleOut).

**Key Properties**:
- `point`: Anchor point of the segment
- `handleIn`: Input handle (tangent from the previous segment)
- `handleOut`: Output handle (tangent to the next segment)

**Key Methods**:
- `getPoint()`, `setPoint()`: Get/set anchor point
- `getHandleIn()`, `setHandleIn()`: Get/set input handle
- `getHandleOut()`, `setHandleOut()`: Get/set output handle
- `hasHandles()`: Check if handles are set
- `isSmooth()`: Check if segment is smooth
- `smooth()`: Smooth the segment

### 3.3 Curve (`/src/path/Curve.js`)

Class representing Bézier curves between two segments.

**Key Properties**:
- `segment1`, `segment2`: Start and end segments of the curve
- `point1`, `point2`: Start and end points of the curve
- `handle1`, `handle2`: Control handles of the curve

**Key Methods**:
- `getPoint(t)`: Get point at parameter t
- `getTangent(t)`: Get tangent at parameter t
- `getNormal(t)`: Get normal at parameter t
- `getLength()`: Calculate curve length
- `divideAt(t)`: Divide curve at parameter t
- `getIntersections(curve)`: Get intersections with another curve
- `getMonoCurves()`: Decompose into monotonic curves

**Static Methods**:
- `getValues()`: Get curve values as an array
- `solveCubic()`: Solve cubic equation
- `getTimeOf(point)`: Get parameter of closest point on curve

### 3.4 CurveLocation (`/src/path/CurveLocation.js`)

Class representing specific locations on a curve.

**Key Properties**:
- `curve`: Associated curve
- `time`: Parameter on curve (0-1)
- `point`: Coordinates of the location
- `intersection`: Intersection information (if exists)

**Key Methods**:
- `getSegment()`: Get associated segment
- `getPath()`: Get associated path
- `getIntersection()`: Get intersection information
- `isCrossing()`: Check if intersection is crossing
- `hasOverlap()`: Check if intersection has overlap

### 3.5 Path (`/src/path/Path.js`)

Class representing a path. Consists of an array of segments.

**Key Properties**:
- `segments`: Array of path segments
- `closed`: Whether the path is closed
- `fillRule`: Fill rule ('nonzero' or 'evenodd')

**Key Methods**:
- `add()`, `insert()`: Add segments
- `remove()`: Remove segments
- `getCurves()`: Get curves of the path
- `getLength()`: Calculate path length
- `contains(point)`: Check if point is inside path
- `isClockwise()`: Check if path is clockwise
- `reverse()`: Reverse path direction

### 3.6 CompoundPath (`/src/path/CompoundPath.js`)

Class representing a compound path consisting of multiple sub-paths.

**Key Properties**:
- `children`: Array of sub-paths

**Key Methods**:
- `addChild()`, `insertChild()`: Add sub-paths
- `removeChild()`: Remove sub-paths
- `getCurves()`: Get curves of all sub-paths
- `contains(point)`: Check if point is inside compound path
- `isClockwise()`: Check if compound path is clockwise

## 4. Boolean Operation Implementation (`/src/path/PathItem.Boolean.js`)

### 4.1 Supported Operations

Paper.js supports the following boolean operations:

1. **unite**: Union of two paths
2. **intersect**: Intersection of two paths
3. **subtract**: Subtract one path from another
4. **exclude**: Exclusive OR (XOR) of two paths
5. **divide**: Divide a path by another path

### 4.2 Key Algorithms

The implementation of boolean operations is based on the following key algorithms:

#### 4.2.1 Winding Number Algorithm

The winding number represents the number of times a closed path winds around a point. Paper.js uses winding numbers to determine the inside and outside of paths and to determine the result of boolean operations.

**Implementation**: `getWinding()` function in `/src/path/PathItem.Boolean.js` (lines 536-777)

```javascript
function getWinding(point, curves, dir, closed, dontFlip) {
    // Calculate winding number around a point
    // ...
}
```

#### 4.2.2 Path Intersection Resolution

Algorithm for resolving self-intersections and intersections between two paths.

**Implementation**: `resolveCrossings()` method in `/src/path/PathItem.js` (lines 1240-1345)

```javascript
resolveCrossings: function() {
    // Resolve path intersections
    // ...
}
```

#### 4.2.3 Path Tracing

Algorithm for constructing new paths from segments divided at intersection points.

**Implementation**: `tracePaths()` function in `/src/path/PathItem.Boolean.js` (lines 872-1110)

```javascript
function tracePaths(segments, operator) {
    // Construct new paths from segments
    // ...
}
```

#### 4.2.4 Winding Propagation

Algorithm for propagating winding numbers to segment chains starting from intersection points.

**Implementation**: `propagateWinding()` function in `/src/path/PathItem.Boolean.js` (lines 779-860)

```javascript
function propagateWinding(segment, path1, path2, curveCollisionsMap, operator) {
    // Propagate winding numbers
    // ...
}
```

### 4.3 Boolean Operation Implementation Flow

1. **Preparation**: `preparePath()` function in `/src/path/PathItem.Boolean.js` (lines 58-81) prepares paths
   - Clone paths
   - Resolve self-intersections
   - Adjust path orientation

2. **Intersection Detection**: `CurveLocation.expand()` and `divideLocations()` function in `/src/path/PathItem.Boolean.js` (lines 395-509) detect and divide at intersections

3. **Winding Calculation**: `getWinding()` function in `/src/path/PathItem.Boolean.js` (lines 536-777) calculates winding numbers

4. **Winding Propagation**: `propagateWinding()` function in `/src/path/PathItem.Boolean.js` (lines 779-860) propagates winding numbers

5. **Path Tracing**: `tracePaths()` function in `/src/path/PathItem.Boolean.js` (lines 872-1110) constructs result paths

6. **Result Creation**: `createResult()` function in `/src/path/PathItem.Boolean.js` (lines 83-97) creates final result

### 4.4 Public API

```javascript
// Union of paths
unite: function(path, options) {
    return traceBoolean(this, path, 'unite', options);
},

// Intersection of paths
intersect: function(path, options) {
    return traceBoolean(this, path, 'intersect', options);
},

// Subtraction of paths
subtract: function(path, options) {
    return traceBoolean(this, path, 'subtract', options);
},

// Exclusive OR of paths
exclude: function(path, options) {
    return traceBoolean(this, path, 'exclude', options);
},

// Division of paths
divide: function(path, options) {
    return options && (options.trace == false || options.stroke)
            ? splitBoolean(this, path, 'divide')
            : createResult([
                this.subtract(path, options),
                this.intersect(path, options)
            ], true, this, path, options);
}
```

## 5. Auxiliary Utilities

### 5.1 Numerical Calculation (`/src/util/Numerical.js`)

Provides utility functions for numerical calculations.

**Key Constants**:
- `EPSILON`: Floating-point precision (2.220446049250313e-16)
- `GEOMETRIC_EPSILON`: Precision for geometric calculations (1e-7)
- `TRIGONOMETRIC_EPSILON`: Precision for trigonometric calculations (1e-8)

**Key Functions**:
- `solveQuadratic()`: Solve quadratic equation
- `solveCubic()`: Solve cubic equation
- `getDiscriminant()`: Calculate discriminant
- `getNormalizationFactor()`: Calculate normalization factor

### 5.2 Collision Detection (`/src/util/CollisionDetection.js`)

Provides efficient collision detection algorithms.

**Key Functions**:
- `findItemBoundsCollisions()`: Detect collisions of item bounds
- `findCurveBoundsCollisions()`: Detect collisions of curve bounds
- `getItemBounds()`: Get item bounds
- `getItemBoundsCollisions()`: Get collisions of item bounds

### 5.3 Path Flattening (`/src/path/PathFlattener.js`)

Class for converting curves to straight line segments.

**Key Methods**:
- `flattenPath()`: Flatten path
- `getOffset()`: Get offset
- `getLocation()`: Get location

### 5.4 Path Fitting (`/src/path/PathFitter.js`)

Class for fitting Bézier curves to a sequence of points.

**Key Methods**:
- `fit()`: Fit Bézier curves to points
- `fitCubic()`: Fit cubic Bézier curves to points

## 6. Implementation Dependencies

The implementation of boolean operations depends on the following components:

1. **Point**: Basic vector operations
2. **Segment**: Representation of path segments
3. **Curve**: Representation and manipulation of Bézier curves
4. **CurveLocation**: Representation of locations and intersections on curves
5. **Path/CompoundPath**: Representation and manipulation of paths
6. **Numerical**: Utilities for numerical calculations
7. **CollisionDetection**: Efficient collision detection

## 7. Porting Considerations

Considerations for porting boolean operations to Papyrus2d:

1. **Winding Number Algorithm**: Core part of boolean operations, needs to be implemented accurately
2. **Numerical Stability**: Pay attention to floating-point precision issues and use appropriate epsilon values
3. **Intersection Detection**: Curve intersection detection is complex and requires special attention
4. **Path Orientation**: Path orientation (clockwise/counterclockwise) plays an important role in boolean operations
5. **Special Cases**: Handle special cases such as self-intersections, completely overlapping paths, and tangent paths

## 8. Conclusion

The geometric implementation in Paper.js, especially boolean operations, is built around the winding number algorithm. Understanding each component and their relationships as described in this document will facilitate porting to Papyrus2d.

For porting, it is recommended to start with basic classes (Point, Segment, Curve), then auxiliary utilities (Numerical, CollisionDetection), and finally the implementation of boolean operations.
