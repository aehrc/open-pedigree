## REMOVED Requirements

### Requirement: URI.js updated
**Reason**: URI.js is now managed via the `urijs` npm package. The vendor file `public/vendor/URI.js` no longer exists.
**Migration**: Version is tracked via `package.json`. Run `npm outdated urijs` to check for updates; `npm audit` covers security vulnerabilities automatically.

### Requirement: FileSaver.js updated
**Reason**: FileSaver.js is now managed via the `file-saver` npm package. The vendor directory `public/vendor/filesaver/` no longer exists.
**Migration**: Version is tracked via `package.json`. Run `npm outdated file-saver` to check for updates.

### Requirement: Selectize updated
**Reason**: Selectize is now managed via the `@selectize/selectize` npm package. The vendor directory `public/vendor/selectize/` no longer exists.
**Migration**: Version is tracked via `package.json`. Run `npm outdated @selectize/selectize` to check for updates.

### Requirement: Unused Font Awesome 4 vendor copy removed
**Reason**: Fulfilled by this change — `public/vendor/font-awesome/` has been deleted. This requirement is now permanently satisfied and no longer needs ongoing tracking.
**Migration**: No action needed; the requirement is complete.
