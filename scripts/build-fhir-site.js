#!/usr/bin/env node
/**
 * Builds the published FHIR definitions into a site folder (GitHub Pages, see deploy-pages.yml):
 * for each fhir/<Type>/<id>.json, and the built-in default Questionnaire (dist/defaultQuestionnaire.json,
 * from `npm run build`):
 *   <out>/<Type>/<id>.json        the definition
 *   <out>/<Type>/<id>/index.html  what its canonical URL (<base><Type>/<id>) shows: a description
 *   <out>/index.html              every definition
 * Usage: node scripts/build-fhir-site.js <out dir>   (default _site/fhir)
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const BASE = 'https://aehrc.github.io/open-pedigree/fhir/';

const escapeHtml = (text) => String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
// The definitions' descriptions use `code` spans; nothing else.
const describe = (text) => escapeHtml(text).replace(/`([^`]+)`/g, '<code>$1</code>');

function page(title, body) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)} - open-pedigree FHIR</title>
<style>
  body { font-family: system-ui, sans-serif; max-width: 52rem; margin: 2rem auto; padding: 0 1rem; line-height: 1.5; color: #222; }
  code, pre { font-family: ui-monospace, monospace; font-size: 0.9em; }
  pre { background: #f5f5f5; padding: 1rem; overflow-x: auto; }
  table { border-collapse: collapse; } td, th { border: 1px solid #ddd; padding: 0.3rem 0.6rem; text-align: left; vertical-align: top; }
  .url { word-break: break-all; }
</style>
</head>
<body>
${body}
<p><a href="${BASE}">All open-pedigree FHIR definitions</a> · <a href="https://github.com/aehrc/open-pedigree">open-pedigree</a></p>
</body>
</html>
`;
}

// What a StructureDefinition carries, for its page.
function details(resource) {
  if (resource.resourceType === 'StructureDefinition' && resource.type === 'Extension') {
    const elements = resource.differential.element;
    const value = elements.find((e) => e.id === 'Extension.value[x]');
    const subs = elements.filter((e) => e.sliceName);
    const rows = [['Kind', 'Extension'], ['Used on', (resource.context || []).map((c) => '<code>' + escapeHtml(c.expression) + '</code>').join(', ')]];
    if (value && value.type) {
      rows.push(['Value', '<code>value' + escapeHtml(value.type[0].code.replace(/^./, (c) => c.toUpperCase())) + '</code>'
        + (value.binding ? ' from <a href="' + escapeHtml(value.binding.valueSet) + '">' + escapeHtml(value.binding.valueSet) + '</a>' : '')
        + (value.fixedBoolean !== undefined ? ' (always <code>' + value.fixedBoolean + '</code>)' : '')]);
    }
    if (subs.length) {
      rows.push(['Parts', subs.map((s) => '<code>' + escapeHtml(s.sliceName) + '</code>: ' + escapeHtml(s.definition)).join('<br>')]);
    }
    return rows;
  }
  if (resource.resourceType === 'StructureDefinition' && resource.kind === 'logical') {
    return [['Kind', 'Logical model'], ['Elements', resource.differential.element.slice(1)
      .map((e) => '<code>' + escapeHtml(e.path) + '</code> (' + escapeHtml(e.type[0].code) + '): ' + describe(e.definition)).join('<br>')]];
  }
  if (resource.resourceType === 'CodeSystem') {
    return [['Kind', 'Code system'], ['Codes', resource.concept.map((c) => '<code>' + escapeHtml(c.code) + '</code>: ' + escapeHtml(c.definition)).join('<br>')]];
  }
  if (resource.resourceType === 'ValueSet') {
    return [['Kind', 'Value set'], ['Includes', resource.compose.include.map((i) => '<a href="' + escapeHtml(i.system) + '">' + escapeHtml(i.system) + '</a>').join('<br>')]];
  }
  if (resource.resourceType === 'Questionnaire') {
    return [['Kind', 'Questionnaire'], ['Version', escapeHtml(resource.version || '')]];
  }
  return [];
}

function definitionPage(resource, jsonName) {
  const title = resource.title || resource.name || resource.id;
  const rows = [['Canonical URL', '<span class="url">' + escapeHtml(resource.url) + '</span>']].concat(details(resource));
  return page(title, `<h1>${escapeHtml(title)}</h1>
${resource.description ? '<p>' + describe(resource.description) + '</p>' : ''}
<table>${rows.map(([k, v]) => `<tr><th>${k}</th><td>${v}</td></tr>`).join('\n')}</table>
<p>Definition: <a href="../${escapeHtml(jsonName)}">${escapeHtml(jsonName)}</a> (FHIR R4 JSON)</p>`);
}

// [{type, id, resource}] for every definition to publish.
function definitions() {
  const out = [];
  const fhirDir = path.join(ROOT, 'fhir');
  for (const type of fs.readdirSync(fhirDir).sort()) {
    for (const file of fs.readdirSync(path.join(fhirDir, type)).sort()) {
      if (file.endsWith('.json')) {
        out.push({ type, id: file.slice(0, -5), resource: JSON.parse(fs.readFileSync(path.join(fhirDir, type, file), 'utf8')) });
      }
    }
  }
  const builtQuestionnaire = path.join(ROOT, 'dist', 'defaultQuestionnaire.json');
  if (!fs.existsSync(builtQuestionnaire)) {
    throw new Error('dist/defaultQuestionnaire.json is missing: run `npm run build` first');
  }
  const questionnaire = JSON.parse(fs.readFileSync(builtQuestionnaire, 'utf8'));
  out.push({ type: 'Questionnaire', id: 'default', resource: Object.assign({ id: 'default', title: questionnaire.title,
    description: 'The node-edit form open-pedigree uses when a host supplies no Questionnaire of its own.' }, questionnaire) });
  return out;
}

function build(outDir) {
  const all = definitions();
  for (const { type, id, resource } of all) {
    if (resource.url !== BASE + type + '/' + id) {
      throw new Error(`fhir/${type}/${id}.json: url ${resource.url} is not ${BASE}${type}/${id}`);
    }
    fs.mkdirSync(path.join(outDir, type, id), { recursive: true });
    fs.writeFileSync(path.join(outDir, type, id + '.json'), JSON.stringify(resource, null, 2) + '\n');
    fs.writeFileSync(path.join(outDir, type, id, 'index.html'), definitionPage(resource, id + '.json'));
  }
  const list = all.map(({ type, id, resource }) => `<tr><td><a href="${type}/${id}/">${escapeHtml(resource.title || id)}</a></td>`
    + `<td>${type}</td><td class="url"><code>${escapeHtml(resource.url)}</code></td></tr>`).join('\n');
  fs.writeFileSync(path.join(outDir, 'index.html'), page('open-pedigree FHIR definitions', `<h1>open-pedigree FHIR definitions</h1>
<p>The custom FHIR definitions open-pedigree (and redcap_pedigree_editor) use in GA4GH pedigrees and Questionnaires.
Each canonical URL shows its description; its JSON is beside it.</p>
<table><tr><th>Definition</th><th>Type</th><th>Canonical URL</th></tr>
${list}
</table>`));
  return all;
}

if (require.main === module) {
  const outDir = path.resolve(process.argv[2] || path.join(ROOT, '_site', 'fhir'));
  const built = build(outDir);
  console.log(`Wrote ${built.length} FHIR definitions to ${outDir}`);
}

module.exports = { build, definitions, BASE };
