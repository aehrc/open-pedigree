// Run after webpack build (see package.json's postbuild script) - reads the Node/CommonJS
// build of defaultQuestionnaire.ts and writes it out as plain JSON, so non-JS consumers (e.g.
// a REDCap external module composing its own effective Questionnaire in PHP) can read/extend
// the built-in default without needing a JS toolchain. See questionnaire-source-of-truth design D14.
const fs = require('fs');
const path = require('path');

const builtModule = require(path.resolve(__dirname, '../dist/defaultQuestionnaire.node.js'));
const outputPath = path.resolve(__dirname, '../dist/defaultQuestionnaire.json');

fs.writeFileSync(outputPath, JSON.stringify(builtModule.DEFAULT_QUESTIONNAIRE, null, 2) + '\n');
console.log('Wrote ' + outputPath);
