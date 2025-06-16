# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Papyrus2D is a TypeScript library that extracts the geometric computation functionality from Paper.js. It focuses purely on geometric calculations and operations, removing all rendering and DOM-related features to create a lightweight, dependency-minimal library.

## Commands

### Development Commands
- `npm run dev` - Run Vite development server
- `npm run build` - Build the library (outputs papyrus2d.es.js and papyrus2d.umd.js)
- `npm run test` - Run all tests with Vitest
- `npm run lint` - Run ESLint on JavaScript/TypeScript files
- `npm run format` - Format code with Prettier

### Running Single Tests
To run a specific test file:
```bash
npm run test path/to/test.test.ts
```

## Architecture

The codebase is organized into three main areas:

### 1. Basic Geometry (`/src/basic/`)
Immutable classes for fundamental geometric primitives:
- Point, Size, Rectangle, Line, Matrix
- All classes follow an immutable design pattern

### 2. Path System (`/src/path/`)
Complex path manipulation and geometric operations:
- **Core Classes**: Path, CompoundPath, Segment, Curve
- **Operations**: Boolean operations (PathBoolean*), path fitting, flattening, simplification
- **Utilities**: Intersection detection, winding calculations, SVG import/export

### 3. Utilities (`/src/util/`)
- Numerical: Mathematical operations and equation solvers (ported from Paper.js)
- CollisionDetection: Geometric collision algorithms

## Key Implementation Details

- **No Entry Point**: The referenced `src/index.ts` doesn't exist yet
- **Immutable Design**: All geometry classes return new instances rather than modifying existing ones
- **Paper.js Compatibility**: Algorithms are ported from Paper.js to maintain behavioral compatibility
- **Test Structure**: Debug tests (*.debug.test.ts) are used for isolated testing of specific functionality
- **Disabled Tests**: Files with `.waiting` extension are temporarily disabled tests

## Current Development Focus

The project is actively implementing path boolean operations. When working on these:
1. Reference the original Paper.js implementation for algorithm correctness
2. Maintain the immutable design pattern
3. Write tests for edge cases, especially for curve intersections
4. Use debug tests to isolate and fix specific issues

## Testing Approach

- Unit tests should cover both basic functionality and edge cases
- Debug tests are valuable for complex geometric operations
- Visual comparison tests use PNG output for validating geometric results