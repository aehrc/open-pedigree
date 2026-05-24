## ADDED Requirements

### Requirement: Webpack 5 produces pedigree bundle
The build system SHALL use webpack 5 (not webpack 4) as the bundler, producing `dist/pedigree.min.js` from `src/app.js`. The bundle MUST include all application code and styles (CSS/SCSS) inlined, and MUST exclude all webpack externals (`XWiki`, `Class`, `Prototype`, `$$`, `$`, `$F`).

#### Scenario: Production build succeeds
- **WHEN** `npm run build` is executed
- **THEN** `dist/pedigree.min.js` is created without errors
- **AND** the file is minified (terser applied with `$super` in the reserved mangle list)

#### Scenario: Externals are not bundled
- **WHEN** the production bundle is inspected
- **THEN** it contains no PrototypeJS source code
- **AND** it contains no jQuery source code

### Requirement: Asset modules replace file-loader
The build system SHALL use webpack 5 native asset modules (`type: 'asset/resource'`) for PNG, SVG, JPG, and GIF files. The `file-loader` package SHALL NOT be present in `package.json`.

#### Scenario: Image assets are emitted correctly
- **WHEN** `npm run build` is executed and the source contains image imports
- **THEN** image files are emitted to `dist/assets/`
- **AND** references in the bundle resolve to `dist/assets/<filename>`

### Requirement: SCSS compiles with dart-sass
The build system SHALL use the `sass` package (dart-sass) via `sass-loader` to compile `.scss` files. The `node-sass` package SHALL NOT be present in `package.json`.

#### Scenario: SCSS compiles without errors
- **WHEN** `npm run build` is executed
- **THEN** all `.scss` imports compile successfully with no deprecation errors from node-sass

### Requirement: Dev server uses webpack-dev-server 5 API
The dev server SHALL use `webpack-dev-server` v5. The config SHALL use `devServer.static` (not the removed `devServer.contentBase`).

#### Scenario: Dev server starts
- **WHEN** `npm start` is executed
- **THEN** the dev server starts on port 9000 without errors
- **AND** `index.html` is served from the project root

### Requirement: Terser preserves $super identifier
The minimizer SHALL be configured with `$super` in the mangle reserved list, matching the existing PrototypeJS class system requirement.

#### Scenario: $super is not mangled in output
- **WHEN** `npm run build` is executed
- **THEN** the string `$super` is present and unmangled in `dist/pedigree.min.js` wherever it appears in source

### Requirement: ESLint 9 with flat config
The project SHALL use ESLint 9 with a `eslint.config.js` flat config file. The legacy `.eslintrc` file SHALL be removed.

#### Scenario: Lint runs without config errors
- **WHEN** `npx eslint src/` is executed
- **THEN** ESLint runs without "config file not found" or "unsupported config format" errors
- **AND** existing lint violations are reported as they were previously
