## Purpose

Defines requirements for npm devDependency versions, vulnerability targets, and removal of deprecated packages.

## Requirements

### Requirement: No high or critical npm vulnerabilities
After upgrade, `npm audit` SHALL report zero high-severity and zero critical-severity vulnerabilities in devDependencies. The current baseline of 104 total vulnerabilities MUST be eliminated.

#### Scenario: Audit passes post-upgrade
- **WHEN** `npm audit` is executed on the upgraded `package.json`
- **THEN** the output reports 0 high vulnerabilities and 0 critical vulnerabilities

### Requirement: Core devDependencies at current stable versions
The following packages SHALL be at the specified minimum versions in `package.json`:

| Package | Minimum version |
|---|---|
| `webpack` | 5.x |
| `webpack-cli` | 6.x |
| `webpack-dev-server` | 5.x |
| `sass` | latest stable (replaces `node-sass`) |
| `sass-loader` | 16.x |
| `css-loader` | 7.x |
| `style-loader` | 4.x |
| `babel-loader` | 9.x |
| `@babel/core` | 7.27.x or later |
| `@babel/preset-env` | 7.27.x or later |
| `html-webpack-plugin` | 5.x |
| `terser-webpack-plugin` | 5.x |
| `eslint` | 9.x |
| `@fortawesome/fontawesome-free` | 6.x |
| `raphael` | 2.3.x (verify no newer release) |

#### Scenario: Package versions meet minimums
- **WHEN** `npm list --depth=0` is run after install
- **THEN** each package listed above is at or above the specified minimum version

### Requirement: Removed deprecated packages absent
The packages `node-sass` and `file-loader` SHALL NOT appear in `package.json` devDependencies or be installed in `node_modules`.

#### Scenario: Deprecated packages removed
- **WHEN** `npm list node-sass file-loader` is run
- **THEN** both packages are reported as missing (not installed)
