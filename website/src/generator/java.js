import * as Blockly from 'blockly';

const JAVA_KEYWORDS = 'abstract assert boolean break byte case catch char class const continue default do double else enum extends final finally float for goto if implements import instanceof int interface long native new package private protected public return short static strictfp super switch synchronized this throw throws transient try void volatile while true false null var record yield sealed permits';

export const javaGenerator = new Blockly.CodeGenerator('Java');
javaGenerator.INDENT = '    ';
javaGenerator.addReservedWords(JAVA_KEYWORDS.split(' ').join(','));

const ORDER = 0;
const jstr = (s) => JSON.stringify(String(s ?? ''));
const id = (s) => String(s || '').replace(/[^A-Za-z0-9_]/g, '_');

function resetContext() {
  javaGenerator.ctx = {
    methods: [],
    handlers: [],
    commands: [],
    permissions: [],
    configDefaults: [],
    enableBody: [],
    disableBody: [],
    repeating: [],
    items: [],
    blocks: [],
    usedItemIds: new Set(),
    counter: 0,
  };
}

javaGenerator.init = function (workspace) {
  Object.getPrototypeOf(javaGenerator).init.call(this, workspace);
  resetContext();
  this.nameDB_ = new Blockly.Names(this.RESERVED_WORDS_);
  this.nameDB_.setVariableMap(workspace.getVariableMap());
  this.nameDB_.populateVariables(workspace);
  this.ctx.variables = workspace.getVariableMap().getAllVariables().map((v) => 'v_' + this.nameDB_.getName(v.getId(), Blockly.Names.NameType.VARIABLE));
};

javaGenerator.scrub_ = function (block, code, thisOnly) {
  const next = block.nextConnection && block.nextConnection.targetBlock();
  return thisOnly ? code : code + this.blockToCode(next);
};

javaGenerator.finish = function (code) {
  return code;
};

function nextId() {
  return ++javaGenerator.ctx.counter;
}

function method(name, body) {
  javaGenerator.ctx.methods.push(`    private void ${name}(Ctx c) {\n${indent(body, 1)}    }\n`);
  return name;
}

function hoist(body) {
  return method('s' + nextId(), body);
}

function statements(block, name) {
  const code = javaGenerator.statementToCode(block, name);
  return code || '';
}

function v(block, name, fallback = '""') {
  const code = javaGenerator.valueToCode(block, name, ORDER);
  return code || fallback;
}

const num = (block, name, fb = '0') => `num(${v(block, name, fb)})`;
const str = (block, name, fb = '""') => `str(${v(block, name, fb)})`;
const bool = (block, name) => `bool(${v(block, name, 'false')})`;
const player = (block) => `P(${v(block, 'PLAYER', 'c.player')})`;

const G = javaGenerator.forBlock;

// ---------------- Events ----------------
const EVENT_HATS = {
  evt_player_join: { cls: 'org.powernukkitx.event.player.PlayerJoinEvent', setup: 'c.player = event.getPlayer();' },
  evt_player_quit: { cls: 'org.powernukkitx.event.player.PlayerQuitEvent', setup: 'c.player = event.getPlayer();' },
  evt_player_chat: { cls: 'org.powernukkitx.event.player.PlayerChatEvent', setup: 'c.player = event.getPlayer(); c.message = event.getMessage();' },
  evt_player_command: { cls: 'org.powernukkitx.event.player.PlayerCommandPreprocessEvent', setup: 'c.player = event.getPlayer(); c.message = event.getMessage();' },
  evt_block_break: { cls: 'org.powernukkitx.event.block.BlockBreakEvent', setup: 'c.player = event.getPlayer(); c.block = event.getBlock(); c.item = event.getItem();' },
  evt_block_place: { cls: 'org.powernukkitx.event.block.BlockPlaceEvent', setup: 'c.player = event.getPlayer(); c.block = event.getBlock(); c.item = event.getItem();' },
  evt_player_interact: { cls: 'org.powernukkitx.event.player.PlayerInteractEvent', setup: 'c.player = event.getPlayer(); c.block = event.getBlock(); c.item = event.getItem();' },
  evt_player_death: { cls: 'org.powernukkitx.event.player.PlayerDeathEvent', setup: 'c.player = event.getEntity();' },
  evt_player_respawn: { cls: 'org.powernukkitx.event.player.PlayerRespawnEvent', setup: 'c.player = event.getPlayer();' },
  evt_player_damage: { cls: 'org.powernukkitx.event.entity.EntityDamageEvent', setup: 'if (!(event.getEntity() instanceof Player p)) return; c.player = p; c.damage = event.getDamage();' },
  evt_player_move: { cls: 'org.powernukkitx.event.player.PlayerMoveEvent', setup: 'c.player = event.getPlayer();' },
};

for (const [type, info] of Object.entries(EVENT_HATS)) {
  G[type] = function (block) {
    const n = nextId();
    method(`h${n}`, statements(block, 'DO'));
    javaGenerator.ctx.handlers.push(
      `    @EventHandler\n    public void on${n}(${info.cls} event) {\n        Ctx c = new Ctx();\n        c.event = event;\n${info.setup.split(/;\s+/).filter(Boolean).map((s) => `        ${s.replace(/;$/, '')};`).join('\n')}\n        h${n}(c);\n    }\n`,
    );
    return '';
  };
}

G.evt_enable = function (block) {
  javaGenerator.ctx.enableBody.push(statements(block, 'DO'));
  return '';
};

G.evt_disable = function (block) {
  javaGenerator.ctx.disableBody.push(statements(block, 'DO'));
  return '';
};

G.evt_cancel = () => 'if (c.event instanceof org.powernukkitx.event.Cancellable ce) ce.setCancelled(true);\n';
G.evt_message = () => ['(c.message)', ORDER];
G.evt_set_message = (b) => `if (c.event instanceof org.powernukkitx.event.player.PlayerChatEvent e) e.setMessage(${str(b, 'TEXT')});\n`;
G.evt_set_broadcast = (b) => {
  const kind = b.getFieldValue('KIND');
  const t = str(b, 'TEXT');
  if (kind === 'JOIN') return `if (c.event instanceof org.powernukkitx.event.player.PlayerJoinEvent e) e.setJoinMessage(${t});\n`;
  if (kind === 'QUIT') return `if (c.event instanceof org.powernukkitx.event.player.PlayerQuitEvent e) e.setQuitMessage(${t});\n`;
  return `if (c.event instanceof org.powernukkitx.event.player.PlayerDeathEvent e) e.setDeathMessage(${t});\n`;
};
G.evt_block_id = () => ['(c.block == null ? "" : c.block.getId())', ORDER];
G.evt_block_coord = (b) => [`(c.block == null ? 0.0 : c.block.get${b.getFieldValue('AXIS')}())`, ORDER];
G.evt_item_id = () => ['(c.item == null ? "" : c.item.getId())', ORDER];
G.evt_damage = () => ['(c.damage)', ORDER];
G.evt_set_damage = (b) => `if (c.event instanceof org.powernukkitx.event.entity.EntityDamageEvent e) e.setDamage((float) ${num(b, 'VALUE')});\n`;

// ---------------- Player ----------------
G.player_current = () => ['c.player', ORDER];
G.player_by_name = (b) => [`getServer().getPlayerExact(${str(b, 'NAME')})`, ORDER];

const withPlayer = (b, action) => `{ Player p = ${player(b)}; if (p != null) { ${action} } }\n`;

G.player_send_message = (b) => withPlayer(b, `p.sendMessage(${str(b, 'TEXT')});`);
G.player_send_title = (b) => withPlayer(b, `p.sendTitle(${str(b, 'TITLE')}, ${str(b, 'SUB')});`);
G.player_send_bar = (b) => {
  const k = b.getFieldValue('KIND');
  const m = k === 'ACTIONBAR' ? 'sendActionBar' : k === 'POPUP' ? 'sendPopup' : 'sendTip';
  return withPlayer(b, `p.${m}(${str(b, 'TEXT')});`);
};
G.player_teleport = (b) => withPlayer(b, `p.teleport(new org.powernukkitx.math.Vector3(${num(b, 'X')}, ${num(b, 'Y')}, ${num(b, 'Z')}));`);
G.player_teleport_to = (b) => withPlayer(b, `Player t = P(${v(b, 'TARGET', 'null')}); if (t != null) p.teleport(t.getLocation());`);
G.player_teleport_spawn = (b) => withPlayer(b, 'p.teleport(getServer().getDefaultLevel().getSafeSpawn());');
G.player_give_item = (b) => withPlayer(b, `Item it = item(${str(b, 'ITEM')}, (int) ${num(b, 'COUNT', '1')}); if (it != null) p.giveItem(it);`);
G.player_clear_inventory = (b) => withPlayer(b, 'p.getInventory().clearAll();');
G.player_kick = (b) => withPlayer(b, `p.kick(${str(b, 'REASON')});`);
G.player_set_gamemode = (b) => withPlayer(b, `p.setGamemode(${b.getFieldValue('MODE')});`);
G.player_set_health = (b) => withPlayer(b, `p.setHealth((float) ${num(b, 'VALUE')});`);
G.player_set_food = (b) => withPlayer(b, `p.getFoodData().setFood((int) ${num(b, 'VALUE')});`);
G.player_add_effect = (b) => withPlayer(b,
  `p.addEffect(org.powernukkitx.entity.effect.Effect.get(${jstr(b.getFieldValue('EFFECT'))}).setDuration((int) (${num(b, 'SECONDS')} * 20)).setAmplifier(Math.max(0, (int) ${num(b, 'LEVEL', '1')} - 1)));`);
G.player_clear_effects = (b) => withPlayer(b, 'p.removeAllEffects();');
G.player_set_fire = (b) => withPlayer(b, `p.setOnFire((int) ${num(b, 'SECONDS')});`);
G.player_add_xp = (b) => withPlayer(b, `p.addExperience((int) ${num(b, 'VALUE')});`);
G.player_run_command = (b) => withPlayer(b, `getServer().executeCommand(p, ${str(b, 'CMD')});`);
G.player_set_op = (b) => withPlayer(b, `p.setOp(${b.getFieldValue('OP')});`);
G.player_play_sound = (b) => withPlayer(b, `p.getLevel().addSound(p, ${str(b, 'SOUND')}, 1f, 1f, p);`);
G.player_set_display_name = (b) => withPlayer(b, `p.setDisplayName(${str(b, 'NAME')});`);

const pv = (b, expr, fb) => {
  const q = 'q' + nextId();
  return [`pget(${player(b)}, ${q} -> ${expr(q)}, ${fb})`, ORDER];
};
G.player_name = (b) => pv(b, (q) => `${q}.getName()`, '""');
G.player_health = (b) => pv(b, (q) => `(double) ${q}.getHealth()`, '0.0');
G.player_food = (b) => pv(b, (q) => `(double) ${q}.getFoodData().getFood()`, '0.0');
G.player_coord = (b) => pv(b, (q) => `${q}.get${b.getFieldValue('AXIS')}()`, '0.0');
G.player_world = (b) => pv(b, (q) => `${q}.getLevel().getName()`, '""');
G.player_gamemode = (b) => pv(b, (q) => `(double) ${q}.getGamemode()`, '0.0');
G.player_item_in_hand = (b) => pv(b, (q) => `${q}.getInventory().getItemInMainHand().getId()`, '""');
G.player_has_permission = (b) => pv(b, (q) => `${q}.hasPermission(${str(b, 'PERM')})`, 'false');
G.player_is_op = (b) => pv(b, (q) => `${q}.isOp()`, 'false');
G.player_is_online = (b) => [`(${player(b)} != null)`, ORDER];
G.player_is_sneaking = (b) => pv(b, (q) => `${q}.isSneaking()`, 'false');

// ---------------- Server ----------------
G.server_broadcast = (b) => `getServer().broadcastMessage(${str(b, 'TEXT')});\n`;
G.server_run_command = (b) => `getServer().executeCommand(getServer().getConsoleSender(), ${str(b, 'CMD')});\n`;
G.server_log = (b) => `getLogger().info(${str(b, 'TEXT')});\n`;
G.server_foreach_player = (b) => {
  const m = hoist(statements(b, 'DO'));
  return `for (Player each : players()) { Ctx c2 = c.copy(); c2.player = each; ${m}(c2); }\n`;
};
G.server_online_count = () => ['((double) getServer().getOnlinePlayers().size())', ORDER];
G.server_online_names = () => ['(players().stream().map(Player::getName).collect(java.util.stream.Collectors.joining(", ")))', ORDER];
G.server_set_block = (b) => `{ Block bl = block(${str(b, 'BLOCK')}); if (bl != null) lvl(c).setBlock(new org.powernukkitx.math.Vector3(${num(b, 'X')}, ${num(b, 'Y')}, ${num(b, 'Z')}), bl); }\n`;
G.server_get_block = (b) => [`(lvl(c).getBlock((int) ${num(b, 'X')}, (int) ${num(b, 'Y')}, (int) ${num(b, 'Z')}).getId())`, ORDER];
G.server_set_time = (b) => `lvl(c).setTime((long) ${num(b, 'TIME')});\n`;
G.server_play_sound_at = (b) => `lvl(c).addSound(new org.powernukkitx.math.Vector3(${num(b, 'X')}, ${num(b, 'Y')}, ${num(b, 'Z')}), ${str(b, 'SOUND')}, 1f, 1f);\n`;
G.server_world_name = () => ['(lvl(c).getName())', ORDER];

// ---------------- Commands ----------------
G.cmd_hat = function (block) {
  const name = String(block.getFieldValue('NAME') || 'cmd').trim().toLowerCase().replace(/[^a-z0-9_-]/g, '');
  if (!name) return '';
  const n = nextId();
  method(`h${n}`, statements(block, 'DO'));
  javaGenerator.ctx.commands.push({
    name,
    description: block.getFieldValue('DESC') || '',
    permission: String(block.getFieldValue('PERM') || '').trim(),
    method: `h${n}`,
  });
  return '';
};
G.cmd_reply = (b) => `if (c.sender != null) c.sender.sendMessage(${str(b, 'TEXT')});\n`;
G.cmd_sender_name = () => ['(c.sender == null ? "" : c.sender.getName())', ORDER];
G.cmd_sender_is_player = () => ['(c.sender instanceof Player)', ORDER];
G.cmd_arg = (b) => [`arg(c, (int) ${num(b, 'INDEX', '1')})`, ORDER];
G.cmd_arg_count = () => ['((double) c.args.length)', ORDER];
G.cmd_args_joined = () => ['(String.join(" ", c.args))', ORDER];
G.perm_define = function (block) {
  const name = String(block.getFieldValue('NAME') || '').trim();
  if (name) {
    javaGenerator.ctx.permissions.push({
      name,
      def: block.getFieldValue('DEFAULT'),
      description: block.getFieldValue('DESC') || '',
    });
  }
  return '';
};

// ---------------- Config ----------------
G.cfg_default = function (block) {
  const key = String(block.getFieldValue('KEY') || '').trim();
  if (key) javaGenerator.ctx.configDefaults.push({ key, value: literalOf(block, 'VALUE') });
  return '';
};
G.cfg_get = (b) => [`getConfig().get(${str(b, 'KEY')})`, ORDER];
G.cfg_set = (b) => `getConfig().set(${str(b, 'KEY')}, cfgval(${v(b, 'VALUE')})); saveConfig();\n`;
G.cfg_reload = () => 'reloadConfig();\n';
G.cfg_has = (b) => [`getConfig().exists(${str(b, 'KEY')})`, ORDER];

function literalOf(block, name) {
  const target = block.getInputTargetBlock(name);
  if (!target) return '';
  if (target.type === 'math_number') return Number(target.getFieldValue('NUM'));
  if (target.type === 'logic_boolean') return target.getFieldValue('BOOL') === 'TRUE';
  if (target.type === 'text') return String(target.getFieldValue('TEXT'));
  return '';
}

// ---------------- Control / time ----------------
G.time_every = function (block) {
  const ticks = Math.max(1, parseInt(block.getFieldValue('TICKS'), 10) || 20);
  const m = hoist(statements(block, 'DO'));
  javaGenerator.ctx.repeating.push(`getServer().getScheduler().scheduleRepeatingTask(this, () -> ${m}(new Ctx()), ${ticks});`);
  return '';
};
G.time_wait = (b) => {
  const m = hoist(statements(b, 'DO'));
  return `{ Ctx c2 = c.copy(); getServer().getScheduler().scheduleDelayedTask(this, () -> ${m}(c2), Math.max(1, (int) ${num(b, 'TICKS', '20')})); }\n`;
};
G.time_now = () => ['((double) System.currentTimeMillis())', ORDER];
G.ctrl_stop = () => 'if (true) return;\n';

G.controls_if = function (block) {
  let code = '';
  let n = 0;
  while (block.getInput('IF' + n)) {
    const cond = bool(block, 'IF' + n);
    const body = statements(block, 'DO' + n);
    code += (n === 0 ? 'if' : ' else if') + ` (${cond}) {\n${body}}`;
    n++;
  }
  if (block.getInput('ELSE')) {
    code += ` else {\n${statements(block, 'ELSE')}}`;
  }
  return code + '\n';
};
G.controls_repeat_ext = function (block) {
  const i = 'i' + nextId();
  return `for (int ${i} = 0; ${i} < (int) ${num(block, 'TIMES')}; ${i}++) {\n${statements(block, 'DO')}}\n`;
};
G.controls_whileUntil = function (block) {
  const until = block.getFieldValue('MODE') === 'UNTIL';
  const guard = 'g' + nextId();
  return `{ int ${guard} = 0; while (${until ? '!' : ''}${bool(block, 'BOOL')} && ${guard}++ < 100000) {\n${statements(block, 'DO')}} }\n`;
};

// ---------------- Operators ----------------
G.math_number = (b) => [String(Number(b.getFieldValue('NUM')) || 0) + (Number.isInteger(Number(b.getFieldValue('NUM'))) ? '.0' : ''), ORDER];
G.math_arithmetic = (b) => {
  const a = num(b, 'A');
  const c = num(b, 'B');
  const op = b.getFieldValue('OP');
  const map = { ADD: `(${a} + ${c})`, MINUS: `(${a} - ${c})`, MULTIPLY: `(${a} * ${c})`, DIVIDE: `div(${a}, ${c})`, POWER: `Math.pow(${a}, ${c})` };
  return [map[op] || `(${a} + ${c})`, ORDER];
};
G.math_modulo = (b) => [`mod(${num(b, 'DIVIDEND')}, ${num(b, 'DIVISOR', '1')})`, ORDER];
G.math_random_int = (b) => [`rnd(${num(b, 'FROM')}, ${num(b, 'TO')})`, ORDER];
G.math_round = (b) => {
  const op = b.getFieldValue('OP');
  const f = op === 'ROUNDUP' ? 'Math.ceil' : op === 'ROUNDDOWN' ? 'Math.floor' : 'Math.round';
  return [`((double) ${f}(${num(b, 'NUM')}))`, ORDER];
};
G.logic_compare = (b) => {
  const a = v(b, 'A', '0');
  const c = v(b, 'B', '0');
  const op = b.getFieldValue('OP');
  const map = {
    EQ: `eq(${a}, ${c})`, NEQ: `(!eq(${a}, ${c}))`,
    LT: `(num(${a}) < num(${c}))`, LTE: `(num(${a}) <= num(${c}))`,
    GT: `(num(${a}) > num(${c}))`, GTE: `(num(${a}) >= num(${c}))`,
  };
  return [map[op] || map.EQ, ORDER];
};
G.logic_operation = (b) => [`(${bool(b, 'A')} ${b.getFieldValue('OP') === 'AND' ? '&&' : '||'} ${bool(b, 'B')})`, ORDER];
G.logic_negate = (b) => [`(!${bool(b, 'BOOL')})`, ORDER];
G.logic_boolean = (b) => [b.getFieldValue('BOOL') === 'TRUE' ? 'true' : 'false', ORDER];
G.text = (b) => [jstr(b.getFieldValue('TEXT')), ORDER];
G.text_join = (b) => {
  const parts = [];
  for (let i = 0; i < b.itemCount_; i++) parts.push(str(b, 'ADD' + i));
  return [parts.length ? `(${parts.join(' + ')})` : '""', ORDER];
};
G.text_length = (b) => [`((double) ${str(b, 'VALUE')}.length())`, ORDER];
G.op_contains = (b) => [`${str(b, 'TEXT')}.contains(${str(b, 'PART')})`, ORDER];
G.op_starts_with = (b) => [`${str(b, 'TEXT')}.startsWith(${str(b, 'PART')})`, ORDER];
G.op_replace = (b) => [`${str(b, 'TEXT')}.replace(${str(b, 'FROM')}, ${str(b, 'TO')})`, ORDER];
G.op_to_number = (b) => [num(b, 'VALUE'), ORDER];
G.op_color = (b) => [jstr(b.getFieldValue('CODE')), ORDER];

// ---------------- Variables ----------------
const varName = (b) => 'v_' + javaGenerator.getVariableName(b.getFieldValue('VAR'));
G.variables_get = (b) => [varName(b), ORDER];
G.variables_set = (b) => `${varName(b)} = ${v(b, 'VALUE', '0.0')};\n`;
G.math_change = (b) => `${varName(b)} = num(${varName(b)}) + ${num(b, 'DELTA', '1')};\n`;

// ---------------- Custom items / blocks ----------------
const cleanId = (s) => String(s || '').trim().toLowerCase().replace(/[^a-z0-9_]/g, '_').replace(/^_+|_+$/g, '') || 'custom';
const filterId = (s) => {
  const t = String(s || '').trim().toLowerCase();
  return t.includes(':') ? t.replace(/[^a-z0-9_:.]/g, '') : cleanId(t) === 'custom' && !t ? '' : cleanId(t);
};
const fnum = (block, name, fallback) => {
  const v = Number(block.getFieldValue(name));
  return Number.isFinite(v) ? v : fallback;
};

const TOOL_KINDS = { sword: 'isSword', pickaxe: 'isPickaxe', axe: 'isAxe', shovel: 'isShovel', hoe: 'isHoe' };
const ARMOR_KINDS = { helmet: 'isHelmet', chestplate: 'isChestplate', leggings: 'isLeggings', boots: 'isBoots' };
const TOOL_TIER = { wooden: 'TIER_WOODEN', gold: 'TIER_GOLD', stone: 'TIER_STONE', copper: 'TIER_COPPER', iron: 'TIER_IRON', diamond: 'TIER_DIAMOND', netherite: 'TIER_NETHERITE' };
const ARMOR_TIER = { wooden: 'WEARABLE_TIER_LEATHER', gold: 'WEARABLE_TIER_GOLD', stone: 'WEARABLE_TIER_CHAIN', copper: 'WEARABLE_TIER_COPPER', iron: 'WEARABLE_TIER_IRON', diamond: 'WEARABLE_TIER_DIAMOND', netherite: 'WEARABLE_TIER_NETHERITE' };
const TOOL_DURABILITY = { wooden: 59, gold: 32, stone: 131, copper: 190, iron: 250, diamond: 1561, netherite: 2031 };
const SWORD_DAMAGE = { wooden: 4, gold: 4, stone: 5, copper: 5, iron: 6, diamond: 7, netherite: 8 };
const ARMOR_BASE_DURABILITY = { helmet: 165, chestplate: 240, leggings: 225, boots: 195 };
const ARMOR_TIER_FACTOR = { wooden: 0.33, gold: 0.47, stone: 1, copper: 0.8, iron: 1, diamond: 2.2, netherite: 2.5 };
const ARMOR_POINTS = { helmet: 2, chestplate: 6, leggings: 5, boots: 2 };

function readItemProps(block) {
  const props = {};
  let b = block.getInputTargetBlock('PROPS');
  while (b) {
    switch (b.type) {
      case 'iprop_damage': props.damage = fnum(b, 'VALUE', 1); break;
      case 'iprop_durability': props.durability = fnum(b, 'VALUE', 100); break;
      case 'iprop_stack': props.stack = fnum(b, 'VALUE', 64); break;
      case 'iprop_glint': props.glint = b.getFieldValue('VALUE') === 'true'; break;
      case 'iprop_cooldown': props.cooldown = fnum(b, 'VALUE', 0); break;
      case 'iprop_usable': props.usable = fnum(b, 'VALUE', 0.1); break;
      case 'iprop_armor': props.armorPoints = fnum(b, 'POINTS', 2); props.toughness = fnum(b, 'TOUGHNESS', 0); break;
      case 'iprop_food': props.nutrition = fnum(b, 'NUTRITION', 4); props.saturation = fnum(b, 'SATURATION', 0.6); props.alwaysEat = b.getFieldValue('ALWAYS') === 'true'; break;
      case 'iprop_hand_equipped': props.handEquipped = b.getFieldValue('VALUE') === 'true'; break;
      default: break;
    }
    b = b.getNextBlock();
  }
  return props;
}

function readBlockProps(block) {
  const props = {};
  let b = block.getInputTargetBlock('PROPS');
  while (b) {
    switch (b.type) {
      case 'bprop_hardness': props.hardness = fnum(b, 'VALUE', 3); break;
      case 'bprop_resistance': props.resistance = fnum(b, 'VALUE', 15); break;
      case 'bprop_light': props.light = Math.max(0, Math.min(15, Math.round(fnum(b, 'VALUE', 0)))); break;
      case 'bprop_friction': props.friction = fnum(b, 'VALUE', 0.6); break;
      case 'bprop_transparent': props.transparent = b.getFieldValue('VALUE') === 'true'; break;
      default: break;
    }
    b = b.getNextBlock();
  }
  return props;
}

G.item_define = function (block) {
  javaGenerator.ctx.items.push({
    id: cleanId(block.getFieldValue('ID')),
    name: block.getFieldValue('NAME') || 'Custom Item',
    kind: block.getFieldValue('KIND') || 'item',
    tier: block.getFieldValue('TIER') || 'iron',
    texture: String(block.getFieldValue('TEXTURE') || 'stick').trim(),
    props: readItemProps(block),
  });
  return '';
};
G.block_define = function (block) {
  javaGenerator.ctx.blocks.push({
    id: cleanId(block.getFieldValue('ID')),
    name: block.getFieldValue('NAME') || 'Custom Block',
    texture: String(block.getFieldValue('TEXTURE') || 'stone').trim(),
    props: readBlockProps(block),
  });
  return '';
};
for (const t of ['iprop_damage', 'iprop_durability', 'iprop_stack', 'iprop_glint', 'iprop_cooldown', 'iprop_usable', 'iprop_armor', 'iprop_food', 'iprop_hand_equipped',
  'bprop_hardness', 'bprop_resistance', 'bprop_light', 'bprop_friction', 'bprop_transparent']) {
  G[t] = () => '';
}

const FILTER_HATS = {
  evt_item_use: {
    cls: 'org.powernukkitx.event.player.PlayerInteractEvent',
    pre: 'if (event.getAction() != org.powernukkitx.event.player.PlayerInteractEvent.Action.RIGHT_CLICK_AIR && event.getAction() != org.powernukkitx.event.player.PlayerInteractEvent.Action.RIGHT_CLICK_BLOCK) return;',
    setup: 'c.player = event.getPlayer(); c.item = event.getItem(); c.block = event.getBlock();',
    check: (id) => `if (!itemIs(c.item, ${jstr(id)})) return; if (!cooldownOk(c)) return;`,
    use: true,
  },
  evt_item_hit: {
    cls: 'org.powernukkitx.event.entity.EntityDamageByEntityEvent',
    pre: 'if (!(event.getDamager() instanceof Player damager)) return;',
    setup: 'c.player = damager; c.item = damager.getInventory().getItemInMainHand(); c.target = event.getEntity(); c.damage = event.getDamage();',
    check: (id) => `if (!itemIs(c.item, ${jstr(id)})) return;`,
  },
  evt_item_consume: {
    cls: 'org.powernukkitx.event.player.PlayerItemConsumeEvent',
    pre: '',
    setup: 'c.player = event.getPlayer(); c.item = event.getItem();',
    check: (id) => `if (!itemIs(c.item, ${jstr(id)})) return;`,
  },
  evt_item_held: {
    cls: 'org.powernukkitx.event.player.PlayerItemHeldEvent',
    pre: '',
    setup: 'c.player = event.getPlayer(); c.item = event.getItem();',
    check: (id) => `if (!itemIs(c.item, ${jstr(id)})) return;`,
  },
  evt_block_use: {
    cls: 'org.powernukkitx.event.player.PlayerInteractEvent',
    pre: 'if (event.getBlock() == null) return;',
    setup: 'c.player = event.getPlayer(); c.item = event.getItem(); c.block = event.getBlock();',
    check: (id) => `if (!blockIs(c.block, ${jstr(id)})) return;`,
  },
  evt_packet_receive: {
    cls: 'org.powernukkitx.event.server.PacketReceiveEvent',
    pre: '',
    setup: 'c.player = event.getPlayer(); c.packet = event.getPacket();',
    check: (id) => `if (!packetIs(c.packet, ${jstr(id)})) return;`,
    field: 'TYPE',
  },
  evt_packet_send: {
    cls: 'org.powernukkitx.event.server.PacketSendEvent',
    pre: '',
    setup: 'c.player = event.getPlayer(); c.packet = event.getPacket();',
    check: (id) => `if (!packetIs(c.packet, ${jstr(id)})) return;`,
    field: 'TYPE',
  },
};

const packetType = (s) => String(s || '').trim().replace(/[^A-Za-z0-9_]/g, '');

for (const [type, info] of Object.entries(FILTER_HATS)) {
  G[type] = function (block) {
    const id = info.field ? packetType(block.getFieldValue(info.field)) : filterId(block.getFieldValue('ID'));
    if (info.use && id) javaGenerator.ctx.usedItemIds.add(id);
    const n = nextId();
    method(`h${n}`, statements(block, 'DO'));
    const lines = [info.pre, 'Ctx c = new Ctx();', 'c.event = event;', ...info.setup.split(/;\s+/).filter(Boolean).map((s) => s.replace(/;$/, '') + ';'), ...info.check(id).split(/;\s+/).filter(Boolean).map((s) => s.replace(/;$/, '') + ';'), `h${n}(c);`]
      .filter(Boolean).map((l) => '        ' + l).join('\n');
    javaGenerator.ctx.handlers.push(`    @EventHandler\n    public void on${n}(${info.cls} event) {\n${lines}\n    }\n`);
    return '';
  };
}

G.packet_type = () => ['(c.packet == null ? "" : c.packet.getClass().getSimpleName())', ORDER];
G.packet_get = (b) => [`packetGet(c.packet, ${str(b, 'FIELD')})`, ORDER];
G.packet_set = (b) => `packetSet(c.packet, ${str(b, 'FIELD')}, ${v(b, 'VALUE')});\n`;
G.pfield = () => '';
G.packet_send = (b) => {
  const type = packetType(b.getFieldValue('TYPE'));
  if (!type) return '';
  const sets = [];
  let f = b.getInputTargetBlock('FIELDS');
  while (f) {
    if (f.type === 'pfield') {
      const name = String(f.getFieldValue('FIELD') || '').trim();
      if (name) sets.push(`packetSet(pk, ${jstr(name)}, ${v(f, 'VALUE')});`);
    }
    f = f.getNextBlock();
  }
  return withPlayer(b, `Object pk = packetNew(${jstr(type)}); if (pk != null) { ${sets.join(' ')} p.sendPacket((org.cloudburstmc.protocol.bedrock.packet.BedrockPacket) pk); }`);
};
G.packet_transfer = (b) => withPlayer(b, `Object pk = packetNew("TransferPacket"); if (pk != null) { packetSet(pk, "serverAddress", ${str(b, 'ADDRESS')}); packetSet(pk, "serverPort", ${num(b, 'PORT', '19132')}); p.sendPacket((org.cloudburstmc.protocol.bedrock.packet.BedrockPacket) pk); }`);
G.packet_toast = (b) => withPlayer(b, `Object pk = packetNew("ToastRequestPacket"); if (pk != null) { packetSet(pk, "title", ${str(b, 'TITLE')}); packetSet(pk, "content", ${str(b, 'CONTENT')}); p.sendPacket((org.cloudburstmc.protocol.bedrock.packet.BedrockPacket) pk); }`);

function formCallback(block, name, setup) {
  const body = statements(block, name);
  if (!body.trim()) return null;
  const m = hoist(body);
  return `(pl${setup.includes('r') ? ', r' : ''}) -> { Ctx c3 = c2.copy(); c3.player = pl; ${setup} ${m}(c3); }`;
}

function formElements(block, name, fn) {
  const lines = [];
  let el = block.getInputTargetBlock(name);
  while (el) {
    const line = fn(el);
    if (line) lines.push(line);
    el = el.getNextBlock();
  }
  return lines;
}

const optionList = (b, name) => `java.util.Arrays.asList(${str(b, name)}.split("\\\\s*,\\\\s*"))`;

G.form_simple = (b) => {
  const buttons = formElements(b, 'ELEMENTS', (el) => {
    if (el.type !== 'fbutton') return '';
    return `form.addButton(${str(el, 'TEXT')}, buttonImage(${str(el, 'IMAGE')}));`;
  });
  const submit = formCallback(b, 'ON_SUBMIT', 'c3.formButton = r.buttonId(); c3.formText = r.button() == null ? "" : str(r.button().text());');
  const close = formCallback(b, 'ON_CLOSE', '');
  return withPlayer(b, `org.powernukkitx.form.window.SimpleForm form = new org.powernukkitx.form.window.SimpleForm(${str(b, 'TITLE')}, ${str(b, 'CONTENT')}); ${buttons.join(' ')} Ctx c2 = c.copy(); ${submit ? `form.onSubmit(${submit});` : ''} ${close ? `form.onClose(${close});` : ''} form.send(p);`);
};

G.fbutton = () => '';

G.form_modal = (b) => {
  const yes = formCallback(b, 'ON_YES', '');
  const no = formCallback(b, 'ON_NO', '');
  return withPlayer(b, `org.powernukkitx.form.window.ModalForm form = new org.powernukkitx.form.window.ModalForm(${str(b, 'TITLE')}, ${str(b, 'CONTENT')}); form.text(${str(b, 'YES')}, ${str(b, 'NO')}); Ctx c2 = c.copy(); ${yes ? `form.onYes(${yes});` : ''} ${no ? `form.onNo(${no});` : ''} form.send(p);`);
};

G.form_custom = (b) => {
  const elements = formElements(b, 'ELEMENTS', (el) => {
    switch (el.type) {
      case 'fel_label': return `form.addLabel(${str(el, 'TEXT')});`;
      case 'fel_header': return `form.addElement(new org.powernukkitx.form.element.ElementHeader(${str(el, 'TEXT')}));`;
      case 'fel_divider': return 'form.addElement(new org.powernukkitx.form.element.ElementDivider());';
      case 'fel_input': return `form.addInput(${str(el, 'TEXT')}, ${str(el, 'PLACEHOLDER')}, ${str(el, 'DEFAULT')});`;
      case 'fel_toggle': return `form.addToggle(${str(el, 'TEXT')}, ${el.getFieldValue('DEFAULT') === 'true'});`;
      case 'fel_slider': return `form.addSlider(${str(el, 'TEXT')}, (float) ${num(el, 'MIN')}, (float) ${num(el, 'MAX', '100')}, Math.max(1, (int) ${num(el, 'STEP', '1')}), (float) ${num(el, 'DEFAULT')});`;
      case 'fel_dropdown': return `form.addDropdown(${str(el, 'TEXT')}, ${optionList(el, 'OPTIONS')}, Math.max(0, (int) ${num(el, 'DEFAULT', '1')} - 1));`;
      case 'fel_stepslider': return `form.addStepSlider(${str(el, 'TEXT')}, ${optionList(el, 'OPTIONS')}, Math.max(0, (int) ${num(el, 'DEFAULT', '1')} - 1));`;
      default: return '';
    }
  });
  const submit = formCallback(b, 'ON_SUBMIT', 'c3.formResponse = r;');
  const close = formCallback(b, 'ON_CLOSE', '');
  return withPlayer(b, `org.powernukkitx.form.window.CustomForm form = new org.powernukkitx.form.window.CustomForm(${str(b, 'TITLE')}); ${elements.join(' ')} Ctx c2 = c.copy(); ${submit ? `form.onSubmit(${submit});` : ''} ${close ? `form.onClose(${close});` : ''} form.send(p);`);
};

for (const t of ['fel_label', 'fel_header', 'fel_divider', 'fel_input', 'fel_toggle', 'fel_slider', 'fel_dropdown', 'fel_stepslider']) {
  G[t] = () => '';
}

G.list_add = (b) => `listAdd(${str(b, 'NAME')}, ${v(b, 'VALUE')});\n`;
G.list_remove = (b) => `listRemove(${str(b, 'NAME')}, ${v(b, 'VALUE')});\n`;
G.list_remove_at = (b) => `listRemoveAt(${str(b, 'NAME')}, (int) ${num(b, 'INDEX', '1')});\n`;
G.list_set = (b) => `listSet(${str(b, 'NAME')}, (int) ${num(b, 'INDEX', '1')}, ${v(b, 'VALUE')});\n`;
G.list_clear = (b) => `listClear(${str(b, 'NAME')});\n`;
G.list_contains = (b) => [`listContains(${str(b, 'NAME')}, ${v(b, 'VALUE')})`, ORDER];
G.list_length = (b) => [`((double) list(${str(b, 'NAME')}).size())`, ORDER];
G.list_item = (b) => [`listItem(${str(b, 'NAME')}, (int) ${num(b, 'INDEX', '1')})`, ORDER];
G.list_index_of = (b) => [`listIndexOf(${str(b, 'NAME')}, ${v(b, 'VALUE')})`, ORDER];
G.list_join = (b) => [`listJoin(${str(b, 'NAME')}, ${str(b, 'SEP', '", "')})`, ORDER];
G.list_foreach = (b) => {
  const m = hoist(statements(b, 'DO'));
  return `for (Object each : new ArrayList<>(list(${str(b, 'NAME')}))) { Ctx c2 = c.copy(); c2.listItem = each; ${m}(c2); }\n`;
};
G.list_current = () => ['(c.listItem == null ? "" : c.listItem)', ORDER];

G.pdata_set = (b) => withPlayer(b, `dataSet(p.getName(), ${str(b, 'KEY')}, ${v(b, 'VALUE')});`);
G.pdata_change = (b) => withPlayer(b, `dataSet(p.getName(), ${str(b, 'KEY')}, num(dataGet(p.getName(), ${str(b, 'KEY')})) + ${num(b, 'DELTA', '1')});`);
G.pdata_remove = (b) => withPlayer(b, `dataRemove(p.getName(), ${str(b, 'KEY')});`);
G.pdata_clear = (b) => withPlayer(b, 'dataClear(p.getName());');
G.pdata_get = (b) => pv(b, (q) => `dataGet(${q}.getName(), ${str(b, 'KEY')})`, '""');
G.pdata_has = (b) => pv(b, (q) => `dataHas(${q}.getName(), ${str(b, 'KEY')})`, 'false');
G.pdata_set_name = (b) => `dataSet(${str(b, 'NAME')}, ${str(b, 'KEY')}, ${v(b, 'VALUE')});\n`;
G.pdata_get_name = (b) => [`dataGet(${str(b, 'NAME')}, ${str(b, 'KEY')})`, ORDER];

G.form_button_text = () => ['(c.formText)', ORDER];
G.form_button_index = () => ['((double) (c.formButton + 1))', ORDER];
G.form_value = (b) => [`formValue(c.formResponse, (int) ${num(b, 'INDEX', '1')})`, ORDER];
G.form_value_index = (b) => [`formChoice(c.formResponse, (int) ${num(b, 'INDEX', '1')})`, ORDER];

G.item_full_id = (b) => [`(NS + ":" + ${jstr(cleanId(b.getFieldValue('ID')))})`, ORDER];
G.block_full_id = (b) => [`(NS + ":" + ${jstr(cleanId(b.getFieldValue('ID')))})`, ORDER];
G.item_cooldown_set = (b) => withPlayer(b, `p.setItemCoolDown(Math.max(1, (int) (${num(b, 'SECONDS', '1')} * 20)), resolveId(${str(b, 'ITEM')}));`);
G.item_cooldown_active = (b) => pv(b, (q) => `!${q}.isItemCoolDownEnd(resolveId(${str(b, 'ITEM')}))`, 'false');
G.player_holding = (b) => pv(b, (q) => `itemIs(${q}.getInventory().getItemInMainHand(), ${str(b, 'ITEM')})`, 'false');
G.player_wearing = (b) => pv(b, (q) => `wearing(${q}, ${str(b, 'ITEM')})`, 'false');
G.player_remove_effect = (b) => withPlayer(b, `p.removeEffect(org.powernukkitx.entity.effect.EffectType.get(${jstr(b.getFieldValue('EFFECT'))}));`);
G.target_player = () => ['P(c.target)', ORDER];
G.target_is_player = () => ['(c.target instanceof Player)', ORDER];
G.target_name = () => ['(c.target == null ? "" : c.target.getName())', ORDER];
G.target_health = () => ['(c.target == null ? 0.0 : (double) c.target.getHealth())', ORDER];
G.target_set_fire = (b) => `if (c.target != null) c.target.setOnFire((int) ${num(b, 'SECONDS')});\n`;
G.target_set_health = (b) => `if (c.target != null) c.target.setHealth((float) ${num(b, 'VALUE')});\n`;
G.target_add_effect = (b) => `if (c.target != null) c.target.addEffect(org.powernukkitx.entity.effect.Effect.get(${jstr(b.getFieldValue('EFFECT'))}).setDuration((int) (${num(b, 'SECONDS')} * 20)).setAmplifier(Math.max(0, (int) ${num(b, 'LEVEL', '1')} - 1)));\n`;

function jfloat(n) {
  return `${Number(n)}f`;
}

function itemClass(it, ctx) {
  const cls = 'Item_' + it.id;
  const full = `NS + ":" + ${jstr(it.id)}`;
  const p = it.props;
  const overrides = [];
  let base;
  let builder;
  if (TOOL_KINDS[it.kind]) {
    base = 'org.powernukkitx.item.customitem.ItemCustomTool';
    builder = 'toolBuilder';
    overrides.push(`public boolean ${TOOL_KINDS[it.kind]}() { return true; }`);
    overrides.push(`public int getTier() { return org.powernukkitx.item.ItemTool.${TOOL_TIER[it.tier]}; }`);
    overrides.push(`public int getMaxDurability() { return ${Math.round(p.durability ?? TOOL_DURABILITY[it.tier])}; }`);
    const dmg = p.damage ?? (it.kind === 'sword' ? SWORD_DAMAGE[it.tier] : SWORD_DAMAGE[it.tier] - 1);
    overrides.push(`public int getAttackDamage() { return ${Math.round(dmg)}; }`);
  } else if (ARMOR_KINDS[it.kind]) {
    base = 'org.powernukkitx.item.customitem.ItemCustomArmor';
    builder = 'armorBuilder';
    overrides.push(`public boolean ${ARMOR_KINDS[it.kind]}() { return true; }`);
    overrides.push(`public int getTier() { return Item.${ARMOR_TIER[it.tier]}; }`);
    overrides.push(`public int getArmorPoints() { return ${Math.round(p.armorPoints ?? ARMOR_POINTS[it.kind])}; }`);
    overrides.push(`public int getToughness() { return ${Math.round(p.toughness ?? 0)}; }`);
    overrides.push(`public int getMaxDurability() { return ${Math.round(p.durability ?? ARMOR_BASE_DURABILITY[it.kind] * ARMOR_TIER_FACTOR[it.tier])}; }`);
  } else if (it.kind === 'food') {
    base = 'org.powernukkitx.item.customitem.ItemCustomFood';
    builder = 'edibleBuilder';
    overrides.push(`public int getFoodRestore() { return ${Math.round(p.nutrition ?? 4)}; }`);
    overrides.push(`public float getSaturationRestore() { return ${jfloat(p.saturation ?? 0.6)}; }`);
    overrides.push(`public boolean canAlwaysEat() { return ${p.alwaysEat ? 'true' : 'false'}; }`);
    if (p.stack) overrides.push(`public int getMaxStackSize() { return ${Math.round(p.stack)}; }`);
  } else {
    base = 'org.powernukkitx.item.customitem.ItemCustom';
    builder = 'simpleBuilder';
    if (p.stack) overrides.push(`public int getMaxStackSize() { return ${Math.round(p.stack)}; }`);
  }

  const chain = [`.name(${jstr(it.name)})`, `.texture(${jstr(textureKey(ctx, it.id))})`];
  if (it.kind === 'item') {
    if (p.stack) chain.push(`.maxStackSize(${Math.round(p.stack)})`);
    if (p.durability) chain.push(`.durability(${Math.round(p.durability)})`);
    if (p.damage) chain.push(`.damage(${Math.round(p.damage)})`);
  }
  if (p.glint) chain.push('.glint(true)');
  if (p.handEquipped || TOOL_KINDS[it.kind]) chain.push('.handEquipped(true)');
  if (p.cooldown > 0) chain.push(`.cooldown(${full}, ${jfloat(p.cooldown)})`);
  const usable = p.usable != null || p.cooldown > 0 || ctx.usedItemIds.has(it.id);
  if (usable && it.kind !== 'food') chain.push(`.useModifiers(1f, ${jfloat(Math.max(0, p.usable ?? 0.1))})`);

  return `    public static final class ${cls} extends ${base} {

        public ${cls}() {
            super(${full});
        }

${overrides.map((o) => {
    const m = /^(.*?) \{ (.*); \}$/.exec(o);
    return `        @Override\n        ${m[1]} {\n            ${m[2]};\n        }\n`;
  }).join('\n')}
        @Override
        public org.powernukkitx.item.customitem.CustomItemDefinition getDefinition() {
            return org.powernukkitx.item.customitem.CustomItemDefinition.${builder}(this)
                ${chain.join('\n                ')}
                .build();
        }
    }
`;
}

function textureKey(ctx, id) {
  return `psx_${ctx.ns}_${id}`;
}

function texturePath(kind, name) {
  const clean = String(name || '').trim().replace(/\\/g, '/').replace(/\.png$/i, '');
  if (clean.startsWith('textures/')) return clean;
  return `textures/${kind}/${clean || 'missing'}`;
}

function blockClass(bl, ctx) {
  const cls = 'Block_' + bl.id;
  const p = bl.props;
  const base = p.transparent ? 'org.powernukkitx.block.BlockTransparent' : 'org.powernukkitx.block.BlockSolid';
  const hardness = p.hardness ?? 3;
  const resistance = p.resistance ?? 15;
  const light = p.light ?? 0;
  const friction = p.friction ?? 0.6;
  return `    public static final class ${cls} extends ${base} implements org.powernukkitx.block.customblock.CustomBlock {

        public static final org.powernukkitx.block.BlockProperties PROPERTIES = new org.powernukkitx.block.BlockProperties(NS + ":" + ${jstr(bl.id)});

        public ${cls}() {
            super(PROPERTIES.getDefaultState());
        }

        public ${cls}(org.powernukkitx.block.BlockState blockState) {
            super(blockState);
        }

        @Override
        public org.powernukkitx.block.BlockProperties getProperties() {
            return PROPERTIES;
        }

        @Override
        public String getName() {
            return ${jstr(bl.name)};
        }

        @Override
        public double getHardness() {
            return ${Number(hardness)};
        }

        @Override
        public double getResistance() {
            return ${Number(resistance)};
        }

        @Override
        public int getLightLevel() {
            return ${light};
        }

        @Override
        public double getFrictionFactor() {
            return ${Number(friction)};
        }

        @Override
        public int getLightFilter() {
            return ${p.transparent ? 0 : 15};
        }

        @Override
        public org.powernukkitx.block.customblock.CustomBlockDefinition getDefinition() {
            return org.powernukkitx.block.customblock.CustomBlockDefinition.builder(this)
                .name(${jstr(bl.name)})
                .texture(${jstr(textureKey(ctx, bl.id))})
                .breakTime(${jfloat(hardness * 1.5)})
                .destructibleByExplosion(${Math.round(resistance)})
                .lightEmission(${light})
                .lightDampening(${p.transparent ? 0 : 15})
                .friction(${jfloat(friction)})
                .build();
        }
    }
`;
}

// ---------------- Assembly ----------------
export function sanitizeName(name) {
  const n = String(name || '').replace(/[^A-Za-z0-9 _.-]/g, '').replace(/ /g, '_');
  return n || 'MyPlugin';
}

export function packageOf(name) {
  const p = sanitizeName(name).toLowerCase().replace(/[^a-z0-9]/g, '');
  return 'psx.' + (/^[a-z]/.test(p) ? p : 'p' + p || 'plugin');
}

function yamlStr(s) {
  return JSON.stringify(String(s ?? ''));
}

function yamlValue(val) {
  if (typeof val === 'number' || typeof val === 'boolean') return String(val);
  return yamlStr(val);
}

export function buildProject(workspace, meta) {
  const name = sanitizeName(meta.name);
  const pkg = packageOf(meta.name);
  const main = pkg + '.Main';

  javaGenerator.init(workspace);
  const tops = workspace.getTopBlocks(true);
  for (const b of tops) {
    if (b.isEnabled && !b.isEnabled()) continue;
    javaGenerator.blockToCode(b);
  }
  const ctx = javaGenerator.ctx;
  ctx.ns = pkg.split('.').pop();

  const seen = new Set();
  const commands = ctx.commands.filter((c) => (seen.has(c.name) ? false : seen.add(c.name)));

  const files = {};
  files['plugin.yml'] = pluginYml({ ...meta, name, main }, commands, ctx.permissions);
  if (ctx.configDefaults.length) {
    files['config.yml'] = ctx.configDefaults.map((d) => `${d.key}: ${yamlValue(d.value)}`).join('\n') + '\n';
  }
  files['src/' + pkg.replace(/\./g, '/') + '/Main.java'] = mainJava(pkg, meta, ctx, commands);

  const seenItems = new Set();
  const seenBlocks = new Set();
  const resourcePack = {
    name,
    version: meta.version || '1.0.0',
    items: ctx.items
      .filter((i) => (seenItems.has(i.id) ? false : seenItems.add(i.id)))
      .map((i) => ({ id: i.id, key: textureKey(ctx, i.id), path: texturePath('items', i.texture) })),
    blocks: ctx.blocks
      .filter((b) => (seenBlocks.has(b.id) ? false : seenBlocks.add(b.id)))
      .map((b) => ({ id: b.id, key: textureKey(ctx, b.id), path: texturePath('blocks', b.texture) })),
  };

  return { name, version: meta.version || '1.0.0', main, files, java: files['src/' + pkg.replace(/\./g, '/') + '/Main.java'], resourcePack };
}

function pluginYml(meta, commands, permissions) {
  const lines = [
    `name: ${yamlStr(meta.name)}`,
    `main: ${meta.main}`,
    `version: ${yamlStr(meta.version || '1.0.0')}`,
    'api: ["3.0.0"]',
    `author: ${yamlStr(meta.author || 'PowerScratchedX')}`,
    `description: ${yamlStr(meta.description || '')}`,
  ];
  if (commands.length) {
    lines.push('commands:');
    for (const c of commands) {
      lines.push(`  ${c.name}:`);
      lines.push(`    description: ${yamlStr(c.description)}`);
      lines.push(`    usage: ${yamlStr('/' + c.name)}`);
      if (c.permission) lines.push(`    permission: ${yamlStr(c.permission)}`);
    }
  }
  if (permissions.length) {
    lines.push('permissions:');
    for (const p of permissions) {
      lines.push(`  ${yamlStr(p.name)}:`);
      lines.push(`    default: ${p.def}`);
      if (p.description) lines.push(`    description: ${yamlStr(p.description)}`);
    }
  }
  return lines.join('\n') + '\n';
}

function indent(s, n = 2) {
  const pad = javaGenerator.INDENT.repeat(n);
  return s.split('\n').map((l) => (l ? pad + l : l)).join('\n');
}

function mainJava(pkg, meta, ctx, commands) {
  const enableParts = [];
  enableParts.push('instance = this;');
  enableParts.push('loadData();');
  if (ctx.configDefaults.length) enableParts.push('saveDefaultConfig();');
  if (ctx.handlers.length) enableParts.push('getServer().getPluginManager().registerEvents(this, this);');
  enableParts.push(...ctx.repeating);
  const enableBody = ctx.enableBody.join('');
  const disableBody = ctx.disableBody.join('');

  const commandSwitch = commands.length
    ? commands.map((c) => `            case ${jstr(c.name)} -> { ${c.method}(c); return true; }`).join('\n')
    : '';

  const seenItems = new Set();
  const items = ctx.items.filter((i) => (seenItems.has(i.id) ? false : seenItems.add(i.id)));
  const seenBlocks = new Set();
  const blocks = ctx.blocks.filter((b) => (seenBlocks.has(b.id) ? false : seenBlocks.add(b.id)));
  const ns = pkg.split('.').pop();
  const customIds = [...items.map((i) => `NS + ":" + ${jstr(i.id)}`), ...blocks.map((b) => `NS + ":" + ${jstr(b.id)}`)];
  const cooldowns = items.filter((i) => i.props.cooldown > 0).map((i) => `NS + ":" + ${jstr(i.id)}, ${Math.max(1, Math.round(i.props.cooldown * 20))}`);
  const registrations = [];
  if (items.length) registrations.push(`Registries.ITEM.registerCustomItem(this, ${items.map((i) => `Item_${i.id}.class`).join(', ')});`);
  if (blocks.length) registrations.push(`Registries.BLOCK.registerCustomBlock(this, ${blocks.map((b) => `Block_${b.id}.class`).join(', ')});`);
  const onLoad = registrations.length
    ? `
    @Override
    public void onLoad() {
        instance = this;
        try {
${registrations.map((r) => '            ' + r).join('\n')}
            getLogger().info("Registered ${items.length} custom item(s) and ${blocks.length} custom block(s)");
        } catch (RegisterException e) {
            getLogger().error("Failed to register custom content", e);
        }
    }
`
    : '';

  return `package ${pkg};

import org.powernukkitx.Player;
import org.powernukkitx.block.Block;
import org.powernukkitx.command.Command;
import org.powernukkitx.command.CommandSender;
import org.powernukkitx.entity.Entity;
import org.powernukkitx.event.EventHandler;
import org.powernukkitx.event.Listener;
import org.powernukkitx.item.Item;
import org.powernukkitx.level.Level;
import org.powernukkitx.plugin.PluginBase;
${registrations.length ? 'import org.powernukkitx.registry.RegisterException;\nimport org.powernukkitx.registry.Registries;\n' : ''}
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.function.Function;

/**
 * ${sanitizeName(meta.name)} ${meta.version || '1.0.0'} - generated by PowerScratchedX.
 */
public final class Main extends PluginBase implements Listener {

    private static final String NS = ${jstr(ns)};
    private static final Set<String> CUSTOM_IDS = Set.of(${customIds.join(', ')});
    private static final Map<String, Integer> COOLDOWNS = Map.of(${cooldowns.join(', ')});

    private static Main instance;
    private Object cooldownEvent;
    private boolean cooldownResult;
${ctx.variables.length ? '\n' + ctx.variables.map((n) => `    private Object ${n} = 0.0;`).join('\n') + '\n' : ''}
    public static Main getInstance() {
        return instance;
    }
${onLoad}
    @Override
    public void onEnable() {
${enableParts.map((l) => '        ' + l).join('\n')}
        Ctx c = new Ctx();
${indent(enableBody, 1)}    }

    @Override
    public void onDisable() {
        Ctx c = new Ctx();
${indent(disableBody, 1)}        saveData();
    }

    @Override
    public boolean onCommand(CommandSender sender, Command command, String label, String[] args) {
        Ctx c = new Ctx();
        c.sender = sender;
        c.args = args;
        if (sender instanceof Player p) c.player = p;
        switch (command.getName().toLowerCase()) {
${commandSwitch}
            default -> { return false; }
        }
    }

${ctx.handlers.join('\n')}
${ctx.methods.join('\n')}${items.map((i) => itemClass(i, ctx)).join('\n')}${blocks.map((b) => blockClass(b, ctx)).join('\n')}
    static final class Ctx {
        Player player;
        CommandSender sender;
        String[] args = new String[0];
        Object event;
        String message = "";
        Block block;
        Item item;
        Entity target;
        Object packet;
        double damage;
        int formButton = -1;
        String formText = "";
        Object formResponse;
        Object listItem;

        Ctx copy() {
            Ctx n = new Ctx();
            n.player = player;
            n.sender = sender;
            n.args = args;
            n.event = event;
            n.message = message;
            n.block = block;
            n.item = item;
            n.target = target;
            n.packet = packet;
            n.damage = damage;
            n.formButton = formButton;
            n.formText = formText;
            n.formResponse = formResponse;
            n.listItem = listItem;
            return n;
        }
    }

    private final Map<String, List<Object>> lists = new java.util.LinkedHashMap<>();
    private final Map<String, Map<String, Object>> playerData = new java.util.LinkedHashMap<>();
    private static final com.google.gson.Gson GSON = new com.google.gson.GsonBuilder().setPrettyPrinting().create();

    private java.io.File dataFile(String name) {
        getDataFolder().mkdirs();
        return new java.io.File(getDataFolder(), name);
    }

    private void loadData() {
        try {
            java.io.File listsFile = dataFile("lists.json");
            if (listsFile.isFile()) {
                Map<String, List<Object>> loaded = GSON.fromJson(java.nio.file.Files.readString(listsFile.toPath()), new com.google.gson.reflect.TypeToken<Map<String, List<Object>>>() { }.getType());
                if (loaded != null) lists.putAll(loaded);
            }
            java.io.File playersFile = dataFile("players.json");
            if (playersFile.isFile()) {
                Map<String, Map<String, Object>> loaded = GSON.fromJson(java.nio.file.Files.readString(playersFile.toPath()), new com.google.gson.reflect.TypeToken<Map<String, Map<String, Object>>>() { }.getType());
                if (loaded != null) playerData.putAll(loaded);
            }
        } catch (Exception e) {
            getLogger().warning("Could not load plugin data: " + e.getMessage());
        }
    }

    private void saveData() {
        try {
            java.nio.file.Files.writeString(dataFile("lists.json").toPath(), GSON.toJson(lists));
            java.nio.file.Files.writeString(dataFile("players.json").toPath(), GSON.toJson(playerData));
        } catch (Exception e) {
            getLogger().warning("Could not save plugin data: " + e.getMessage());
        }
    }

    private List<Object> list(String name) {
        return lists.computeIfAbsent(str(name).toLowerCase(), k -> new ArrayList<>());
    }

    private void listAdd(String name, Object value) {
        list(name).add(value);
        saveData();
    }

    private void listRemove(String name, Object value) {
        List<Object> items = list(name);
        for (int i = 0; i < items.size(); i++) {
            if (eq(items.get(i), value)) {
                items.remove(i);
                saveData();
                return;
            }
        }
    }

    private void listRemoveAt(String name, int index) {
        List<Object> items = list(name);
        if (index >= 1 && index <= items.size()) {
            items.remove(index - 1);
            saveData();
        }
    }

    private void listSet(String name, int index, Object value) {
        List<Object> items = list(name);
        if (index >= 1 && index <= items.size()) {
            items.set(index - 1, value);
            saveData();
        }
    }

    private void listClear(String name) {
        list(name).clear();
        saveData();
    }

    private boolean listContains(String name, Object value) {
        for (Object item : list(name)) {
            if (eq(item, value)) return true;
        }
        return false;
    }

    private Object listItem(String name, int index) {
        List<Object> items = list(name);
        return index >= 1 && index <= items.size() ? items.get(index - 1) : "";
    }

    private double listIndexOf(String name, Object value) {
        List<Object> items = list(name);
        for (int i = 0; i < items.size(); i++) {
            if (eq(items.get(i), value)) return i + 1;
        }
        return 0;
    }

    private String listJoin(String name, String separator) {
        StringBuilder out = new StringBuilder();
        for (Object item : list(name)) {
            if (out.length() > 0) out.append(separator);
            out.append(str(item));
        }
        return out.toString();
    }

    private Map<String, Object> data(String playerName) {
        return playerData.computeIfAbsent(str(playerName).toLowerCase(), k -> new java.util.LinkedHashMap<>());
    }

    private void dataSet(String playerName, String key, Object value) {
        data(playerName).put(str(key), value);
        saveData();
    }

    private Object dataGet(String playerName, String key) {
        Object value = data(playerName).get(str(key));
        return value == null ? "" : value;
    }

    private boolean dataHas(String playerName, String key) {
        return data(playerName).containsKey(str(key));
    }

    private void dataRemove(String playerName, String key) {
        data(playerName).remove(str(key));
        saveData();
    }

    private void dataClear(String playerName) {
        playerData.remove(str(playerName).toLowerCase());
        saveData();
    }

    private static org.powernukkitx.form.element.simple.ButtonImage buttonImage(String image) {
        if (image == null || image.isBlank()) return null;
        String path = image.trim();
        boolean url = path.startsWith("http://") || path.startsWith("https://");
        return new org.powernukkitx.form.element.simple.ButtonImage(url ? org.powernukkitx.form.element.simple.ButtonImage.Type.URL : org.powernukkitx.form.element.simple.ButtonImage.Type.PATH, path);
    }

    private static Object formValue(Object response, int index) {
        if (!(response instanceof org.powernukkitx.form.response.CustomResponse custom)) return "";
        try {
            Object value = custom.getResponse(index - 1);
            if (value instanceof org.powernukkitx.form.response.ElementResponse element) return element.elementText();
            if (value instanceof Float f) return f.doubleValue();
            return value == null ? "" : value;
        } catch (Exception e) {
            return "";
        }
    }

    private static double formChoice(Object response, int index) {
        if (!(response instanceof org.powernukkitx.form.response.CustomResponse custom)) return 0;
        try {
            Object value = custom.getResponse(index - 1);
            if (value instanceof org.powernukkitx.form.response.ElementResponse element) return element.elementId() + 1;
            return num(value);
        } catch (Exception e) {
            return 0;
        }
    }

    private static boolean packetIs(Object packet, String type) {
        if (type == null || type.isEmpty()) return true;
        if (packet == null) return false;
        String name = packet.getClass().getSimpleName();
        return name.equalsIgnoreCase(type) || name.equalsIgnoreCase(type + "Packet");
    }

    private Object packetNew(String type) {
        String name = type.endsWith("Packet") ? type : type + "Packet";
        try {
            return Class.forName("org.cloudburstmc.protocol.bedrock.packet." + name).getConstructor().newInstance();
        } catch (ReflectiveOperationException e) {
            getLogger().warning("Unknown packet type: " + type);
            return null;
        }
    }

    private static void packetSet(Object packet, String field, Object value) {
        if (packet == null || field == null || field.isEmpty()) return;
        String setter = "set" + field;
        for (java.lang.reflect.Method m : packet.getClass().getMethods()) {
            if (m.getParameterCount() == 1 && m.getName().equalsIgnoreCase(setter)) {
                try {
                    m.invoke(packet, packetValue(value, m.getParameterTypes()[0]));
                } catch (ReflectiveOperationException | IllegalArgumentException ignored) {
                    // incompatible value
                }
                return;
            }
        }
    }

    private static Object packetGet(Object packet, String field) {
        if (packet == null || field == null || field.isEmpty()) return "";
        for (java.lang.reflect.Method m : packet.getClass().getMethods()) {
            if (m.getParameterCount() == 0 && (m.getName().equalsIgnoreCase("get" + field) || m.getName().equalsIgnoreCase("is" + field))) {
                try {
                    Object result = m.invoke(packet);
                    if (result instanceof Enum<?> e) return e.name();
                    return result == null ? "" : result;
                } catch (ReflectiveOperationException e) {
                    return "";
                }
            }
        }
        return "";
    }

    private static Object packetValue(Object value, Class<?> type) {
        if (type == String.class) return str(value);
        if (type == int.class || type == Integer.class) return (int) num(value);
        if (type == long.class || type == Long.class) return (long) num(value);
        if (type == float.class || type == Float.class) return (float) num(value);
        if (type == double.class || type == Double.class) return num(value);
        if (type == short.class || type == Short.class) return (short) num(value);
        if (type == byte.class || type == Byte.class) return (byte) num(value);
        if (type == boolean.class || type == Boolean.class) return bool(value);
        if (type.isEnum()) {
            String wanted = str(value).trim();
            Object[] constants = type.getEnumConstants();
            if (value instanceof Number n && n.intValue() >= 0 && n.intValue() < constants.length) return constants[n.intValue()];
            for (Object constant : constants) {
                if (((Enum<?>) constant).name().equalsIgnoreCase(wanted)) return constant;
            }
            return constants.length > 0 ? constants[0] : null;
        }
        if (type == java.util.UUID.class) return java.util.UUID.fromString(str(value));
        if (type == org.cloudburstmc.math.vector.Vector3f.class || type == org.cloudburstmc.math.vector.Vector3i.class || type == org.cloudburstmc.math.vector.Vector2f.class) {
            String[] parts = str(value).trim().split("[\\s,;]+");
            double x = parts.length > 0 ? num(parts[0]) : 0;
            double y = parts.length > 1 ? num(parts[1]) : 0;
            double z = parts.length > 2 ? num(parts[2]) : 0;
            if (type == org.cloudburstmc.math.vector.Vector3i.class) return org.cloudburstmc.math.vector.Vector3i.from((int) x, (int) y, (int) z);
            if (type == org.cloudburstmc.math.vector.Vector2f.class) return org.cloudburstmc.math.vector.Vector2f.from((float) x, (float) y);
            return org.cloudburstmc.math.vector.Vector3f.from((float) x, (float) y, (float) z);
        }
        return type.isInstance(value) ? value : null;
    }

    private static String resolveId(String id) {
        if (id == null || id.isEmpty()) return "";
        if (id.contains(":")) return id;
        return CUSTOM_IDS.contains(NS + ":" + id) ? NS + ":" + id : "minecraft:" + id;
    }

    private static boolean itemIs(Item item, String wanted) {
        if (wanted == null || wanted.isEmpty()) return true;
        if (item == null || item.isNull()) return false;
        return item.getId().equals(resolveId(wanted));
    }

    private static boolean blockIs(Block block, String wanted) {
        if (wanted == null || wanted.isEmpty()) return true;
        if (block == null) return false;
        return block.getId().equals(resolveId(wanted));
    }

    private static boolean wearing(Player p, String wanted) {
        for (Item armor : p.getInventory().getArmorContents()) {
            if (armor != null && !armor.isNull() && itemIs(armor, wanted)) return true;
        }
        return false;
    }

    private boolean cooldownOk(Ctx c) {
        if (c.event != null && c.event == cooldownEvent) return cooldownResult;
        cooldownEvent = c.event;
        cooldownResult = true;
        if (c.player != null && c.item != null && !c.item.isNull()) {
            Integer ticks = COOLDOWNS.get(c.item.getId());
            if (ticks != null) {
                if (c.player.isItemCoolDownEnd(c.item.getId())) {
                    c.player.setItemCoolDown(ticks, c.item.getId());
                } else {
                    cooldownResult = false;
                }
            }
        }
        return cooldownResult;
    }

    private static Player P(Object o) {
        return o instanceof Player p ? p : null;
    }

    private static <T> T pget(Player p, Function<Player, T> f, T fallback) {
        return p == null ? fallback : f.apply(p);
    }

    private List<Player> players() {
        return new ArrayList<>(getServer().getOnlinePlayers().values());
    }

    private Level lvl(Ctx c) {
        return c.player != null && c.player.getLevel() != null ? c.player.getLevel() : getServer().getDefaultLevel();
    }

    private static String arg(Ctx c, int index) {
        return index >= 1 && index <= c.args.length ? c.args[index - 1] : "";
    }

    private static Item item(String id, int count) {
        try {
            Item it = Item.get(resolveId(id), 0, Math.max(1, count));
            return it.isNull() ? null : it;
        } catch (Exception e) {
            return null;
        }
    }

    private static Block block(String id) {
        try {
            return Block.get(resolveId(id));
        } catch (Exception e) {
            return null;
        }
    }

    private static Object cfgval(Object o) {
        if (o instanceof Double d && d == Math.floor(d) && !Double.isInfinite(d)) return d.intValue();
        return o;
    }

    private static double num(Object o) {
        if (o instanceof Number n) return n.doubleValue();
        if (o instanceof Boolean b) return b ? 1 : 0;
        if (o == null) return 0;
        try {
            return Double.parseDouble(String.valueOf(o).trim());
        } catch (NumberFormatException e) {
            return 0;
        }
    }

    private static String str(Object o) {
        if (o == null) return "";
        if (o instanceof Player p) return p.getName();
        if (o instanceof Double d) {
            if (d == Math.floor(d) && !Double.isInfinite(d)) return String.valueOf(d.longValue());
            return String.valueOf(d);
        }
        return String.valueOf(o);
    }

    private static boolean bool(Object o) {
        if (o instanceof Boolean b) return b;
        if (o instanceof Number n) return n.doubleValue() != 0;
        if (o == null) return false;
        String s = String.valueOf(o).trim().toLowerCase();
        return !(s.isEmpty() || s.equals("false") || s.equals("0"));
    }

    private static boolean eq(Object a, Object b) {
        if (a instanceof Number || b instanceof Number) {
            try {
                return num(a) == num(b) && (a instanceof Number || !str(a).isEmpty()) && (b instanceof Number || !str(b).isEmpty());
            } catch (Exception ignored) {
                // fall through
            }
        }
        return str(a).equalsIgnoreCase(str(b));
    }

    private static double div(double a, double b) {
        return b == 0 ? 0 : a / b;
    }

    private static double mod(double a, double b) {
        return b == 0 ? 0 : a % b;
    }

    private static double rnd(double from, double to) {
        int lo = (int) Math.min(from, to);
        int hi = (int) Math.max(from, to);
        return lo + (int) (Math.random() * (hi - lo + 1));
    }
}
`;
}
