# class-migration Specification

## Purpose
TBD - created by archiving change migrate-to-typescript. Update Purpose after archive.
## Requirements
### Requirement: All Class.create() files are converted to TypeScript ES6 classes
Every source file that uses `Class.create()` SHALL be renamed from `.js` to `.ts` and its class body rewritten as a TypeScript ES6 `class` declaration. The external behaviour of each class SHALL be preserved exactly.

#### Scenario: No Class.create() calls remain in .ts files
- **WHEN** `grep -r "Class.create" src/script/ --include="*.ts"` is run
- **THEN** it produces no output (zero matches)

#### Scenario: All 48 previously-Class.create files exist as .ts
- **WHEN** the migration is complete
- **THEN** each file that previously used `Class.create()` exists as a `.ts` file and has no corresponding `.js` file

---

### Requirement: initialize() is converted to constructor()
Each `initialize: function(...)` in a `Class.create()` block SHALL become a `constructor(...)` in the corresponding TypeScript class. The body SHALL be preserved identically (modulo `$super` replacement).

#### Scenario: initialize maps to constructor
- **WHEN** a `.ts` class file is inspected
- **THEN** it contains a `constructor` method, not an `initialize` method

---

### Requirement: $super is replaced with super() or super.method()
The PrototypeJS `$super` first-argument calling convention SHALL be replaced with TypeScript's `super()` (in constructors) and `super.methodName()` (in instance methods). The `$super` parameter SHALL be removed from function signatures.

#### Scenario: $super in constructor becomes super()
- **WHEN** a method `initialize($super, arg1, arg2)` calling `$super(arg1, arg2)` is migrated
- **THEN** the resulting constructor is `constructor(arg1: any, arg2: any) { super(arg1, arg2); ... }`

#### Scenario: $super in instance method becomes super.methodName()
- **WHEN** a method `someMethod($super, arg)` calling `$super(arg)` is migrated
- **THEN** the resulting method is `someMethod(arg: any): any { ... super.someMethod(arg); ... }`

#### Scenario: No $super parameters remain in .ts files
- **WHEN** `grep -r "\$super" src/script/ --include="*.ts"` is run
- **THEN** it produces no output

---

### Requirement: Inheritance is expressed via extends
When `Class.create(ParentClass, { ... })` has a parent class, the resulting TypeScript class SHALL use `extends ParentClass`. When there is no parent, the class has no `extends` clause.

#### Scenario: Single-parent inheritance preserved
- **WHEN** `var Person = Class.create(AbstractPerson, { ... })` is migrated
- **THEN** the result is `class Person extends AbstractPerson { ... }`

#### Scenario: Root class has no extends
- **WHEN** `var AbstractTerminology = Class.create({ ... })` (no parent) is migrated
- **THEN** the result is `class AbstractTerminology { ... }` with no `extends` clause

---

### Requirement: Static properties are preserved
Static properties defined on the constructor function after `Class.create()` (e.g. `MyClass.CONSTANT = ...`) SHALL be preserved either as `static CONSTANT = ...` inside the class body or as equivalent module-level assignments after the class declaration.

#### Scenario: Static constant accessible after migration
- **WHEN** code that accessed `BaseGraph.TYPE.PERSON` before migration accesses it after migration
- **THEN** the value is identical and no runtime error occurs

---

### Requirement: All exports use ES6 export default
Each converted `.ts` class file SHALL export its class as `export default ClassName`. Importing code that used `import X from 'pedigree/...'` SHALL continue to work without changes to import statements.

#### Scenario: Import statement unchanged after file rename
- **WHEN** a file imports `import Person from 'pedigree/view/person'` and `person.js` has been renamed to `person.ts`
- **THEN** the import continues to resolve and the class is usable

---

### Requirement: Unit tests pass after each migration layer
After converting each layer (terminology, root utils, view, orchestrators), all 27 Vitest unit tests SHALL pass, providing continuous verification that the model layer (which imports from converted files) has not been broken.

#### Scenario: Unit tests pass after terminology layer migration
- **WHEN** `npm test` is run after the terminology layer `.ts` conversion
- **THEN** all 27 tests pass

#### Scenario: Unit tests pass after view layer migration
- **WHEN** `npm test` is run after the view layer `.ts` conversion
- **THEN** all 27 tests pass

---

### Requirement: E2E tests pass after full migration
After all 48 files are converted, the 7 Playwright E2E tests SHALL pass, confirming that the browser runtime behaviour is identical to pre-migration.

#### Scenario: E2E tests pass after complete migration
- **WHEN** `npm run test:e2e` is run after all files are converted
- **THEN** all 7 E2E tests pass

---

### Requirement: Build produces valid bundle after migration
`npm run build` SHALL produce `dist/pedigree.min.js` successfully after the complete migration, with no webpack or TypeScript compilation errors.

#### Scenario: Production build succeeds post-migration
- **WHEN** `npm run build` is run after the full class migration
- **THEN** it exits 0 and `dist/pedigree.min.js` is present

