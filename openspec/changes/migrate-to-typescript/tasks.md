## 1. Toolchain Setup

- [ ] 1.1 Add `typescript` and `ts-loader` to `package.json` devDependencies and run `npm install`
- [ ] 1.2 Create `tsconfig.json` with lenient settings: `allowJs:true`, `strict:false`, `noImplicitAny:false`, `skipLibCheck:true`, target ES2017, `paths` aliases matching webpack aliases
- [ ] 1.3 Create `src/types/prototype.d.ts` declaring PrototypeJS globals as ambient: `$$`, `$`, `$F`, `Class`, `Ajax`, `Element` constructor/extend, `document.observe`, `document.fire`
- [ ] 1.4 Create `src/types/raphael.d.ts` declaring `Raphael` constructor and the subset of paper/element methods used in visuals code
- [ ] 1.5 Update `webpack.config.js`: add `ts-loader` rule for `\.tsx?$`, add `.ts` to `resolve.extensions`, add `.ts` to alias resolution; keep `babel-loader` for `\.jsx?$` (mutually exclusive)
- [ ] 1.6 Update `vitest.config.js`: add `.ts` to `resolve.extensions`
- [ ] 1.7 Add `"typecheck": "tsc --noEmit"` script to `package.json`
- [ ] 1.8 Verify: `npm run build` exits 0, `npm test` 27 passing, `npm run test:e2e` 7 passing, `npm run typecheck` exits 0

## 2. Terminology — Leaf Term Classes

Convert the four leaf term classes (no parent class, simplest patterns):

- [ ] 2.1 Rename and convert `terminology/abstractTerm.js` → `.ts`: `Class.create({...})` → `export default class AbstractTerm { constructor(...) {...} ... }`
- [ ] 2.2 Rename and convert `terminology/disorderTerm.js` → `.ts` (extends AbstractTerm)
- [ ] 2.3 Rename and convert `terminology/geneTerm.js` → `.ts` (extends AbstractTerm)
- [ ] 2.4 Rename and convert `terminology/phenotypeTerm.js` → `.ts` (extends AbstractTerm)
- [ ] 2.5 Verify: `npm test` 27 passing, `npm run build` exits 0

## 3. Terminology — Base Chain and Implementations

- [ ] 3.1 Rename and convert `terminology/abstractTerminology.js` → `.ts` (root class, no parent)
- [ ] 3.2 Rename and convert `terminology/abstractAjaxTerminology.js` → `.ts` (extends AbstractTerminology; replace `$super` in constructor)
- [ ] 3.3 Rename and convert `terminology/FHIRTerminology.js` → `.ts` (extends AbstractAjaxTerminology)
- [ ] 3.4 Rename and convert `terminology/StaticTerminology.js` → `.ts` (extends AbstractTerminology)
- [ ] 3.5 Rename and convert `terminology/BioportalTerminology.js` → `.ts` (extends AbstractAjaxTerminology)
- [ ] 3.6 Rename and convert `terminology/CTSSTerminology.js` → `.ts` (extends AbstractAjaxTerminology)
- [ ] 3.7 Rename and convert `terminology/DelegatingTerminology.js` → `.ts`
- [ ] 3.8 Rename and convert `terminology/EmptyTerminology.js` → `.ts`
- [ ] 3.9 Verify: `npm test` 27 passing, `npm run build` exits 0

## 4. Root Utility Classes

- [ ] 4.1 Rename and convert `disorder.js` → `.ts`
- [ ] 4.2 Rename and convert `hpoTerm.js` → `.ts`
- [ ] 4.3 Rename and convert `FhirTerminologyHelper.js` → `.ts`
- [ ] 4.4 Rename and convert `DefaultFhirTerminologyHelper.js` → `.ts` (extends FhirTerminologyHelper)
- [ ] 4.5 Rename and convert `undoRedo.js` → `.ts`
- [ ] 4.6 Rename and convert `versionUpdater.js` → `.ts`
- [ ] 4.7 Verify: `npm test` 27 passing, `npm run build` exits 0

## 5. View — Foundation (Abstract Base Classes)

- [ ] 5.1 Rename and convert `view/abstractNodeVisuals.js` → `.ts` (root visuals class)
- [ ] 5.2 Rename and convert `view/abstractPersonVisuals.js` → `.ts` (extends AbstractNodeVisuals)
- [ ] 5.3 Rename and convert `view/abstractNode.js` → `.ts` (root node class)
- [ ] 5.4 Rename and convert `view/abstractPerson.js` → `.ts` (extends AbstractNode)
- [ ] 5.5 Rename and convert `view/abstractHoverbox.js` → `.ts`
- [ ] 5.6 Verify: `npm test` 27 passing, `npm run build` exits 0

## 6. View — Concrete Node Classes

- [ ] 6.1 Rename and convert `view/personVisuals.js` → `.ts` (extends AbstractPersonVisuals)
- [ ] 6.2 Rename and convert `view/person.js` → `.ts` (extends AbstractPerson; replace `$super` in constructor and methods)
- [ ] 6.3 Rename and convert `view/personHoverbox.js` → `.ts` (extends AbstractHoverbox)
- [ ] 6.4 Rename and convert `view/partnershipVisuals.js` → `.ts` (extends AbstractNodeVisuals)
- [ ] 6.5 Rename and convert `view/partnership.js` → `.ts` (extends AbstractNode)
- [ ] 6.6 Rename and convert `view/partnershipHoverbox.js` → `.ts` (extends AbstractHoverbox)
- [ ] 6.7 Rename and convert `view/personGroupVisuals.js` → `.ts` (extends AbstractPersonVisuals)
- [ ] 6.8 Rename and convert `view/personGroup.js` → `.ts` (extends AbstractPerson)
- [ ] 6.9 Rename and convert `view/personGroupHoverbox.js` → `.ts` (extends AbstractHoverbox)
- [ ] 6.10 Rename and convert `view/readonlyHoverbox.js` → `.ts` (extends AbstractHoverbox)
- [ ] 6.11 Verify: `npm test` 27 passing, `npm run build` exits 0

## 7. View — UI Components

- [ ] 7.1 Rename and convert `view/legend.js` → `.ts`
- [ ] 7.2 Rename and convert `view/disorderLegend.js` → `.ts` (extends Legend)
- [ ] 7.3 Rename and convert `view/phenotypeLegend.js` → `.ts` (extends Legend)
- [ ] 7.4 Rename and convert `view/geneLegend.js` → `.ts` (extends Legend)
- [ ] 7.5 Rename and convert `view/lineSet.js` → `.ts`
- [ ] 7.6 Rename and convert `view/nodeMenu.js` → `.ts`
- [ ] 7.7 Rename and convert `view/nodetypeSelectionBubble.js` → `.ts`
- [ ] 7.8 Rename and convert `view/workspace.js` → `.ts`
- [ ] 7.9 Rename and convert `view/templateSelector.js` → `.ts`
- [ ] 7.10 Rename and convert `view/importSelector.js` → `.ts`
- [ ] 7.11 Rename and convert `view/exportSelector.js` → `.ts`
- [ ] 7.12 Verify: `npm test` 27 passing, `npm run build` exits 0

## 8. Root Orchestrators

- [ ] 8.1 Rename and convert `view.js` → `view.ts` (the View class that coordinates all view components)
- [ ] 8.2 Rename and convert `saveLoadEngine.js` → `.ts`
- [ ] 8.3 Rename and convert `controller.js` → `.ts` (most complex; many event handlers)
- [ ] 8.4 Rename and convert `pedigree.js` → `.ts` (root PedigreeEditor class, wires everything together)
- [ ] 8.5 Verify: `npm test` 27 passing, `npm run test:e2e` 7 passing, `npm run build` exits 0

## 9. Final Cleanup and Validation

- [ ] 9.1 Confirm no `.js` files remain for the 48 converted classes: `grep -r "Class.create" src/script/ --include="*.js"` produces no output
- [ ] 9.2 Confirm no `$super` remains in `.ts` files: `grep -r "\$super" src/script/ --include="*.ts"` produces no output
- [ ] 9.3 Remove `'$super'` from `terserOptions.reserved` in `webpack.config.js` (no longer needed)
- [ ] 9.4 Run `npm run typecheck` and resolve any type errors introduced during migration
- [ ] 9.5 Run `npm run build` — confirm `dist/pedigree.min.js` produced, exit 0
- [ ] 9.6 Run `npm test` — confirm all 27 unit tests pass
- [ ] 9.7 Run `npm run test:e2e` — confirm all 7 E2E tests pass
- [ ] 9.8 Commit the completed migration
