# native-zoom-slider Specification

## Purpose
TBD - created by archiving change remove-prototype. Update Purpose after archive.
## Requirements
### Requirement: Zoom slider uses native range input
The zoom control in `workspace.ts` SHALL use a native `<input type="range">` element instead of `Control.Slider` from Scriptaculous. The slider SHALL support the same zoom range and step behaviour as the previous implementation. Value changes SHALL fire the same zoom update logic via an `input` event listener.

#### Scenario: Slider renders without Scriptaculous
- **WHEN** the editor loads with Scriptaculous removed from the host page
- **THEN** the zoom slider is visible and functional

#### Scenario: Dragging slider changes zoom level
- **WHEN** the user drags the native range input
- **THEN** the pedigree canvas zoom coefficient updates in real time

#### Scenario: No remaining Control.Slider reference
- **WHEN** `grep -rn "Control\.Slider" src/script/` is run
- **THEN** it produces no output

### Requirement: Scriptaculous removed from vendor and host page
`public/vendor/scriptaculous/slider.js`, `effects.js`, and `dragdrop.js` SHALL be deleted. The `<script>` tags loading them in `localEditor.html` SHALL be removed.

#### Scenario: Build succeeds without Scriptaculous
- **WHEN** `npm run build` is run after Scriptaculous files are deleted
- **THEN** the build exits 0 and `dist/pedigree.min.js` is produced

