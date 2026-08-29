import * as Blockly from 'blockly';
import './blocks/index.js';
import { toolbox } from './toolbox.js';
import { theme } from './theme.js';
import { buildProject, sanitizeName } from './generator/java.js';
import * as api from './api.js';
import { serialize, deserialize, saveLocal, loadLocal, clearLocal, downloadBlob, pickFile, defaultMeta, FILE_EXT } from './project.js';
import { starterProject } from './examples/starter.js';
import { buildResourcePack, hasResourcePack } from './resourcepack.js';
import './style.css';

const $ = (id) => document.getElementById(id);
const PHONE = window.matchMedia('(max-width: 760px)');

Blockly.config.snapRadius = 36;
Blockly.config.connectingSnapRadius = 40;

if (import.meta.hot) {
  import.meta.hot.accept(() => window.location.reload());
}

let workspace = null;
let meta = defaultMeta();
let codePanelOpen = false;
let saveTimer = null;
let toastTimer = null;

function injectWorkspace(state) {
  const phone = PHONE.matches;
  if (workspace) {
    workspace.dispose();
    $('blockly').innerHTML = '';
  }
  workspace = Blockly.inject('blockly', {
    toolbox,
    theme,
    renderer: 'zelos',
    horizontalLayout: phone,
    toolboxPosition: phone ? 'end' : 'start',
    grid: { spacing: 28, length: 1, colour: '#c9d0de', snap: true },
    zoom: { controls: true, wheel: true, startScale: phone ? 0.6 : 0.75, maxScale: 2, minScale: 0.3, pinch: true },
    move: { scrollbars: true, drag: true, wheel: false },
    trashcan: !phone,
    sounds: false,
  });
  if (state) {
    Blockly.serialization.workspaces.load(state, workspace);
  }
  workspace.addChangeListener(onWorkspaceChange);
  workspace.scrollCenter();
}

function onWorkspaceChange(event) {
  if (event.isUiEvent) return;
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    persist();
    if (codePanelOpen) generate();
  }, 250);
}

function readMeta() {
  meta = {
    name: $('meta-name').value.trim() || 'MyPlugin',
    version: $('meta-version').value.trim() || '1.0.0',
    author: $('meta-author').value.trim(),
    description: $('meta-description').value.trim(),
  };
  return meta;
}

function writeMeta(m) {
  $('meta-name').value = m.name;
  $('meta-version').value = m.version;
  $('meta-author').value = m.author;
  $('meta-description').value = m.description;
}

function setStatus(text, kind = '') {
  const el = $('status');
  el.textContent = text;
  el.className = 'status ' + kind;
}

function toast(text, kind = '') {
  const el = $('toast');
  el.textContent = text;
  el.className = 'toast show ' + kind;
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    el.classList.remove('show');
  }, 2600);
}

function notify(text, kind = '') {
  setStatus(text, kind);
  if (kind) toast(text, kind);
}

function showErrors(errors) {
  const box = $('errors');
  box.innerHTML = '';
  if (!errors || !errors.length) {
    box.hidden = true;
    return;
  }
  box.hidden = false;
  for (const e of errors) {
    const line = document.createElement('div');
    line.className = 'error-line';
    line.textContent = (e.line ? `Line ${e.line}: ` : '') + (e.message || String(e));
    box.appendChild(line);
  }
}

const escapeHtml = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const KEYWORDS = /\b(package|import|public|private|protected|static|final|class|extends|implements|return|new|if|else|for|while|switch|case|default|try|catch|throws|throw|instanceof|void|boolean|int|double|float|long|String|Object|true|false|null|this|super|var)\b/g;

function highlight(src) {
  const tokens = [];
  const store = (html) => `\u0000${tokens.push(html) - 1}\u0000`;
  let out = escapeHtml(src)
    .replace(/\/\*\*[\s\S]*?\*\//g, (m) => store(`<span class="c">${m}</span>`))
    .replace(/\/\/[^\n]*/g, (m) => store(`<span class="c">${m}</span>`))
    .replace(/"(?:[^"\\]|\\.)*"/g, (m) => store(`<span class="s">${m}</span>`))
    .replace(/@\w+/g, (m) => store(`<span class="a">${m}</span>`))
    .replace(/\b(?:org\.powernukkitx|java\.util)\.[\w.]+/g, (m) => store(`<span class="t">${m}</span>`))
    .replace(KEYWORDS, '<span class="k">$1</span>')
    .replace(/\b\d+(?:\.\d+)?[fLd]?\b/g, '<span class="n">$&</span>');
  out = out.replace(/\u0000(\d+)\u0000/g, (_, i) => tokens[Number(i)]);
  return out;
}

function generate() {
  try {
    const project = buildProject(workspace, readMeta());
    $('code').innerHTML = highlight(project.java);
    return project;
  } catch (err) {
    console.error(err);
    $('code').textContent = '// Generation error: ' + err.message;
    return null;
  }
}

function persist() {
  saveLocal(serialize(workspace, readMeta()));
}

function setCodePanel(open) {
  codePanelOpen = open;
  document.body.classList.toggle('code-open', open);
  $('btn-code').classList.toggle('active', open);
  $('code-panel').setAttribute('aria-hidden', String(!open));
  if (open) generate();
  Blockly.svgResize(workspace);
}

const MENUS = [
  { button: 'menu-file', panel: 'file-menu' },
  { button: 'btn-project', panel: 'meta' },
];

function setMenu(name, open) {
  for (const m of MENUS) {
    const isTarget = m.button === name;
    $(m.panel).hidden = !(isTarget && open);
    $(m.button).setAttribute('aria-expanded', String(isTarget && open));
  }
}

function closeMenus() {
  setMenu('', false);
}

for (const m of MENUS) {
  $(m.button).addEventListener('click', () => {
    setMenu(m.button, $(m.panel).hidden);
  });
}

$('file-menu').addEventListener('click', (e) => {
  if (e.target.closest('button')) closeMenus();
});

function loadProject(data) {
  const m = deserialize(new Blockly.Workspace(), data);
  meta = m;
  writeMeta(meta);
  injectWorkspace(data.workspace || {});
  persist();
  if (codePanelOpen) generate();
}

for (const id of ['meta-name', 'meta-version', 'meta-author', 'meta-description']) {
  $(id).addEventListener('input', () => {
    persist();
    if (codePanelOpen) generate();
  });
}

document.addEventListener('click', (e) => {
  if (e.target.closest('.menu-group')) return;
  closeMenus();
});

$('btn-code').addEventListener('click', () => setCodePanel(!codePanelOpen));
$('btn-close-code').addEventListener('click', () => setCodePanel(false));

$('btn-copy').addEventListener('click', async () => {
  const project = generate();
  if (!project) return;
  try {
    await navigator.clipboard.writeText(project.java);
    notify('Java source copied', 'ok');
  } catch {
    notify('Could not copy to clipboard', 'error');
  }
});

$('btn-new').addEventListener('click', () => {
  if (!confirm('Start a new project? Unsaved blocks will be lost.')) return;
  clearLocal();
  showErrors([]);
  loadProject(starterProject);
  notify('New project', 'ok');
});

$('btn-save').addEventListener('click', () => {
  const project = serialize(workspace, readMeta());
  const blob = new Blob([JSON.stringify(project, null, 2)], { type: 'application/json' });
  downloadBlob(blob, sanitizeName(meta.name) + FILE_EXT);
  notify('Project saved', 'ok');
});

$('btn-open').addEventListener('click', async () => {
  const file = await pickFile('.json,' + FILE_EXT);
  if (!file) return;
  try {
    const data = JSON.parse(await file.text());
    loadProject(data);
    notify(`Opened ${file.name}`, 'ok');
  } catch (err) {
    notify('Could not open project: ' + err.message, 'error');
  }
});

const buildModal = {
  el: $('build-modal'),
  timer: null,
  progress: 0,
  target: 0,
  lastArtifact: null,

  open(project) {
    this.lastArtifact = null;
    this.el.className = 'modal building';
    this.el.hidden = false;
    $('build-title').textContent = 'Building your plugin';
    $('build-subtitle').textContent = `${project.name} ${project.version}`;
    $('build-errors').hidden = true;
    $('build-errors').innerHTML = '';
    $('build-download').hidden = true;
    $('build-pack').hidden = true;
    $('build-pack-hint').hidden = true;
    $('build-close').hidden = true;
    for (const li of $('build-steps').children) li.className = '';
    this.progress = 0;
    this.target = 0;
    this.render();
    clearInterval(this.timer);
    this.timer = setInterval(() => {
      if (this.progress < this.target) {
        this.progress = Math.min(this.target, this.progress + Math.max(0.3, (this.target - this.progress) * 0.12));
        this.render();
      }
    }, 60);
  },

  step(name, target) {
    let reached = false;
    for (const li of $('build-steps').children) {
      if (li.dataset.step === name) {
        li.className = 'active';
        reached = true;
      } else {
        li.className = reached ? '' : 'done';
      }
    }
    this.target = target;
  },

  render() {
    $('build-bar').style.width = `${this.progress}%`;
    $('build-percent').textContent = `${Math.round(this.progress)}%`;
  },

  success(filename, blob, pack) {
    clearInterval(this.timer);
    this.progress = 100;
    this.target = 100;
    this.render();
    for (const li of $('build-steps').children) li.className = 'done';
    this.el.className = 'modal success';
    $('build-title').textContent = 'Plugin ready';
    $('build-subtitle').textContent = filename;
    this.lastArtifact = { filename, blob, pack };
    $('build-download').hidden = false;
    $('build-pack').hidden = !pack;
    $('build-pack-hint').hidden = !pack;
    $('build-close').hidden = false;
  },

  fail(message, errors) {
    clearInterval(this.timer);
    this.target = this.progress;
    this.render();
    const active = $('build-steps').querySelector('.active');
    if (active) active.className = 'failed';
    this.el.className = 'modal error';
    $('build-title').textContent = 'Build failed';
    $('build-subtitle').textContent = message;
    const box = $('build-errors');
    box.innerHTML = '';
    for (const e of errors || []) {
      const line = document.createElement('div');
      line.textContent = (e.line ? `Line ${e.line}: ` : '') + (e.message || String(e));
      box.appendChild(line);
    }
    box.hidden = !(errors && errors.length);
    $('build-close').hidden = false;
  },

  unchanged(filename, blob, pack) {
    clearInterval(this.timer);
    this.progress = 100;
    this.target = 100;
    this.render();
    for (const li of $('build-steps').children) li.className = 'done';
    this.el.className = 'modal success';
    $('build-title').textContent = 'Nothing changed';
    $('build-subtitle').textContent = `${filename} is already up to date, no need to build again`;
    this.lastArtifact = { filename, blob, pack };
    $('build-download').hidden = !blob;
    $('build-pack').hidden = !pack;
    $('build-pack-hint').hidden = true;
    $('build-close').hidden = false;
  },

  close() {
    clearInterval(this.timer);
    this.el.hidden = true;
  },
};

const LAST_BUILD_KEY = 'powerscratchedx.lastBuild';
let lastBuild = null;

async function projectHash(project) {
  const parts = [project.name, project.version, project.main];
  for (const path of Object.keys(project.files).sort()) {
    parts.push(path, project.files[path]);
  }
  const data = new TextEncoder().encode(parts.join(' '));
  if (!window.crypto || !window.crypto.subtle) return String(data.length) + ':' + parts.join('').length;
  const digest = await window.crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}

function rememberBuild(hash, filename) {
  try {
    localStorage.setItem(LAST_BUILD_KEY, JSON.stringify({ hash, filename }));
  } catch {
    // storage unavailable
  }
}

function recallBuild() {
  try {
    return JSON.parse(localStorage.getItem(LAST_BUILD_KEY) || 'null');
  } catch {
    return null;
  }
}

$('build-close').addEventListener('click', () => buildModal.close());
$('build-download').addEventListener('click', () => {
  if (buildModal.lastArtifact) downloadBlob(buildModal.lastArtifact.blob, buildModal.lastArtifact.filename);
});
$('build-pack').addEventListener('click', () => {
  const pack = buildModal.lastArtifact && buildModal.lastArtifact.pack;
  if (pack) downloadBlob(pack.blob, pack.filename);
});
$('build-modal').addEventListener('click', (e) => {
  if (e.target === $('build-modal') && !$('build-modal').classList.contains('building')) buildModal.close();
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !$('build-modal').hidden && !$('build-modal').classList.contains('building')) buildModal.close();
});

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

$('btn-build').addEventListener('click', async () => {
  showErrors([]);
  const btn = $('btn-build');
  btn.disabled = true;
  setStatus('Building JAR…', 'busy');
  const meta0 = readMeta();
  buildModal.open({ name: sanitizeName(meta0.name), version: meta0.version });
  buildModal.step('generate', 15);
  await wait(350);
  const project = generate();
  if (!project) {
    buildModal.fail('Could not generate Java source', [{ message: 'See the Java panel for details' }]);
    btn.disabled = false;
    setStatus('Generation failed', 'error');
    return;
  }
  const hash = await projectHash(project);
  const previous = lastBuild || recallBuild();
  if (previous && previous.hash === hash) {
    buildModal.unchanged(previous.filename, previous.blob || null, previous.pack || null);
    setStatus('Nothing changed since the last build', 'ok');
    btn.disabled = false;
    return;
  }
  buildModal.step('upload', 35);
  await wait(250);
  buildModal.step('compile', 85);
  try {
    const result = await api.build({
      name: project.name,
      version: project.version,
      main: project.main,
      files: project.files,
    });
    if (result.ok) {
      buildModal.step('package', 97);
      let pack = null;
      if (hasResourcePack(project.resourcePack)) {
        const blob = await buildResourcePack(project.resourcePack);
        pack = { blob, filename: `${project.name}-${project.version}.mcpack` };
      }
      await wait(300);
      downloadBlob(result.blob, result.filename);
      buildModal.success(result.filename, result.blob, pack);
      if (result.cached) $('build-subtitle').textContent = `${result.filename} (unchanged, served from cache)`;
      lastBuild = { hash, filename: result.filename, blob: result.blob, pack };
      rememberBuild(hash, result.filename);
      setStatus(`Built ${result.filename}`, 'ok');
      checkBackend();
    } else {
      const errors = result.errors || [{ message: result.error || 'Build failed' }];
      buildModal.fail(result.error || 'Build failed', errors);
      showErrors(errors);
      setStatus(result.error || 'Build failed', 'error');
    }
  } catch (err) {
    buildModal.fail('Backend unreachable', [{ message: err.message }]);
    setStatus('Backend unreachable: ' + err.message, 'error');
  } finally {
    btn.disabled = false;
  }
});

async function checkBackend() {
  try {
    const h = await api.health();
    $('backend').textContent = h.ok ? `Backend online · ${h.pnxJar || 'PNX'}` : 'Backend not ready';
    $('backend').className = 'backend ' + (h.ok ? 'ok' : 'error');
    if (typeof h.builds === 'number') {
      const n = h.builds;
      $('counter').textContent = `${n.toLocaleString('en-US')} plugin${n === 1 ? '' : 's'} built`;
    }
  } catch {
    $('backend').textContent = 'Backend offline';
    $('backend').className = 'backend error';
  }
}

PHONE.addEventListener('change', () => {
  const state = Blockly.serialization.workspaces.save(workspace);
  injectWorkspace(state);
  if (codePanelOpen) generate();
});

window.addEventListener('resize', () => Blockly.svgResize(workspace));
window.addEventListener('orientationchange', () => setTimeout(() => Blockly.svgResize(workspace), 150));

function rerenderWorkspace() {
  if (!workspace) return;
  const state = Blockly.serialization.workspaces.save(workspace);
  injectWorkspace(state);
}

async function start() {
  if (document.fonts && document.fonts.load) {
    try {
      await Promise.race([
        Promise.all([document.fonts.load('600 12px "Inter"'), document.fonts.load('400 12px "JetBrains Mono"')]),
        new Promise((resolve) => setTimeout(resolve, 2500)),
      ]);
    } catch {
      // fonts unavailable, fall back to system font
    }
  }
  const saved = loadLocal();
  try {
    loadProject(saved || starterProject);
  } catch {
    loadProject(starterProject);
  }
  if (document.fonts) {
    document.fonts.addEventListener('loadingdone', rerenderWorkspace, { once: true });
  }
}

start();

checkBackend();
setInterval(checkBackend, 15000);
