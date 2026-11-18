#!/usr/bin/env node
/**
 * Builds open-pedigree's website (GitHub Pages, see deploy-pages.yml), apart from the FHIR
 * definitions (scripts/build-fhir-site.js, into <out>/fhir) and the built dist/ (copied by the
 * workflow into <out>/dist):
 *   <out>/index.html                      the landing page
 *   <out>/editor/index.html               the demo editor (localEditor.html, its dist/ paths adjusted)
 *   <out>/examples/<name>/index.html      each example's page (examples/<name>/about.json)
 *   <out>/examples/<name>/pedigree.json   its GA4GH FHIR pedigree (download; what the editor opens)
 *   <out>/examples/<name>/pedigree.svg    its picture
 * "Open in the editor" stores the example under its own key (example-<name>) and opens the editor
 * on it (editor/?example=<name>), so the visitor's own pedigree is never touched.
 * Usage (after npm run build): node scripts/build-site.js <out dir>   (default _site)
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const EXAMPLES = path.join(ROOT, 'examples');
const REPO = 'https://github.com/aehrc/open-pedigree';

const escapeHtml = (text) => String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const STYLE = `
  :root { color-scheme: light; }
  body { font-family: system-ui, sans-serif; max-width: 60rem; margin: 0 auto; padding: 0 1rem 3rem; line-height: 1.5; color: #222; background: #fff; }
  header { display: flex; flex-wrap: wrap; gap: 0.25rem 1.25rem; align-items: baseline; padding: 1rem 0; border-bottom: 1px solid #ddd; margin-bottom: 1.5rem; }
  header .name { font-weight: 600; font-size: 1.15rem; color: #222; text-decoration: none; margin-right: auto; }
  header a { color: #1a5c9e; }
  a { color: #1a5c9e; }
  h1 { font-size: 1.8rem; margin: 0 0 0.5rem; }
  h2 { font-size: 1.2rem; margin: 2rem 0 0.5rem; }
  .lead { font-size: 1.1rem; max-width: 44rem; }
  .button { display: inline-block; background: #1a5c9e; color: #fff; border: 0; border-radius: 6px; padding: 0.6rem 1.1rem; font: inherit; font-weight: 600; text-decoration: none; cursor: pointer; }
  .button:hover { background: #154a80; }
  .actions { display: flex; flex-wrap: wrap; gap: 0.75rem 1.25rem; align-items: center; margin: 1rem 0 1.5rem; }
  .cards { display: grid; grid-template-columns: repeat(auto-fill, minmax(16rem, 1fr)); gap: 1rem; padding: 0; list-style: none; }
  .cards li { border: 1px solid #ddd; border-radius: 8px; overflow: hidden; }
  .cards a { display: block; color: inherit; text-decoration: none; height: 100%; }
  .cards a:hover { background: #f6f9fc; }
  .cards img { display: block; width: 100%; height: 11rem; object-fit: contain; background: #fafafa; border-bottom: 1px solid #eee; }
  .cards .text { padding: 0.6rem 0.8rem 0.8rem; }
  .cards .title { font-weight: 600; color: #1a5c9e; }
  .cards .summary { font-size: 0.92rem; color: #444; }
  figure { margin: 0 0 1rem; border: 1px solid #ddd; border-radius: 8px; background: #fafafa; overflow-x: auto; }
  figure img { display: block; max-width: 100%; height: auto; margin: 0 auto; }
  .source { font-size: 0.95rem; }
  .problem { color: #a40000; font-weight: 600; }
  footer { margin-top: 3rem; padding-top: 1rem; border-top: 1px solid #ddd; font-size: 0.9rem; color: #555; }
`;

function page(title, root, body) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)}</title>
<link rel="icon" type="image/png" href="${root}dist/assets/open-pedigree-icon.png">
<style>${STYLE}</style>
</head>
<body>
<header>
  <a class="name" href="${root}">open-pedigree</a>
  <a href="${root}editor/">Editor</a>
  <a href="${root}#examples">Examples</a>
  <a href="${root}fhir/">FHIR definitions</a>
  <a href="${REPO}">GitHub</a>
</header>
${body}
<footer>open-pedigree is developed by the <a href="https://aehrc.csiro.au/">Australian e-Health Research Centre, CSIRO</a>, from the PhenoTips pedigree editor. <a href="${REPO}">Source on GitHub</a> (LGPL-2.1).</footer>
</body>
</html>
`;
}

// An example's folder name: what localEditor.html accepts in ?example= (else it opens pedigreeData).
const NAME = /^[a-z0-9-]+$/;
const FILES = ['example.json', 'about.json', 'pedigree.json', 'pedigree.svg'];

/** The problems with an about.json, as examples/README.md describes it. */
function aboutProblems(about) {
  const problems = [];
  const text = (v) => typeof v === 'string' && v.trim() !== '';
  const paragraphs = (v) => Array.isArray(v) && v.length > 0 && v.every(text);
  ['title', 'summary'].forEach((k) => text(about[k]) || problems.push(`${k} must be text`));
  ['shows', 'hard'].forEach((k) => paragraphs(about[k]) || problems.push(`${k} must be a list of paragraphs`));
  if (typeof about.order !== 'number') problems.push('order must be a number');
  if (about.kind === 'historic') {
    const source = about.source || {};
    ['citation', 'doi', 'figure'].forEach((k) => text(source[k]) || problems.push(`a historic example needs source.${k}`));
    paragraphs(about.simplified) || problems.push('a historic example needs simplified: a list of what was left out or left open');
  } else if (about.kind !== 'classic') {
    problems.push('kind must be classic or historic');
  }
  return problems;
}

/**
 * Every example: its name and about.json, ordered by `order`. Every folder in examples/ must be a
 * complete example (its sources and its generated files) with a valid name and about.json.
 */
function examples() {
  const problems = [];
  const all = fs.readdirSync(EXAMPLES, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => {
    const dir = path.join(EXAMPLES, d.name);
    if (!NAME.test(d.name)) problems.push(`examples/${d.name}: the folder name must be lower-case letters, digits and dashes`);
    const missing = FILES.filter((f) => !fs.existsSync(path.join(dir, f)));
    if (missing.length) {
      problems.push(`examples/${d.name}: missing ${missing.join(', ')}` + (missing.some((f) => f.startsWith('pedigree')) ? ' (run npm run examples:build)' : ''));
      return null;
    }
    const about = JSON.parse(fs.readFileSync(path.join(dir, 'about.json'), 'utf8'));
    aboutProblems(about).forEach((problem) => problems.push(`examples/${d.name}/about.json: ${problem}`));
    return { name: d.name, about };
  });
  if (problems.length) {
    throw new Error(problems.join('\n'));
  }
  return all.sort((a, b) => a.about.order - b.about.order || a.name.localeCompare(b.name));
}

function card(example) {
  const { name, about } = example;
  return `<li><a href="examples/${name}/"><img src="examples/${name}/pedigree.svg" alt="" loading="lazy"><div class="text">`
    + `<div class="title">${escapeHtml(about.title)}</div><div class="summary">${escapeHtml(about.summary)}</div></div></a></li>`;
}

function landing(all) {
  const classic = all.filter((e) => e.about.kind === 'classic');
  const historic = all.filter((e) => e.about.kind === 'historic');
  return page('open-pedigree', '', `
<h1>open-pedigree</h1>
<p class="lead">A pedigree editor that runs in the browser. Draw families of any shape, including consanguinity, twins and adoptions; mark disorders, genes and carriers; and save as GA4GH FHIR, PED and other formats. It can be embedded in other applications, such as REDCap.</p>
<div class="actions"><a class="button" href="editor/">Open the editor</a> <a href="${REPO}#readme">Documentation</a></div>

<h2 id="examples">Examples</h2>
<p>Families that are hard to draw, each with what it shows and why. Open any of them in the editor to explore or change it; your own pedigree in the editor is kept separately and isn't touched.</p>
<h2>Classic structures</h2>
<ul class="cards">${classic.map(card).join('')}</ul>
<h2>Historic families</h2>
<p>Drawn from the figure in each family's published source, which its page cites.</p>
<ul class="cards">${historic.map(card).join('')}</ul>

<h2>For developers</h2>
<p>The <a href="fhir/">FHIR definitions</a> of the extensions and value sets open-pedigree's GA4GH pedigrees use, and the <a href="${REPO}">source code</a>.</p>
`);
}

function examplePage(example) {
  const { name, about } = example;
  const paragraphs = (items) => (items || []).map((t) => `<p>${escapeHtml(t)}</p>`).join('\n');
  const source = about.source ? `
<h2>Source</h2>
<p class="source">${escapeHtml(about.source.citation)} ${escapeHtml(about.source.figure)}. <a href="https://doi.org/${escapeHtml(about.source.doi)}">doi:${escapeHtml(about.source.doi)}</a></p>` : '';
  const simplified = about.simplified && about.simplified.length ? `
<h2>Simplified</h2>
<ul>${about.simplified.map((t) => `<li>${escapeHtml(t)}</li>`).join('')}</ul>` : '';
  return page(about.title + ' - open-pedigree example', '../../', `
<p><a href="../../#examples">Examples</a></p>
<h1>${escapeHtml(about.title)}</h1>
<p class="lead">${escapeHtml(about.summary)}</p>
<div class="actions">
  <button class="button" id="open-in-editor" type="button">Open in the editor</button>
  <a href="pedigree.json" download="${escapeHtml(name)}.json">Download (GA4GH FHIR)</a>
  <span class="problem" id="open-problem" role="alert" hidden></span>
</div>
<figure><img src="pedigree.svg" alt="The pedigree: ${escapeHtml(about.title)}"></figure>
<h2>What it shows</h2>
${paragraphs(about.shows)}
<h2>Why it's hard to draw</h2>
${paragraphs(about.hard)}${source}${simplified}
<script>
  // A fresh copy of the example, under its own key: the visitor's own pedigree (pedigreeData) is
  // never touched, and opening again starts from the example as published.
  document.getElementById('open-in-editor').addEventListener('click', function () {
    var problem = document.getElementById('open-problem');
    problem.hidden = true;
    fetch('pedigree.json', { cache: 'no-cache' })
      .then(function (response) {
        if (!response.ok) throw new Error('the example could not be loaded (' + response.status + ')');
        return response.text();
      })
      .then(function (text) {
        // (only one example copy is kept: the large ones would soon fill the browser's storage,
        // which every aehrc.github.io site shares, and the visitor's own pedigree then couldn't be saved)
        Object.keys(localStorage).filter(function (key) { return key.indexOf('example-') === 0; })
          .forEach(function (key) { localStorage.removeItem(key); });
        localStorage.setItem(${JSON.stringify('example-' + name)}, JSON.stringify({ value: text, svg: null, context: null }));
        window.location.href = ${JSON.stringify('../../editor/?example=' + name)};
      })
      .catch(function (err) {
        problem.textContent = 'Couldn\\'t open the example in the editor: ' + (err && err.message ? err.message : err) + '.';
        problem.hidden = false;
      });
  });
</script>
`);
}

/** The demo editor, at editor/: localEditor.html with its dist/ paths one level up. */
function editorPage() {
  const html = fs.readFileSync(path.join(ROOT, 'localEditor.html'), 'utf8');
  const adjusted = html.replace(/(src|href)="dist\//g, '$1="../dist/');
  if (adjusted === html || /(src|href)="(?!\.\.\/|https?:|#|data:)[^"]+\.(js|css|png)"/.test(adjusted)) {
    throw new Error('localEditor.html: a relative path the editor page would lose at editor/ (only dist/ is adjusted)');
  }
  return adjusted;
}

function build(out) {
  const all = examples();
  const write = (file, content) => {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, content);
  };
  write(path.join(out, 'index.html'), landing(all));
  write(path.join(out, 'editor', 'index.html'), editorPage());
  // The bundle asks for its assets (the menu's icon) at dist/assets/, relative to the page
  // (webpack's asset publicPath), which from editor/ is editor/dist/assets/: put them there too.
  const assets = path.join(ROOT, 'dist', 'assets');
  if (!fs.existsSync(assets)) {
    throw new Error('dist/assets is missing: run npm run build first');
  }
  fs.cpSync(assets, path.join(out, 'editor', 'dist', 'assets'), { recursive: true });
  all.forEach((example) => {
    const dir = path.join(out, 'examples', example.name);
    write(path.join(dir, 'index.html'), examplePage(example));
    ['pedigree.json', 'pedigree.svg'].forEach((file) => fs.copyFileSync(path.join(EXAMPLES, example.name, file), path.join(dir, file)));
  });
  return all.map((e) => e.name);
}

if (require.main === module) {
  const out = path.resolve(process.argv[2] || path.join(ROOT, '_site'));
  try {
    const names = build(out);
    console.log(`site built in ${out}: landing page, editor, ${names.length} examples`);
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  }
}

module.exports = { build, aboutProblems };
