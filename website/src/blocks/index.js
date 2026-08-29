import * as Blockly from 'blockly';
import { C } from './colors.js';

const EFFECTS = [
  ['speed', 'speed'], ['slowness', 'slowness'], ['haste', 'haste'], ['mining fatigue', 'mining_fatigue'],
  ['strength', 'strength'], ['instant health', 'instant_health'], ['instant damage', 'instant_damage'],
  ['jump boost', 'jump_boost'], ['nausea', 'nausea'], ['regeneration', 'regeneration'],
  ['resistance', 'resistance'], ['fire resistance', 'fire_resistance'], ['water breathing', 'water_breathing'],
  ['invisibility', 'invisibility'], ['blindness', 'blindness'], ['night vision', 'night_vision'],
  ['hunger', 'hunger'], ['weakness', 'weakness'], ['poison', 'poison'], ['wither', 'wither'],
  ['health boost', 'health_boost'], ['absorption', 'absorption'], ['saturation', 'saturation'],
  ['levitation', 'levitation'], ['slow falling', 'slow_falling'], ['darkness', 'darkness'],
];

const AXIS = { type: 'field_dropdown', name: 'AXIS', options: [['x', 'X'], ['y', 'Y'], ['z', 'Z']] };

const hat = (type, message, extra = {}) => ({
  type,
  message0: message,
  args0: extra.args0 || [],
  message1: '%1',
  args1: [{ type: 'input_statement', name: 'DO' }],
  colour: extra.colour || C.events,
  hat: 'cap',
  tooltip: extra.tooltip || '',
});

const stmt = (type, message, args, colour, tooltip = '') => ({
  type, message0: message, args0: args, colour, previousStatement: null, nextStatement: null, tooltip,
});

const val = (type, message, args, colour, output = null, tooltip = '') => ({
  type, message0: message, args0: args, colour, output, tooltip,
});

const PLAYER = { type: 'input_value', name: 'PLAYER', check: 'Player' };
const T = (name) => ({ type: 'input_value', name });

const defs = [
  // ---------------- EVENTS ----------------
  hat('evt_enable', 'when plugin starts', { tooltip: 'Runs when the plugin is enabled (onEnable)' }),
  hat('evt_disable', 'when plugin stops'),
  hat('evt_player_join', 'when a player joins'),
  hat('evt_player_quit', 'when a player leaves'),
  hat('evt_player_chat', 'when a player chats'),
  hat('evt_player_command', 'when a player runs a command'),
  hat('evt_block_break', 'when a player breaks a block'),
  hat('evt_block_place', 'when a player places a block'),
  hat('evt_player_interact', 'when a player interacts (click)'),
  hat('evt_player_death', 'when a player dies'),
  hat('evt_player_respawn', 'when a player respawns'),
  hat('evt_player_damage', 'when a player takes damage'),
  hat('evt_player_move', 'when a player moves'),
  stmt('evt_cancel', 'cancel event', [], C.events, 'Cancels the event (block not broken, message not sent...)'),
  val('evt_message', 'event message', [], C.events, 'String', 'Chat message or typed command'),
  stmt('evt_set_message', 'set chat message to %1', [T('TEXT')], C.events),
  stmt('evt_set_broadcast', 'set %1 message to %2', [
    { type: 'field_dropdown', name: 'KIND', options: [['join', 'JOIN'], ['quit', 'QUIT'], ['death', 'DEATH']] },
    T('TEXT'),
  ], C.events, 'Message broadcast to everyone on join / quit / death'),
  val('evt_block_id', 'event block id', [], C.events, 'String'),
  val('evt_block_coord', 'event block %1', [AXIS], C.events, 'Number'),
  val('evt_item_id', 'event item id', [], C.events, 'String'),
  val('evt_damage', 'event damage', [], C.events, 'Number'),
  stmt('evt_set_damage', 'set event damage to %1', [T('VALUE')], C.events),

  // ---------------- PLAYER ----------------
  val('player_current', 'player', [], C.player, 'Player', 'The player of the current event / command'),
  val('player_by_name', 'player named %1', [T('NAME')], C.player, 'Player'),
  stmt('player_send_message', 'send %2 to %1', [PLAYER, T('TEXT')], C.player),
  stmt('player_send_title', 'show title %2 subtitle %3 to %1', [PLAYER, T('TITLE'), T('SUB')], C.player),
  stmt('player_send_bar', 'show %2 %3 to %1', [
    PLAYER,
    { type: 'field_dropdown', name: 'KIND', options: [['action bar', 'ACTIONBAR'], ['popup', 'POPUP'], ['tip', 'TIP']] },
    T('TEXT'),
  ], C.player),
  stmt('player_teleport', 'teleport %1 to x: %2 y: %3 z: %4', [PLAYER, T('X'), T('Y'), T('Z')], C.player),
  stmt('player_teleport_to', 'teleport %1 to %2', [PLAYER, { type: 'input_value', name: 'TARGET', check: 'Player' }], C.player),
  stmt('player_teleport_spawn', 'teleport %1 to spawn', [PLAYER], C.player),
  stmt('player_give_item', 'give %3 × %2 to %1', [PLAYER, T('ITEM'), T('COUNT')], C.player, 'Item id, e.g. minecraft:diamond'),
  stmt('player_clear_inventory', 'clear inventory of %1', [PLAYER], C.player),
  stmt('player_kick', 'kick %1 reason %2', [PLAYER, T('REASON')], C.player),
  stmt('player_set_gamemode', 'set gamemode of %1 to %2', [
    PLAYER,
    { type: 'field_dropdown', name: 'MODE', options: [['survival', '0'], ['creative', '1'], ['adventure', '2'], ['spectator', '3']] },
  ], C.player),
  stmt('player_set_health', 'set health of %1 to %2', [PLAYER, T('VALUE')], C.player),
  stmt('player_set_food', 'set food of %1 to %2', [PLAYER, T('VALUE')], C.player),
  stmt('player_add_effect', 'give effect %2 to %1 for %3 s level %4', [
    PLAYER, { type: 'field_dropdown', name: 'EFFECT', options: EFFECTS }, T('SECONDS'), T('LEVEL'),
  ], C.player),
  stmt('player_clear_effects', 'clear all effects of %1', [PLAYER], C.player),
  stmt('player_set_fire', 'set %1 on fire for %2 s', [PLAYER, T('SECONDS')], C.player),
  stmt('player_add_xp', 'give %2 xp to %1', [PLAYER, T('VALUE')], C.player),
  stmt('player_run_command', 'make %1 run command %2', [PLAYER, T('CMD')], C.player, 'Without the leading /'),
  stmt('player_set_op', '%2 %1', [
    PLAYER, { type: 'field_dropdown', name: 'OP', options: [['make operator', 'true'], ['remove operator from', 'false']] },
  ], C.player),
  stmt('player_play_sound', 'play sound %2 to %1', [PLAYER, T('SOUND')], C.player, 'E.g. random.levelup, mob.enderdragon.growl'),
  stmt('player_set_display_name', 'set display name of %1 to %2', [PLAYER, T('NAME')], C.player),
  val('player_name', 'name of %1', [PLAYER], C.player, 'String'),
  val('player_health', 'health of %1', [PLAYER], C.player, 'Number'),
  val('player_food', 'food of %1', [PLAYER], C.player, 'Number'),
  val('player_coord', '%1 of %2', [AXIS, PLAYER], C.player, 'Number'),
  val('player_world', 'world of %1', [PLAYER], C.player, 'String'),
  val('player_gamemode', 'gamemode of %1', [PLAYER], C.player, 'Number', '0 survival, 1 creative, 2 adventure, 3 spectator'),
  val('player_item_in_hand', 'item in hand of %1', [PLAYER], C.player, 'String'),
  val('player_has_permission', '%1 has permission %2', [PLAYER, T('PERM')], C.player, 'Boolean'),
  val('player_is_op', '%1 is operator', [PLAYER], C.player, 'Boolean'),
  val('player_is_online', '%1 is online', [PLAYER], C.player, 'Boolean'),
  val('player_is_sneaking', '%1 is sneaking', [PLAYER], C.player, 'Boolean'),

  // ---------------- SERVER ----------------
  stmt('server_broadcast', 'broadcast %1', [T('TEXT')], C.server),
  stmt('server_run_command', 'run console command %1', [T('CMD')], C.server, 'Without the leading /'),
  stmt('server_log', 'log %1 to console', [T('TEXT')], C.server),
  stmt('server_foreach_player', 'for each online player %1 %2', [
    { type: 'input_dummy' }, { type: 'input_statement', name: 'DO' },
  ], C.server, 'Inside, the "player" block refers to each player in turn'),
  val('server_online_count', 'online player count', [], C.server, 'Number'),
  val('server_online_names', 'online player names', [], C.server, 'String'),
  stmt('server_set_block', 'set block %4 at x: %1 y: %2 z: %3', [T('X'), T('Y'), T('Z'), T('BLOCK')], C.server, "In the player's world (or the default world). E.g. minecraft:stone"),
  val('server_get_block', 'block id at x: %1 y: %2 z: %3', [T('X'), T('Y'), T('Z')], C.server, 'String'),
  stmt('server_set_time', 'set world time to %1', [T('TIME')], C.server, '0 = morning, 6000 = noon, 13000 = night'),
  stmt('server_play_sound_at', 'play sound %4 at x: %1 y: %2 z: %3', [T('X'), T('Y'), T('Z'), T('SOUND')], C.server),
  val('server_world_name', 'current world name', [], C.server, 'String'),

  // ---------------- COMMANDS ----------------
  {
    type: 'cmd_hat',
    message0: 'when command / %1 is run',
    args0: [{ type: 'field_input', name: 'NAME', text: 'hello' }],
    message1: 'description %1 permission %2',
    args1: [
      { type: 'field_input', name: 'DESC', text: 'My command' },
      { type: 'field_input', name: 'PERM', text: '' },
    ],
    message2: '%1',
    args2: [{ type: 'input_statement', name: 'DO' }],
    colour: C.commands,
    hat: 'cap',
    tooltip: 'Creates a command. Leave permission empty to let everyone use it.',
  },
  stmt('cmd_reply', 'reply %1 to sender', [T('TEXT')], C.commands),
  val('cmd_sender_name', 'sender name', [], C.commands, 'String'),
  val('cmd_sender_is_player', 'sender is a player', [], C.commands, 'Boolean'),
  val('cmd_arg', 'argument # %1', [T('INDEX')], C.commands, 'String', 'Starts at 1. Empty if missing.'),
  val('cmd_arg_count', 'argument count', [], C.commands, 'Number'),
  val('cmd_args_joined', 'all arguments', [], C.commands, 'String'),
  {
    type: 'perm_define',
    message0: 'permission %1 default %2',
    args0: [
      { type: 'field_input', name: 'NAME', text: 'myplugin.use' },
      { type: 'field_dropdown', name: 'DEFAULT', options: [['operators', 'op'], ['everyone', 'true'], ['nobody', 'false'], ['non-operators', 'notop']] },
    ],
    message1: 'description %1',
    args1: [{ type: 'field_input', name: 'DESC', text: '' }],
    colour: C.commands,
    tooltip: 'Declares a permission in plugin.yml',
  },

  // ---------------- CONFIG ----------------
  {
    type: 'cfg_default',
    message0: 'config: %1 defaults to %2',
    args0: [{ type: 'field_input', name: 'KEY', text: 'message' }, T('VALUE')],
    colour: C.config,
    tooltip: 'Adds a default value to config.yml',
  },
  val('cfg_get', 'config %1', [T('KEY')], C.config, null),
  stmt('cfg_set', 'set config %1 to %2', [T('KEY'), T('VALUE')], C.config, 'Updates and saves config.yml'),
  stmt('cfg_reload', 'reload config', [], C.config),
  val('cfg_has', 'config has %1', [T('KEY')], C.config, 'Boolean'),

  // ---------------- CONTROL / TIME ----------------
  {
    type: 'time_every',
    message0: 'every %1 ticks',
    args0: [{ type: 'field_number', name: 'TICKS', value: 20, min: 1, precision: 1 }],
    message1: '%1',
    args1: [{ type: 'input_statement', name: 'DO' }],
    colour: C.time,
    hat: 'cap',
    tooltip: '20 ticks = 1 second',
  },
  stmt('time_wait', 'wait %1 ticks then %2 %3', [T('TICKS'), { type: 'input_dummy' }, { type: 'input_statement', name: 'DO' }], C.time, 'Does not block the server: the body runs later'),
  stmt('ctrl_stop', 'stop this script', [], C.control),
  val('time_now', 'server time (ms)', [], C.time, 'Number'),
  val('op_contains', '%1 contains %2', [T('TEXT'), T('PART')], C.operators, 'Boolean'),
  val('op_to_number', 'number %1', [T('VALUE')], C.operators, 'Number'),
  val('op_starts_with', '%1 starts with %2', [T('TEXT'), T('PART')], C.operators, 'Boolean'),
  val('op_replace', 'replace %2 with %3 in %1', [T('TEXT'), T('FROM'), T('TO')], C.operators, 'String'),
  val('op_color', 'color %1', [{
    type: 'field_dropdown', name: 'CODE', options: [
      ['black', '§0'], ['dark blue', '§1'], ['dark green', '§2'], ['dark aqua', '§3'], ['dark red', '§4'],
      ['purple', '§5'], ['gold', '§6'], ['gray', '§7'], ['dark gray', '§8'], ['blue', '§9'], ['green', '§a'],
      ['aqua', '§b'], ['red', '§c'], ['pink', '§d'], ['yellow', '§e'], ['white', '§f'], ['bold', '§l'],
      ['italic', '§o'], ['reset', '§r'],
    ],
  }], C.operators, 'String', 'Minecraft color code'),
];

const F = (name, text) => ({ type: 'field_input', name, text });
const N = (name, value, min = 0) => ({ type: 'field_number', name, value, min, precision: 0.01 });
const ITEM_ID = (text = 'ruby_sword') => F('ID', text);
const EFFECT = { type: 'field_dropdown', name: 'EFFECT', options: EFFECTS };

const filterHat = (type, message, tooltip, colour) => ({
  type,
  message0: message,
  args0: [ITEM_ID('')],
  message1: '%1',
  args1: [{ type: 'input_statement', name: 'DO' }],
  colour,
  hat: 'cap',
  tooltip,
});

const iprop = (type, message, args, tooltip = '') => ({
  type, message0: message, args0: args, colour: C.items, previousStatement: 'ItemProp', nextStatement: 'ItemProp', tooltip,
});

const bprop = (type, message, args, tooltip = '') => ({
  type, message0: message, args0: args, colour: C.blocks, previousStatement: 'BlockProp', nextStatement: 'BlockProp', tooltip,
});

const customDefs = [
  // ---------------- CUSTOM ITEMS ----------------
  {
    type: 'item_define',
    message0: 'custom item %1 named %2',
    args0: [ITEM_ID(), F('NAME', 'Ruby Sword')],
    message1: 'kind %1 tier %2 texture %3',
    args1: [
      {
        type: 'field_dropdown', name: 'KIND', options: [
          ['item', 'item'], ['sword', 'sword'], ['pickaxe', 'pickaxe'], ['axe', 'axe'], ['shovel', 'shovel'], ['hoe', 'hoe'],
          ['helmet', 'helmet'], ['chestplate', 'chestplate'], ['leggings', 'leggings'], ['boots', 'boots'], ['food', 'food'],
        ],
      },
      {
        type: 'field_dropdown', name: 'TIER', options: [
          ['wooden', 'wooden'], ['gold', 'gold'], ['stone', 'stone'], ['copper', 'copper'], ['iron', 'iron'], ['diamond', 'diamond'], ['netherite', 'netherite'],
        ],
      },
      F('TEXTURE', 'diamond_sword'),
    ],
    message2: 'properties %1',
    args2: [{ type: 'input_statement', name: 'PROPS', check: 'ItemProp' }],
    colour: C.items,
    tooltip: 'Registers a custom item. Texture = a vanilla item texture name (diamond_sword, apple, iron_helmet...) unless you ship a resource pack.',
  },
  iprop('iprop_damage', 'attack damage %1', [N('VALUE', 7)]),
  iprop('iprop_durability', 'durability %1', [N('VALUE', 500, 1)]),
  iprop('iprop_stack', 'max stack size %1', [N('VALUE', 64, 1)], 'Simple items only'),
  iprop('iprop_glint', 'enchanted glint %1', [{ type: 'field_dropdown', name: 'VALUE', options: [['on', 'true'], ['off', 'false']] }]),
  iprop('iprop_cooldown', 'cooldown %1 seconds after use', [N('VALUE', 2)], 'Applied when "when a player uses item" runs'),
  iprop('iprop_usable', 'usable with right click (use time %1 s)', [N('VALUE', 0.1)], 'Needed so the client sends a "use" action for a plain item'),
  iprop('iprop_armor', 'armor points %1 toughness %2', [N('POINTS', 3), N('TOUGHNESS', 0)], 'Armor only'),
  iprop('iprop_food', 'food %1 saturation %2 always edible %3', [
    N('NUTRITION', 4), N('SATURATION', 0.6),
    { type: 'field_dropdown', name: 'ALWAYS', options: [['no', 'false'], ['yes', 'true']] },
  ], 'Food only'),
  iprop('iprop_hand_equipped', 'held like a tool %1', [{ type: 'field_dropdown', name: 'VALUE', options: [['yes', 'true'], ['no', 'false']] }]),
  filterHat('evt_item_use', 'when a player uses item %1', 'Right click with the item (empty = any item). Custom items need "usable" or a cooldown.', C.items),
  filterHat('evt_item_hit', 'when a player hits an entity with item %1', 'Empty = any item. Use "target" blocks for the hit entity.', C.items),
  filterHat('evt_item_consume', 'when a player eats item %1', 'Empty = any food', C.items),
  filterHat('evt_item_held', 'when a player switches to item %1', 'Empty = any item', C.items),
  val('item_full_id', 'custom item id %1', [ITEM_ID()], C.items, 'String', 'Full id, e.g. myplugin:ruby_sword - use it with "give"'),
  stmt('item_cooldown_set', 'start cooldown of item %2 for %1 : %3 s', [PLAYER, T('ITEM'), T('SECONDS')], C.items),
  val('item_cooldown_active', 'item %2 is on cooldown for %1', [PLAYER, T('ITEM')], C.items, 'Boolean'),
  val('player_holding', '%1 is holding %2', [PLAYER, T('ITEM')], C.items, 'Boolean'),
  val('player_wearing', '%1 is wearing %2', [PLAYER, T('ITEM')], C.items, 'Boolean'),
  stmt('player_remove_effect', 'remove effect %2 from %1', [PLAYER, EFFECT], C.player),
  val('target_player', 'target as player', [], C.items, 'Player', 'The entity hit, if it is a player'),
  val('target_is_player', 'target is a player', [], C.items, 'Boolean'),
  val('target_name', 'target name', [], C.items, 'String'),
  val('target_health', 'target health', [], C.items, 'Number'),
  stmt('target_set_fire', 'set target on fire for %1 s', [T('SECONDS')], C.items),
  stmt('target_add_effect', 'give effect %1 to target for %2 s level %3', [EFFECT, T('SECONDS'), T('LEVEL')], C.items),
  stmt('target_set_health', 'set target health to %1', [T('VALUE')], C.items),

  // ---------------- CUSTOM BLOCKS ----------------
  {
    type: 'block_define',
    message0: 'custom block %1 named %2 texture %3',
    args0: [F('ID', 'ruby_block'), F('NAME', 'Ruby Block'), F('TEXTURE', 'diamond_block')],
    message1: 'properties %1',
    args1: [{ type: 'input_statement', name: 'PROPS', check: 'BlockProp' }],
    colour: C.blocks,
    tooltip: 'Registers a custom block. Texture = a vanilla block texture name (stone, diamond_block, oak_planks...) unless you ship a resource pack.',
  },
  bprop('bprop_hardness', 'hardness %1 (break time)', [N('VALUE', 3)]),
  bprop('bprop_resistance', 'explosion resistance %1', [N('VALUE', 15)]),
  bprop('bprop_light', 'light emission %1', [N('VALUE', 0)], '0 to 15'),
  bprop('bprop_friction', 'friction %1', [N('VALUE', 0.6)], '0.6 normal, 0.98 ice'),
  bprop('bprop_transparent', 'lets light through %1', [{ type: 'field_dropdown', name: 'VALUE', options: [['no', 'false'], ['yes', 'true']] }]),
  filterHat('evt_block_use', 'when a player clicks block %1', 'Left or right click on a block (empty = any block)', C.blocks),
  val('block_full_id', 'custom block id %1', [F('ID', 'ruby_block')], C.blocks, 'String', 'Full id, e.g. myplugin:ruby_block'),

  // ---------------- PACKETS ----------------
  {
    type: 'evt_packet_receive',
    message0: 'when packet %1 is received from a player',
    args0: [F('TYPE', '')],
    message1: '%1',
    args1: [{ type: 'input_statement', name: 'DO' }],
    colour: C.packets,
    hat: 'cap',
    tooltip: 'Packet class name, e.g. TextPacket, PlayerAuthInputPacket (empty = any packet)',
  },
  {
    type: 'evt_packet_send',
    message0: 'when packet %1 is sent to a player',
    args0: [F('TYPE', '')],
    message1: '%1',
    args1: [{ type: 'input_statement', name: 'DO' }],
    colour: C.packets,
    hat: 'cap',
    tooltip: 'Packet class name, e.g. TextPacket, SetTitlePacket (empty = any packet)',
  },
  val('packet_type', 'packet type', [], C.packets, 'String', 'Class name of the packet of the event'),
  val('packet_get', 'packet field %1', [T('FIELD')], C.packets, null, 'Reads a field of the event packet by name (e.g. message, serverAddress)'),
  stmt('packet_set', 'set packet field %1 to %2', [T('FIELD'), T('VALUE')], C.packets, 'Changes a field of the event packet before it is handled / sent'),
  {
    type: 'packet_send',
    message0: 'send packet %2 to %1',
    args0: [PLAYER, F('TYPE', 'ToastRequestPacket')],
    message1: 'fields %1',
    args1: [{ type: 'input_statement', name: 'FIELDS', check: 'PacketField' }],
    colour: C.packets,
    previousStatement: null,
    nextStatement: null,
    tooltip: 'Creates any Bedrock packet by class name and sends it. Numbers, text, booleans, enums (by name) and vectors ("x y z") are converted automatically.',
  },
  {
    type: 'pfield',
    message0: 'field %1 = %2',
    args0: [F('FIELD', 'title'), T('VALUE')],
    colour: C.packets,
    previousStatement: 'PacketField',
    nextStatement: 'PacketField',
    tooltip: 'Field name as in the packet class (setter name without "set")',
  },
  stmt('packet_transfer', 'transfer %1 to server %2 port %3', [PLAYER, T('ADDRESS'), T('PORT')], C.packets, 'Sends a TransferPacket'),
  stmt('packet_toast', 'show toast %2 %3 to %1', [PLAYER, T('TITLE'), T('CONTENT')], C.packets, 'Sends a ToastRequestPacket'),

  // ---------------- FORMS ----------------
  {
    type: 'form_simple',
    message0: 'show button form to %1 title %2 content %3',
    args0: [PLAYER, T('TITLE'), T('CONTENT')],
    message1: 'buttons %1',
    args1: [{ type: 'input_statement', name: 'ELEMENTS', check: 'FormButton' }],
    message2: 'when a button is clicked %1',
    args2: [{ type: 'input_statement', name: 'ON_SUBMIT' }],
    message3: 'when closed %1',
    args3: [{ type: 'input_statement', name: 'ON_CLOSE' }],
    colour: C.forms,
    previousStatement: null,
    nextStatement: null,
    tooltip: 'A form with a list of buttons. Inside "when a button is clicked", use "clicked button text / number".',
  },
  {
    type: 'fbutton',
    message0: 'button %1 image %2',
    args0: [T('TEXT'), T('IMAGE')],
    colour: C.forms,
    previousStatement: 'FormButton',
    nextStatement: 'FormButton',
    tooltip: 'Image: empty, a URL (https://...) or a resource pack path (textures/items/apple)',
  },
  {
    type: 'form_modal',
    message0: 'show yes/no form to %1 title %2 content %3',
    args0: [PLAYER, T('TITLE'), T('CONTENT')],
    message1: 'yes button %1 no button %2',
    args1: [T('YES'), T('NO')],
    message2: 'when yes %1',
    args2: [{ type: 'input_statement', name: 'ON_YES' }],
    message3: 'when no %1',
    args3: [{ type: 'input_statement', name: 'ON_NO' }],
    colour: C.forms,
    previousStatement: null,
    nextStatement: null,
  },
  {
    type: 'form_custom',
    message0: 'show custom form to %1 title %2',
    args0: [PLAYER, T('TITLE')],
    message1: 'elements %1',
    args1: [{ type: 'input_statement', name: 'ELEMENTS', check: 'FormElement' }],
    message2: 'when submitted %1',
    args2: [{ type: 'input_statement', name: 'ON_SUBMIT' }],
    message3: 'when closed %1',
    args3: [{ type: 'input_statement', name: 'ON_CLOSE' }],
    colour: C.forms,
    previousStatement: null,
    nextStatement: null,
    tooltip: 'A form with inputs, toggles, sliders and dropdowns. Inside "when submitted", use "form value #n" (n = element position, labels included).',
  },
  {
    type: 'fel_label', message0: 'label %1', args0: [T('TEXT')], colour: C.forms, previousStatement: 'FormElement', nextStatement: 'FormElement',
  },
  {
    type: 'fel_header', message0: 'header %1', args0: [T('TEXT')], colour: C.forms, previousStatement: 'FormElement', nextStatement: 'FormElement',
  },
  {
    type: 'fel_divider', message0: 'divider', args0: [], colour: C.forms, previousStatement: 'FormElement', nextStatement: 'FormElement',
  },
  {
    type: 'fel_input', message0: 'text input %1 placeholder %2 default %3', args0: [T('TEXT'), T('PLACEHOLDER'), T('DEFAULT')], colour: C.forms, previousStatement: 'FormElement', nextStatement: 'FormElement',
  },
  {
    type: 'fel_toggle', message0: 'toggle %1 default %2', args0: [T('TEXT'), { type: 'field_dropdown', name: 'DEFAULT', options: [['off', 'false'], ['on', 'true']] }], colour: C.forms, previousStatement: 'FormElement', nextStatement: 'FormElement',
  },
  {
    type: 'fel_slider', message0: 'slider %1 min %2 max %3 step %4 default %5', args0: [T('TEXT'), T('MIN'), T('MAX'), T('STEP'), T('DEFAULT')], colour: C.forms, previousStatement: 'FormElement', nextStatement: 'FormElement',
  },
  {
    type: 'fel_dropdown', message0: 'dropdown %1 options %2 default # %3', args0: [T('TEXT'), T('OPTIONS'), T('DEFAULT')], colour: C.forms, previousStatement: 'FormElement', nextStatement: 'FormElement', tooltip: 'Options separated by commas. Default is 1-based.',
  },
  {
    type: 'fel_stepslider', message0: 'step slider %1 steps %2 default # %3', args0: [T('TEXT'), T('OPTIONS'), T('DEFAULT')], colour: C.forms, previousStatement: 'FormElement', nextStatement: 'FormElement', tooltip: 'Steps separated by commas. Default is 1-based.',
  },
  val('form_button_text', 'clicked button text', [], C.forms, 'String'),
  val('form_button_index', 'clicked button number', [], C.forms, 'Number', '1 for the first button'),
  val('form_value', 'form value # %1', [T('INDEX')], C.forms, null, 'Value of the nth element (1-based): text for inputs/dropdowns/step sliders, number for sliders, true/false for toggles'),
  val('form_value_index', 'form choice number # %1', [T('INDEX')], C.forms, 'Number', 'Selected option number (1-based) of a dropdown or step slider'),
];

Blockly.defineBlocksWithJsonArray([...defs, ...customDefs]);

export const BLOCK_TYPES = [...defs, ...customDefs].map((d) => d.type);
