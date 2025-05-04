以下は、提供されたTypeScriptコードの各ファイルに含まれる関数およびメソッドのリストです。

**CompoundPath.ts**

*   constructor
*   _initialize
*   addChildren
*   addChild
*   removeChildren
*   getFirstChild
*   getLastChild
*   isClosed
*   setClosed
*   get closed
*   get segmentCount
*   getFirstSegment
*   getLastSegment
*   getSegments
*   getCurves
*   getFirstCurve
*   getLastCurve
*   getArea
*   getLength
*   getBounds
*   getPointAt
*   getTangentAt
*   contains
*   getIntersections
*   reorient
*   moveTo
*   moveBy
*   lineTo
*   cubicCurveTo
*   closePath
*   reverse
*   isClockwise
*   smooth
*   flatten
*   simplify
*   reduce
*   isEmpty
*   remove
*   _insertAt
*   insertAbove
*   _changed
*   copyAttributes
*   isSibling
*   getIndex
*   getPaths
*   clone

**Curve.ts**

*   constructor
*   getPrevious
*   getNext
*   getPoint1
*   getPoint2
*   getIndex
*   hasHandles
*   getLength
*   getValues
*   getPointAt
*   getTangentAt
*   getNormalAt
*   getWeightedTangentAt
*   getWeightedNormalAt
*   getCurvatureAt
*   getPointAtTime
*   getTangentAtTime
*   getNormalAtTime
*   getWeightedTangentAtTime
*   getWeightedNormalAtTime
*   getCurvatureAtTime
*   getTimesWithTangent
*   divide
*   split
*   splitAt
*   splitAtTime
*   divideAtTime
*   getLocationOf
*   getLocationAt
*   getLocationAtTime
*   getTimeOf
*   getTimeAt
*   getPartLength
*   _changed
*   isStraight
*   isLinear
*   static isStraight
*   static getTimeOf
*   static isLinear
*   static getPoint
*   static getArea
*   static getLength
*   static getValues
*   static isFlatEnough
*   static getTimeAt
*   static getIntersections
*   getIntersections

**CurveCalculation.ts**

*   static evaluate
*   static getPoint
*   static getTangent
*   static getNormal
*   static getWeightedTangent
*   static getWeightedNormal
*   static getCurvature
*   static getTimesWithTangent
*   static evaluateWithNull

**CurveGeometry.ts**

*   static isStraight
*   static isLinear
*   static getLength
*   static getLengthIntegrand
*   static getIterations
*   static getDistanceFromLine
*   static getDepth
*   static _getFatLineBounds
*   static classify
*   static getArea

**CurveIntersectionBase.ts**

*   getSelfIntersection
*   addLocation
*   insertLocation

**CurveIntersectionConvexHull.ts**

*   addCurveIntersections
*   getConvexHull
*   clipConvexHull
*   clipConvexHullPart

**CurveIntersectionMain.ts**

*   getCurveIntersections
*   getOverlaps
*   getIntersections

**CurveIntersectionSpecial.ts**

*   addLineIntersection
*   addCurveLineIntersections

**CurveIntersections.ts**
(このファイルは他のファイルから関数を再エクスポートしているため、このファイル自体に定義されている関数はありません。関数はCurveIntersectionBase, CurveIntersectionMain, CurveIntersectionSpecial, CurveIntersectionConvexHullに定義されています。)

**CurveLocation.ts**

*   constructor
*   getCurve
*   _setCurve
*   _setPath
*   getTime
*   getCurveOffset
*   getOffset
*   getPath
*   getIndex
*   getPoint
*   getSegment
*   _setSegment
*   getDistance
*   getIntersection
*   isTouching
*   isCrossing
*   hasOverlap
*   divide
*   split
*   equals
*   getTangent
*   getNormal
*   getCurvature

**CurveLocationUtils.ts**

*   static getTimeOf
*   static getNearestTime
*   static solveCubic
*   static getTimeAt
*   static equals
*   static isCrossing

**CurveSubdivision.ts**

*   static subdivide
*   static getPart
*   static getMonoCurves
*   static fromValues
*   static getValues
*   static getValues2
*   static divideCurve

**Path.ts**

*   static Line
*   static Circle
*   static Rectangle
*   static Ellipse
*   static Arc
*   static RegularPolygon
*   static Star
*   constructor
*   get segmentCount
*   getSegments
*   setSegments
*   _add
*   _adjustCurves
*   addSegments
*   getFirstSegment
*   getLastSegment
*   isClosed
*   setClosed
*   get closed
*   getLength
*   getArea
*   isClockwise
*   _changed
*   getBounds
*   getStrokeBounds
*   _computeBounds
*   getPointAt
*   getLocationOf
*   getOffsetOf
*   getLocationAt
*   getTangentAt
*   contains
*   _isOnPath
*   _getWinding
*   transform
*   translate
*   rotate
*   scale
*   _countCurves
*   getCurves
*   getFirstCurve
*   getLastCurve
*   add
*   insert
*   removeSegment
*   removeSegments
*   clear
*   moveTo
*   lineTo
*   cubicCurveTo
*   close
*   closePath
*   arcTo
*   hasHandles
*   clearHandles
*   unite
*   intersect
*   subtract
*   exclude
*   divide
*   getIntersections
*   getOffsetsWithTangent
*   isStraight
*   splitAt
*   equals
*   clone
*   flatten
*   simplify
*   isEmpty
*   remove
*   getInteriorPoint
*   reduce
*   isSibling
*   getIndex
*   insertAbove
*   copyAttributes
*   reverse
*   getPaths
*   setClockwise (継承されたPathItemBaseのメソッド)

**PathArc.ts**

*   static arcTo

**PathBoolean.ts**

*   static handleNoIntersections
*   static createResult
*   static traceBoolean
*   static unite
*   static intersect
*   static subtract
*   static exclude
*   static divide

**PathBooleanIntersections.ts**

*   getIntersections
*   dividePathAtIntersections
*   linkIntersections
*   clearCurveHandles

**PathBooleanPreparation.ts**

*   resolveCrossings
*   preparePath

**PathBooleanReorient.ts**

*   reorientPaths
*   getInteriorPoint

**PathBooleanTool.ts**

*   static getIntersections
*   static classifyIntersections
*   static getWindingAtPoint

**PathBooleanTracePaths.ts**

*   tracePaths

**PathBooleanWinding.ts**

*   asSegmentInfo
*   propagateWinding
*   getWinding

**PathConstructors.ts**

*   Line
*   Circle
*   Rectangle
*   Ellipse
*   Arc
*   RegularPolygon
*   Star

**PathFitter.ts**

*   constructor
*   fit
*   fitCubic
*   addCurve
*   generateBezier
*   reparameterize
*   findRoot
*   evaluate
*   chordLengthParameterize
*   findMaxError

**PathFlattener.ts**

*   constructor
*   _get
*   drawPart
*   getPointAt
*   getTangentAt
*   getNormalAt
*   getCurvatureAt

**PathGeometry.ts**

*   computeBounds
*   isOnPath
*   getWinding
*   getIntersections
*   contains

**PathItem.ts**
(これはインターフェースであり、関数/メソッドの実装は含まれていません。)

**PathItemBase.ts**

*   constructor (抽象)
*   get closed (抽象)
*   get segmentCount (抽象)
*   getSegments (抽象)
*   getCurves (抽象)
*   getArea (抽象)
*   reverse (抽象)
*   getPaths (抽象)
*   clone (抽象)
*   isClockwise
*   setClockwise
*   getLength (抽象)
*   getBounds (抽象)
*   getPointAt (抽象)
*   getTangentAt (抽象)
*   contains (抽象)
*   isEmpty (抽象)
*   remove (抽象)
*   reduce (抽象)
*   isSibling (抽象)
*   getIndex (抽象)
*   insertAbove (抽象)
*   copyAttributes (抽象)

**Segment.ts**

*   constructor
*   get point
*   get handleIn
*   get handleOut
*   _changed
*   getPoint
*   setPoint
*   getHandleIn
*   setHandleIn
*   getHandleOut
*   setHandleOut
*   hasHandles
*   isSmooth
*   clone
*   reverse
*   reversed
*   toString
*   equals
*   getIndex
*   getPath
*   getCurve
*   getLocation
*   transform
*   _transformCoordinates
*   smooth
*   getPrevious
*   getNext
*   isFirst
*   isLast
*   clearHandles
*   interpolate
*   remove

**SegmentPoint.ts**

*   constructor
*   _set
*   set
*   getX
*   setX
*   getY
*   setY
*   isZero
*   isCollinear
*   equals
*   toString
*   clone
*   toPoint
*   setPoint
*   getDistance
*   subtract
*   multiply