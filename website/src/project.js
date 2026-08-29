import * as Blockly from 'blockly';

const STORAGE_KEY = 'powerscratchedx.project';
export const FILE_EXT = '.psx.json';

export const defaultMeta = () => ({
  name: 'MyPlugin',
  version: '1.0.0',
  author: '',
  description: 'Made with PowerScratchedX',
});

export function serialize(workspace, meta) {
  return {
    format: 'powerscratchedx',
    formatVersion: 1,
    meta: { ...meta },
    workspace: Blockly.serialization.workspaces.save(workspace),
  };
}

export function deserialize(workspace, data) {
  if (!data || data.format !== 'powerscratchedx') throw new Error('Not a PowerScratchedX project');
  Blockly.serialization.workspaces.load(data.workspace || {}, workspace);
  return { ...defaultMeta(), ...(data.meta || {}) };
}

export function saveLocal(project) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(project));
  } catch {
    // storage unavailable
  }
}

export function loadLocal() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function clearLocal() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function pickFile(accept) {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = accept;
    input.onchange = () => resolve(input.files && input.files[0] ? input.files[0] : null);
    input.click();
  });
}
