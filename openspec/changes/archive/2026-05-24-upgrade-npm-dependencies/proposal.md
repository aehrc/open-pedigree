## Why

The open-pedigree REDCap external module is blocked from acceptance because its dependencies are severely out of date — the build toolchain is frozen at ~2020 versions (webpack 4, node-sass, style-loader 0.x, eslint 5) with 104 known vulnerabilities, and several vendor-copied libraries loaded directly via `<script>` tags also carry unpatched CVEs. This is a prerequisite upgrade before any feature work can land.

## What Changes

- **npm devDependencies**: Upgrade webpack 4 → 5, drop deprecated `node-sass` and `file-loader` in favour of `sass` (dart-sass) and webpack 5 asset modules, upgrade all associated loaders and plugins (css-loader, style-loader, sass-loader, babel-loader, html-webpack-plugin, terser-webpack-plugin), upgrade webpack-dev-server 3 → 5, upgrade eslint 5 → 9, upgrade @babel/core and @babel/preset-env to latest 7.x, upgrade @fortawesome/fontawesome-free 5.x → 6.x with corrected import paths.
- **webpack config** (`webpack.config.js`): Migrate from webpack 4 API to webpack 5 — replace `file-loader` rules with asset modules, update `devServer.contentBase` → `devServer.static`, remove now-built-in `terser-webpack-plugin` explicit dependency where appropriate, ensure `$super` mangle-reserved still applies.
- **Vendor library copies** (`public/vendor/`): Replace jQuery 3.4.1 with 3.7.x (patches CVE-2020-11022/11023), replace URI.js 1.19.2 with 1.19.6, replace Selectize 0.12.6 with 0.15.x, update FileSaver.js to current release, clarify the dual Font Awesome situation (vendor FA4 vs npm FA5/6).
- **Abandonware vendor libraries**: PrototypeJS 1.7.3 and Scriptaculous have no maintained upstream — document as accepted risk; no replacement in scope.
- **XWiki/PhenoTips vendor scripts**: Custom project code (`public/vendor/xwiki/`, `public/vendor/phenotips/`) — not from a public package registry; document as out-of-scope for automated upgrades.

## Capabilities

### New Capabilities

- `build-toolchain-webpack5`: Webpack 5 build producing `dist/pedigree.min.js` with asset modules, sass (dart-sass), updated loaders and devServer config
- `npm-package-versions`: All npm devDependencies at current stable versions with no known high/critical vulnerabilities
- `vendor-library-versions`: Vendor-copied libraries (jQuery, URI.js, Selectize, FileSaver.js) updated to current patched releases
- `fontawesome-v6`: Font Awesome upgraded from v5 (npm) to v6 with updated import paths; vendor FA4 copy status clarified

### Modified Capabilities

_None — no spec-level behaviour changes; this is a build/infrastructure upgrade._

## Impact

- **`webpack.config.js`**: Significant rewrite for webpack 5 API; breaking changes in devServer config, asset handling, and plugin API
- **`package.json` / `package-lock.json`**: All devDependencies replaced/upgraded; lockfile regenerated
- **`src/app.js`**: Font Awesome import paths change between FA5 and FA6
- **`public/vendor/`**: jQuery, URI.js, Selectize, FileSaver.js files replaced in-place
- **`public/index.html`, `localEditor.html`**: Script tag paths unchanged (vendor filenames kept stable)
- **No changes** to `src/script/` application logic — this upgrade touches only the build layer and vendor copies
- **Risk**: webpack 4 → 5 is a major migration with several breaking changes; devServer 3 → 5 has breaking config changes; eslint 5 → 9 requires config file format migration
