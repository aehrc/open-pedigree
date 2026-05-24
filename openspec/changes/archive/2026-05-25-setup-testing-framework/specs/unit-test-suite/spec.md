## ADDED Requirements

### Requirement: Vitest configured with project alias and jsdom
The project SHALL have a `vitest.config.js` that configures the `pedigree` module alias (pointing to `src/script/`), the `jsdom` test environment, and a test glob matching `tests/unit/**/*.test.js`.

#### Scenario: Unit tests run via npm test
- **WHEN** `npm test` is executed
- **THEN** Vitest starts, resolves `pedigree/...` imports correctly, and runs all files matching `tests/unit/**/*.test.js`
- **AND** exits with code 0 if all tests pass

#### Scenario: Alias resolution works
- **WHEN** a test file imports `from 'pedigree/model/helpers'`
- **THEN** Vitest resolves it to `src/script/model/helpers.js` without error

### Requirement: helpers.js utility functions tested
The file `tests/unit/model/helpers.test.js` SHALL cover the exported utility functions in `src/script/model/helpers.js`.

#### Scenario: isInt identifies integers correctly
- **WHEN** `isInt` is called with `42`, `'42'`, `3.0`
- **THEN** it returns `true`

#### Scenario: isInt rejects non-integers
- **WHEN** `isInt` is called with `3.5`, `'abc'`, `null`
- **THEN** it returns `false`

#### Scenario: replaceInArray replaces first occurrence
- **WHEN** `replaceInArray([1, 2, 1], 1, 9)` is called
- **THEN** the array becomes `[9, 2, 1]`

#### Scenario: filterUnique removes duplicates
- **WHEN** `filterUnique([1, 2, 1, 3])` is called
- **THEN** the result contains each value exactly once

### Requirement: BaseGraph structure tested
The file `tests/unit/model/baseGraph.test.js` SHALL test node and edge operations on `BaseGraph`.

#### Scenario: Empty graph has zero nodes
- **WHEN** a new `BaseGraph` is constructed
- **THEN** `getNumNodes()` returns 0

#### Scenario: Adding a person node increases count
- **WHEN** a person node is added to a BaseGraph
- **THEN** `getNumNodes()` returns 1
- **AND** the node can be retrieved by its ID

#### Scenario: Adding an edge connects two nodes
- **WHEN** two nodes are added and an edge is created between them
- **THEN** the graph reports the edge exists between those nodes

### Requirement: JSON import/export round-trip tested
The file `tests/unit/model/import-export.test.js` SHALL verify that a pedigree serialised to JSON and re-imported produces the same graph structure.

#### Scenario: Empty pedigree round-trips
- **WHEN** an empty pedigree is exported to JSON and re-imported
- **THEN** the resulting graph has the same node count and structure as the original

#### Scenario: Single person pedigree round-trips
- **WHEN** a pedigree with one person node is exported to JSON and re-imported
- **THEN** the person node's properties (sex, etc.) are preserved

### Requirement: GA4GH FHIR export tested
The file `tests/unit/model/GA4GHFHIRConverter.test.js` SHALL test the GA4GH FHIR export using `vi.mock()` to stub `TerminologyManager`.

#### Scenario: GA4GH export produces valid FHIR JSON
- **WHEN** a minimal pedigree is exported via GA4GHFHIRConverter
- **THEN** the result is valid JSON containing a FHIR resource

### Requirement: Coverage report available
Running `npm run test:coverage` SHALL produce a coverage report in `coverage/` showing line and branch coverage for files under `src/script/model/`.

#### Scenario: Coverage report generated
- **WHEN** `npm run test:coverage` is executed
- **THEN** a `coverage/` directory is created containing an HTML or JSON report
- **AND** the report includes coverage data for model layer files
