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
 *   <out>/examples/<name>/questionnaire.json  a form example's own Questionnaire
 *   <out>/try/index.html                  Try your own form: a Questionnaire, checked, on a pedigree
 * "Open in the editor" stores the example under its own key (example-<name>), and a form example's
 * Questionnaire under questionnaire-<name>, and opens the editor on it (editor/?example=<name>), so
 * the visitor's own pedigree is never touched. The Try page does the same under the name `try`.
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
  pre { background: #f5f5f5; padding: 0.75rem; overflow-x: auto; font-size: 0.85rem; border-radius: 6px; }
  .note { margin: 1rem 0 1.5rem; }
  fieldset { border: 1px solid #ddd; border-radius: 8px; padding: 0.75rem 1rem 1rem; margin: 0 0 1.25rem; }
  legend { font-weight: 600; padding: 0 0.3rem; }
  fieldset label { display: block; margin: 0.35rem 0; }
  textarea { width: 100%; box-sizing: border-box; min-height: 18rem; font-family: ui-monospace, monospace; font-size: 0.85rem; }
  input[type=url] { width: min(100%, 32rem); }
  .row { display: flex; flex-wrap: wrap; gap: 0.5rem; align-items: center; margin: 0.5rem 0; }
  .hint { color: #555; font-size: 0.92rem; }
  #problems li.fatal { color: #a40000; }
  #check-summary.ok { color: #1d6b2f; font-weight: 600; }
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
  <a href="${root}try/">Try your own form</a>
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
  } else if (about.kind === 'form') {
    const notes = about.questionnaire;
    if (!Array.isArray(notes) || !notes.length || !notes.every((n) => n && text(n.linkId) && text(n.what))) {
      problems.push('a form example needs questionnaire: a list of {linkId, what} for its notable items');
    }
  } else if (about.kind !== 'classic') {
    problems.push('kind must be classic, historic or form');
  }
  return problems;
}

/** A Questionnaire's items, nested ones included, by linkId. */
function itemsByLinkId(questionnaire, out = {}) {
  ((questionnaire && questionnaire.item) || []).forEach((item) => {
    out[item.linkId] = item;
    itemsByLinkId(item, out);
  });
  return out;
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
    const formFile = path.join(dir, 'questionnaire.json');
    let questionnaire = null;
    if (about.kind === 'form') {
      if (!fs.existsSync(formFile)) {
        problems.push(`examples/${d.name}: a form example needs questionnaire.json`);
      } else {
        questionnaire = JSON.parse(fs.readFileSync(formFile, 'utf8'));
        const items = itemsByLinkId(questionnaire);
        (about.questionnaire || []).filter((n) => n && !items[n.linkId])
          .forEach((n) => problems.push(`examples/${d.name}/about.json: questionnaire.json has no item ${n.linkId}`));
      }
    } else if (fs.existsSync(formFile)) {
      problems.push(`examples/${d.name}: questionnaire.json belongs to a form example (kind "form")`);
    }
    return { name: d.name, about, questionnaire };
  });
  if (problems.length) {
    throw new Error(problems.join('\n'));
  }
  return all.sort((a, b) => a.about.order - b.about.order || a.name.localeCompare(b.name));
}

// The page script both an example page and the Try page use to open the editor: fetch a file,
// and store an example (and a form) under the name's keys. Earlier copies are cleared first (the
// large examples would soon fill the browser's storage) - only open-pedigree's own keys, for its
// examples and the Try page, since every aehrc.github.io site shares that storage.
function handoff(all) {
  const names = all.map((e) => e.name).concat(['try']);
  return `  var OPEN_PEDIGREE_NAMES = ${JSON.stringify(names)};
  function fetchText(url) {
    return fetch(url, { cache: 'no-cache' }).then(function (response) {
      if (!response.ok) throw new Error(url + ' could not be loaded (' + response.status + ')');
      return response.text();
    });
  }
  function openInEditor(name, pedigreeText, questionnaire, root) {
    OPEN_PEDIGREE_NAMES.forEach(function (n) {
      localStorage.removeItem('example-' + n);
      localStorage.removeItem('questionnaire-' + n);
    });
    if (pedigreeText) {
      localStorage.setItem('example-' + name, JSON.stringify({ value: pedigreeText, svg: null, context: null }));
    }
    if (questionnaire) {
      localStorage.setItem('questionnaire-' + name, JSON.stringify(questionnaire));
    }
    window.location.href = root + 'editor/?example=' + name;
  }`;
}

function card(example) {
  const { name, about } = example;
  return `<li><a href="examples/${name}/"><img src="examples/${name}/pedigree.svg" alt="" loading="lazy"><div class="text">`
    + `<div class="title">${escapeHtml(about.title)}</div><div class="summary">${escapeHtml(about.summary)}</div></div></a></li>`;
}

function landing(all) {
  const classic = all.filter((e) => e.about.kind === 'classic');
  const historic = all.filter((e) => e.about.kind === 'historic');
  const forms = all.filter((e) => e.about.kind === 'form');
  return page('open-pedigree', '', `
<h1>open-pedigree</h1>
<p class="lead">A pedigree editor that runs in the browser. Draw families of any shape, including consanguinity, twins and adoptions; mark disorders, genes and carriers; and save as GA4GH FHIR, PED and other formats. It can be embedded in other applications, such as REDCap.</p>
<div class="actions"><a class="button" href="editor/">Open the editor</a> <a class="button" href="try/">Try your own form</a> <a href="${REPO}#readme">Documentation</a></div>

<h2 id="examples">Examples</h2>
<p>Families that are hard to draw, each with what it shows and why. Open any of them in the editor to explore or change it; your own pedigree in the editor is kept separately and isn't touched.</p>
<h2>Classic structures</h2>
<ul class="cards">${classic.map(card).join('')}</ul>
<h2>Historic families</h2>
<p>Drawn from the figure in each family's published source, which its page cites.</p>
<ul class="cards">${historic.map(card).join('')}</ul>
<h2>Configurable forms</h2>
<p>The editor's form for each person comes from a FHIR Questionnaire, which a project can replace with its own: extra fields, its own legends, fields that appear or lock as other answers change, and coded answers that travel in the GA4GH FHIR export. These examples are each drawn with their own form; <a href="try/">Try your own form</a> gives the editor yours.</p>
<ul class="cards">${forms.map(card).join('')}</ul>

<h2>For developers</h2>
<p>The <a href="fhir/">FHIR definitions</a> of the extensions and value sets open-pedigree's GA4GH pedigrees use, and the <a href="${REPO}">source code</a>.</p>
`);
}

function examplePage(example, all) {
  const { name, about, questionnaire } = example;
  const isForm = about.kind === 'form';
  const items = isForm ? itemsByLinkId(questionnaire) : {};
  const formNotes = isForm ? `
<h2>Its form</h2>
<p>The built-in form with a tab added. These are its notable items, as the Questionnaire gives them:</p>
${about.questionnaire.map((n) => `<div class="note"><p><strong>${escapeHtml(items[n.linkId].text || n.linkId)}</strong> (<code>${escapeHtml(n.linkId)}</code>): ${escapeHtml(n.what)}</p>`
    + `<pre>${escapeHtml(JSON.stringify(items[n.linkId], null, 2))}</pre></div>`).join('\n')}` : '';
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
  <a href="pedigree.json" download="${escapeHtml(name)}.json">Download (GA4GH FHIR)</a>${isForm ? `
  <a href="questionnaire.json" download="${escapeHtml(name)}-questionnaire.json">Download its Questionnaire</a>` : ''}
  <span class="problem" id="open-problem" role="alert" hidden></span>
</div>
<figure><img src="pedigree.svg" alt="The pedigree: ${escapeHtml(about.title)}"></figure>
<h2>What it shows</h2>
${paragraphs(about.shows)}
<h2>${isForm ? 'Why it matters' : 'Why it\'s hard to draw'}</h2>
${paragraphs(about.hard)}${formNotes}${source}${simplified}
<script>
${handoff(all)}
  // A fresh copy of the example (and its form), under its own key: the visitor's own pedigree
  // (pedigreeData) is never touched, and opening again starts from the example as published.
  document.getElementById('open-in-editor').addEventListener('click', function () {
    var problem = document.getElementById('open-problem');
    problem.hidden = true;
    Promise.all([fetchText('pedigree.json'), ${isForm ? "fetchText('questionnaire.json').then(JSON.parse)" : 'null'}])
      .then(function (files) {
        openInEditor(${JSON.stringify(name)}, files[0], files[1], '../../');
      })
      .catch(function (err) {
        problem.textContent = 'Couldn\\'t open the example in the editor: ' + (err && err.message ? err.message : err) + '.';
        problem.hidden = false;
      });
  });
</script>
`);
}

/**
 * Try your own form: a Questionnaire (the built-in one, a form example's, or the visitor's own -
 * pasted, uploaded or fetched), checked with the editor's own OpenPedigree.checkQuestionnaire,
 * and opened in the editor on a blank pedigree or any example, under the name `try`. Everything
 * shown from the visitor's input is set as text, never as HTML.
 */
function tryPage(all) {
  const forms = all.filter((e) => e.about.kind === 'form');
  const presets = forms.map((e) => `<label><input type="radio" name="form" value="${escapeHtml(e.name)}"> ${escapeHtml(e.about.title)} <span class="hint">- ${escapeHtml(e.about.summary)} <a href="../examples/${escapeHtml(e.name)}/">About it</a></span></label>`).join('\n  ');
  const options = all.map((e) => `<option value="${escapeHtml(e.name)}">${escapeHtml(e.about.title)}</option>`).join('');
  return page('Try your own form - open-pedigree', '../', `
<h1>Try your own form</h1>
<p class="lead">The editor's form for each person comes from a FHIR Questionnaire. Give it one - the built-in form, an example, or your own - check it, and open the editor with it, on a blank pedigree or one of the examples.</p>
<p class="hint">How a Questionnaire drives the form, and the extensions it can use, are described in the <a href="${REPO}#questionnaire-driven-custom-fields">README</a> and the <a href="../fhir/">FHIR definitions</a>. Nothing you enter leaves your browser.</p>

<fieldset>
  <legend>1. The form</legend>
  <label><input type="radio" name="form" value="builtin" checked> The built-in form</label>
  ${presets}
  <label><input type="radio" name="form" value="own"> Your own Questionnaire</label>
  <div id="own" hidden>
    <div class="row"><label for="upload">Upload a file:</label> <input type="file" id="upload" accept=".json,application/json,application/fhir+json"></div>
    <div class="row"><label for="url">Or fetch it from a URL:</label> <input type="url" id="url" placeholder="https://..."> <button type="button" id="fetch">Fetch</button></div>
    <p class="hint">A URL works only where its server allows other sites to read it (CORS). If it doesn't, download the file and upload it instead.</p>
    <label for="questionnaire">Or paste or edit it here (it starts as the built-in form):</label>
    <textarea id="questionnaire" spellcheck="false"></textarea>
  </div>
</fieldset>

<fieldset>
  <legend>2. The pedigree</legend>
  <label for="pedigree">Open the editor on:</label>
  <select id="pedigree"><option value="">A blank pedigree (choose a template)</option>${options}</select>
  <p class="hint" id="last-hint" hidden>Your last pedigree from this page is kept: choose it to carry on with your changes, or another to start again.</p>
</fieldset>

<fieldset>
  <legend>3. Check and open</legend>
  <div class="row"><button type="button" class="button" id="check">Check the form</button> <button type="button" class="button" id="open">Open in the editor</button></div>
  <p id="check-summary" role="status"></p>
  <ul id="problems"></ul>
</fieldset>

<script src="../dist/pedigree.min.js"></script>
<script>
${handoff(all)}
  // The pedigree last opened from this page, with the visitor's changes: offered first, so trying
  // another version of a form doesn't lose it.
  var lastPedigree = null;
  try {
    var stored = JSON.parse(localStorage.getItem('example-try'));
    lastPedigree = stored && stored.value ? stored.value : null;
  } catch (err) { lastPedigree = null; }
  if (lastPedigree) {
    var last = document.createElement('option');
    last.value = '__last__';
    last.textContent = 'The pedigree you last opened here, with your changes';
    document.getElementById('pedigree').insertBefore(last, document.getElementById('pedigree').firstChild);
    document.getElementById('pedigree').value = '__last__';
    document.getElementById('last-hint').hidden = false;
  }
  var textarea = document.getElementById('questionnaire');
  textarea.value = JSON.stringify(window.OpenPedigree.defaultQuestionnaire, null, 2);
  var summary = document.getElementById('check-summary');
  var list = document.getElementById('problems');
  var radios = Array.prototype.slice.call(document.querySelectorAll('input[name=form]'));
  var chosen = function () { return radios.filter(function (r) { return r.checked; })[0].value; };
  var choose = function (value) { radios.forEach(function (r) { r.checked = r.value === value; }); update(); };
  function update() {
    var form = chosen();
    document.getElementById('own').hidden = form !== 'own';
    // a form example brings its own pedigree (which can still be changed)
    if (form !== 'builtin' && form !== 'own') document.getElementById('pedigree').value = form;
    summary.textContent = '';
    summary.className = '';
    list.textContent = '';
  }
  radios.forEach(function (r) { r.addEventListener('change', update); });

  function show(message, problems) {
    list.textContent = '';
    summary.textContent = message;
    summary.className = problems && problems.length ? '' : 'ok';
    // fatal first, then in the order found
    (problems || []).slice().sort(function (a, b) { return (b.effect === 'fatal') - (a.effect === 'fatal'); })
      .forEach(function (p) {
        var li = document.createElement('li');
        li.className = p.effect;
        li.textContent = (p.effect === 'fatal' ? 'Not usable: ' : p.effect === 'moved' ? 'Moved: ' : 'Ignored: ') + p.message;
        list.appendChild(li);
      });
  }

  // The chosen form, checked: {questionnaire, problems, fatal}. The built-in form is null.
  function checked() {
    var form = chosen();
    if (form === 'builtin') return Promise.resolve({ questionnaire: null, problems: [], fatal: false });
    var source = form === 'own'
      ? Promise.resolve(textarea.value)
      : fetchText('../examples/' + form + '/questionnaire.json');
    return source.then(function (text) {
      var questionnaire;
      try {
        questionnaire = JSON.parse(text);
      } catch (err) {
        return { questionnaire: null, problems: [{ effect: 'fatal', message: 'This isn\\'t valid JSON: ' + err.message }], fatal: true };
      }
      var result = window.OpenPedigree.checkQuestionnaire(questionnaire);
      return { questionnaire: questionnaire, problems: result.problems, fatal: result.isFatal() };
    });
  }
  function report(result) {
    var n = result.problems.length;
    show(n === 0 ? 'No problems: the editor will use this form as it is.'
      : result.fatal ? 'The editor can\\'t use this form:'
        : n + (n === 1 ? ' problem' : ' problems') + ' - the editor will ignore ' + (n === 1 ? 'it' : 'them') + ' and use the rest of the form:', result.problems);
    return result;
  }
  var failed = function (what) {
    return function (err) { show(what + ': ' + (err && err.message ? err.message : err) + '.', []); summary.className = 'problem'; };
  };

  document.getElementById('check').addEventListener('click', function () {
    checked().then(report).catch(failed('Couldn\\'t check the form'));
  });
  document.getElementById('open').addEventListener('click', function () {
    checked().then(report).then(function (result) {
      if (result.fatal) return null;
      var pedigree = document.getElementById('pedigree').value;
      var text = pedigree === '__last__' ? Promise.resolve(lastPedigree)
        : pedigree ? fetchText('../examples/' + pedigree + '/pedigree.json') : Promise.resolve(null);
      return text
        .then(function (text) { openInEditor('try', text, result.questionnaire, '../'); });
    }).catch(failed('Couldn\\'t open the editor'));
  });

  document.getElementById('upload').addEventListener('change', function (event) {
    var file = event.target.files[0];
    if (!file) return;
    file.text().then(function (text) { textarea.value = text; choose('own'); show('Loaded ' + file.name + '.', []); })
      .catch(failed('Couldn\\'t read the file'));
  });
  document.getElementById('fetch').addEventListener('click', function () {
    var url = document.getElementById('url').value.trim();
    if (!url) return;
    fetch(url, { headers: { Accept: 'application/fhir+json, application/json' } })
      .then(function (response) {
        if (!response.ok) throw new Error('the server answered ' + response.status);
        return response.text();
      })
      .then(function (text) { textarea.value = text; choose('own'); show('Fetched the Questionnaire from that URL.', []); })
      .catch(function (err) {
        show('Couldn\\'t fetch it (' + (err && err.message ? err.message : err) + '). The server may not allow other sites to read it: download the file and upload it instead.', []);
        summary.className = 'problem';
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
    write(path.join(dir, 'index.html'), examplePage(example, all));
    ['pedigree.json', 'pedigree.svg'].concat(example.questionnaire ? ['questionnaire.json'] : [])
      .forEach((file) => fs.copyFileSync(path.join(EXAMPLES, example.name, file), path.join(dir, file)));
  });
  write(path.join(out, 'try', 'index.html'), tryPage(all));
  return all.map((e) => e.name);
}

if (require.main === module) {
  const out = path.resolve(process.argv[2] || path.join(ROOT, '_site'));
  try {
    const names = build(out);
    console.log(`site built in ${out}: landing page, editor, try page, ${names.length} examples`);
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  }
}

module.exports = { build, aboutProblems };
