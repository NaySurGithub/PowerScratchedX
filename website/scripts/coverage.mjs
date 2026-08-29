import * as Blockly from 'blockly';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import '../src/blocks/index.js';
import { toolbox } from '../src/toolbox.js';
import { buildProject } from '../src/generator/java.js';

const args = process.argv.slice(2);
const outIdx = args.indexOf('--out');
const outDir = outIdx >= 0 ? args[outIdx + 1] : null;
const buildIdx = args.indexOf('--build');
const backend = buildIdx >= 0 ? args[buildIdx + 1] : null;

const ws = new Blockly.Workspace();
ws.getVariableMap().createVariable('score');

const hat = Blockly.serialization.blocks.append({ type: 'evt_player_chat' }, ws);
let tail = null;

function appendStatement(block) {
  if (tail) {
    tail.nextConnection.connect(block.previousConnection);
  } else {
    hat.getInput('DO').connection.connect(block.previousConnection);
  }
  tail = block;
}

const entries = [];
for (const cat of toolbox.contents) {
  for (const entry of cat.contents || []) {
    if (entry.kind === 'block') entries.push(entry);
  }
}
entries.push({ kind: 'block', type: 'variables_get', fields: { VAR: { name: 'score' } } });
entries.push({ kind: 'block', type: 'variables_set', fields: { VAR: { name: 'score' } }, inputs: { VALUE: { shadow: { type: 'math_number', fields: { NUM: 1 } } } } });
entries.push({ kind: 'block', type: 'math_change', fields: { VAR: { name: 'score' } }, inputs: { DELTA: { shadow: { type: 'math_number', fields: { NUM: 1 } } } } });

let count = 0;
const defineBlocks = {};
for (const entry of entries) {
  const state = { type: entry.type, inputs: entry.inputs, fields: entry.fields, extraState: entry.extraState };
  const block = Blockly.serialization.blocks.append(state, ws);
  count++;
  if (entry.type === 'item_define' || entry.type === 'block_define') {
    defineBlocks[entry.type] = block;
    continue;
  }
  if (entry.type === 'packet_send' || entry.type === 'form_simple' || entry.type === 'form_custom') {
    defineBlocks[entry.type] = block;
    appendStatement(block);
    continue;
  }
  const OWNERS = { ItemProp: ['item_define', 'PROPS'], BlockProp: ['block_define', 'PROPS'], PacketField: ['packet_send', 'FIELDS'], FormButton: ['form_simple', 'ELEMENTS'], FormElement: ['form_custom', 'ELEMENTS'] };
  const propCheck = block.previousConnection && block.previousConnection.getCheck();
  const ownerKey = propCheck && Object.keys(OWNERS).find((k) => propCheck.includes(k));
  if (ownerKey) {
    const owner = defineBlocks[OWNERS[ownerKey][0]];
    const input = owner.getInput(OWNERS[ownerKey][1]).connection;
    const last = input.targetBlock() ? input.targetBlock().lastConnectionInStack(false) : input;
    last.connect(block.previousConnection);
    continue;
  }
  if (block.outputConnection) {
    const log = Blockly.serialization.blocks.append({ type: 'server_log' }, ws);
    log.getInput('TEXT').connection.connect(block.outputConnection);
    appendStatement(log);
  } else if (block.previousConnection) {
    appendStatement(block);
  }
}

const project = buildProject(ws, { name: 'Coverage', version: '0.0.1', author: 'test', description: 'all blocks' });
console.log(`Generated ${count} blocks -> ${project.java.split('\n').length} lines of Java`);

if (outDir) {
  for (const [path, content] of Object.entries(project.files)) {
    const target = join(outDir, path);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, content);
  }
}

if (backend) {
  const res = await fetch(`${backend}/api/build`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: project.name, version: project.version, main: project.main, files: project.files }),
  });
  if (res.ok) {
    const buf = Buffer.from(await res.arrayBuffer());
    if (outDir) writeFileSync(join(outDir, 'Coverage.jar'), buf);
    console.log(`Build OK (${buf.length} bytes)`);
  } else {
    console.error('Build failed:', await res.text());
    process.exit(1);
  }
}
