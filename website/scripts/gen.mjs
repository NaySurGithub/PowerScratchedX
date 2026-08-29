import * as Blockly from 'blockly';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import '../src/blocks/index.js';
import { buildProject } from '../src/generator/java.js';
import { starterProject } from '../src/examples/starter.js';

const args = process.argv.slice(2);
const outIdx = args.indexOf('--out');
const outDir = outIdx >= 0 ? args[outIdx + 1] : null;
const buildIdx = args.indexOf('--build');
const backend = buildIdx >= 0 ? args[buildIdx + 1] : null;
const file = args.find((a, i) => !a.startsWith('--') && i !== outIdx + 1 && i !== buildIdx + 1);

const data = file ? JSON.parse(readFileSync(file, 'utf8')) : starterProject;
const workspace = new Blockly.Workspace();
Blockly.serialization.workspaces.load(data.workspace, workspace);
const project = buildProject(workspace, data.meta);

if (outDir) {
  for (const [path, content] of Object.entries(project.files)) {
    const target = join(outDir, path);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, content);
  }
  console.log(`Wrote ${Object.keys(project.files).length} files to ${outDir}`);
} else {
  console.log(project.java);
}

if (backend) {
  const res = await fetch(`${backend}/api/build`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: project.name, version: project.version, main: project.main, files: project.files }),
  });
  if (res.ok) {
    const buf = Buffer.from(await res.arrayBuffer());
    const target = join(outDir || '.', `${project.name}-${project.version}.jar`);
    writeFileSync(target, buf);
    console.log(`Built ${target} (${buf.length} bytes)`);
  } else {
    console.error('Build failed:', await res.text());
    process.exit(1);
  }
}
