## 1. Vendor Library Updates (independent of build toolchain)

- [x] 1.1 Download jQuery 3.7.1 minified, replace `public/vendor/jquery-3.4.1.min.js`, update the `<script>` src in `index.html` and `localEditor.html` to the new filename
- [x] 1.2 Download URI.js 1.19.6, replace `public/vendor/URI.js`
- [x] 1.3 Download current FileSaver.js release, replace `public/vendor/filesaver/FileSaver.js` (keep `Blob.js` unchanged)
- [x] 1.4 Download Selectize 0.15.x `selectize.js` and `selectize.default.css`, replace `public/vendor/selectize/selectize.js` and `selectize.default.css`
- [x] 1.5 Delete the `public/vendor/font-awesome/` directory (unused FA4 CSS copy)
- [x] 1.6 Add abandonment comments to `index.html` above the PrototypeJS and Scriptaculous `<script>` tags noting no upstream updates are available
- [x] 1.7 Test `localEditor.html` in a browser to verify vendor updates haven't broken basic editor load (jQuery conflict with Prototype, Selectize autocomplete still works) — editor loads, Selectize fires correctly; no results due to genomics.ontoserver.csiro.au being unreachable (pre-existing server issue, not a regression)

## 2. Font Awesome 6 Upgrade

- [x] 2.1 Run `npm install --save-dev @fortawesome/fontawesome-free@^6` to upgrade from v5
- [x] 2.2 Update `src/app.js` imports: replace v5 paths with FA6 equivalents — paths are identical in FA6 (`/js/fontawesome`, `/js/solid`), no change needed
- [x] 2.3 Update icon class references in `src/script/view/workspace.js` from `fa fa-*` to `fas fa-*` for all solid icons (pan, zoom, menu icons)
- [x] 2.4 Build and visually verify pan controls, zoom buttons, and menu icons render correctly in the browser ✓

## 3. Sass Toolchain (node-sass → dart-sass)

- [x] 3.1 Run `npm uninstall node-sass` — also done as prerequisite (blocked all installs on Node 24)
- [x] 3.2 Run `npm install --save-dev sass sass-loader@^16`
- [x] 3.3 Remove the `implementation` option from the `sass-loader` rule in `webpack.config.js` if present — not present, no change needed
- [x] 3.4 Run `npm run build` and verify SCSS compiles without errors ✓

## 4. Webpack 5 Migration

- [x] 4.1 Run `npm install --save-dev webpack@^5 webpack-cli@^6`
- [x] 4.2 Run `npm install --save-dev webpack-dev-server@^5`
- [x] 4.3 Run `npm uninstall file-loader html-webpack-plugin`
- [x] 4.4 Run `npm install --save-dev html-webpack-plugin@^5`
- [x] 4.5 Run `npm install --save-dev css-loader@^7 style-loader@^4`
- [x] 4.6 In `webpack.config.js`, replace `file-loader` rule with webpack 5 asset module (`type: 'asset/resource'`). Also added `url.filter` to css-loader to skip absolute `/resources/...` paths (XWiki server-side resources that were silently ignored in css-loader 3.x but cause errors in 7.x)
- [x] 4.7 In `webpack.config.js`, replace `devServer.contentBase` with `devServer.static`
- [x] 4.8 In `package.json`, replace `webpack -p` with `webpack --mode=production`; clean up `start` script
- [x] 4.9 Run `npm run build` and verify `dist/pedigree.min.js` is produced ✓
- [x] 4.10 Inspect `dist/pedigree.min.js` to confirm `$super` is present (not mangled) ✓
- [x] 4.11 Run `npm start` and verify dev server starts on port 9000 and serves the editor correctly ✓
- [x] 4.12 Test the full editor in browser: create nodes, add disorder/phenotype, save/load JSON — editor and graph rendering confirmed working; terminology search confirmed firing correctly (server unreachable is a separate pre-existing issue)

## 5. Babel Upgrade

- [x] 5.1 Run `npm install --save-dev @babel/core@^7 @babel/preset-env@^7 babel-loader@^9` — installed @babel/core@7.29.0, @babel/preset-env@7.29.5, babel-loader@9.2.1
- [x] 5.2 Run `npm run build` and verify no Babel errors ✓

## 6. Terser Plugin Upgrade

- [x] 6.1 Run `npm install --save-dev terser-webpack-plugin@^5` — installed 5.6.0
- [x] 6.2 Verify `webpack.config.js` TerserPlugin import works ✓ (explicit plugin still required for `reserved: ['$super']`)
- [x] 6.3 Run `npm run build` and re-verify `$super` is unmangled in output ✓

## 7. ESLint 9 Migration

- [x] 7.1 Run `npm install --save-dev eslint@^9 @eslint/js@^9` — installed eslint@9.39.4, @eslint/js@9.39.4
- [x] 7.2 Create `eslint.config.js` using flat config format with `@eslint/js` recommended base, replicating all rules from `.eslintrc`
- [x] 7.3 Delete the old `.eslintrc` file
- [x] 7.4 Run `npx eslint src/` and confirm it runs without config errors ✓ (pre-existing warnings/errors in source code, not config issues)

## 8. Final Audit and Cleanup

- [x] 8.1 Run `npm audit` — zero high/critical vulnerabilities ✓ (3 moderate remain in webpack-dev-server→sockjs→uuid; unfixable without breaking sockjs; devDependency only)
- [x] 8.2 Run `npm run build` one final time — compiled with 3 size warnings (expected), 0 errors ✓
- [x] 8.3 Update `package-lock.json` by running `npm install` (regenerate lockfile with all upgrades)
- [x] 8.4 Commit all changes on the `dependency-upgrade` branch with a message summarising packages upgraded
