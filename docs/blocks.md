# Block reference

Every hat block (rounded top) starts a script. Blocks inside run in order. Reporter blocks (rounded) produce values; boolean blocks (hexagonal) produce true/false.

## Context

Scripts run with a context (`Ctx` in the generated Java):

| Value            | Set by                                                     |
|------------------|------------------------------------------------------------|
| `player`         | Player events, commands run by a player, "for each player" |
| `sender`, `args` | Commands                                                   |
| `event`          | Event hats (used by "cancel event" and message setters)    |
| `message`        | Chat / command events                                      |
| `block`, `item`  | Block break/place, interact                                |
| `damage`         | Damage event                                               |

Blocks that need a value the context does not have fall back to a neutral default (empty text, `0`, no-op), so a script never crashes because of a missing player.

## Categories

### Events
`when plugin starts/stops`, `when a player joins/leaves/chats/runs a command`, `when a player breaks/places a block`, `when a player interacts`, `when a player dies/respawns/takes damage/moves`, `cancel event`, `event message`, `set chat message`, `set join/quit/death message`, `event block id / x y z`, `event item id`, `event damage`, `set event damage`.

### Player
Actions: `send`, `show title`, `show action bar/popup/tip`, `teleport to x y z / to player / to spawn`, `give item`, `clear inventory`, `kick`, `set gamemode`, `set health`, `set food`, `give effect`, `clear effects`, `set on fire`, `give xp`, `make run command`, `make/remove operator`, `play sound`, `set display name`.

Reporters: `player`, `player named`, `name`, `health`, `food`, `x/y/z`, `world`, `gamemode`, `item in hand`, `has permission`, `is operator`, `is online`, `is sneaking`.

### Server
`broadcast`, `run console command`, `log to console`, `for each online player`, `online player count/names`, `set block`, `block id at`, `set world time`, `play sound at`, `current world name`.

### Commands
`when command /name is run` (description + permission → `plugin.yml`), `reply to sender`, `sender name`, `sender is a player`, `argument #n`, `argument count`, `all arguments`, `permission ... default ...` (declares a permission in `plugin.yml`).

### Custom Items
`custom item <id> named <name> · kind · tier · texture` registers a new item. Kinds: plain item, sword, pickaxe, axe, shovel, hoe, helmet, chestplate, leggings, boots, food. The tier sets default durability, attack damage and armor points (override them with properties). The full id becomes `<pluginname>:<id>`; short ids work everywhere (`give`, filters) as long as they are unique.

Properties (snap inside the definition): `attack damage`, `durability`, `max stack size`, `enchanted glint`, `cooldown N seconds after use`, `usable with right click`, `armor points / toughness`, `food / saturation / always edible`, `held like a tool`.

Events: `when a player uses item` (right click; empty id = any item), `when a player hits an entity with item`, `when a player eats item`, `when a player switches to item`.

Other blocks: `custom item id` (full id reporter), `start cooldown of item … for player`, `item … is on cooldown`, `player is holding …`, `player is wearing …`, `remove effect`, and the `target` blocks for the entity hit (`target as player`, `target is a player`, `target name/health`, `set target on fire`, `give effect to target`, `set target health`).

Textures: the `texture` field is a texture *name*. Vanilla names (`diamond_sword`, `apple`, `iron_helmet`, `blaze_rod`…) display without any client download. For your own textures, ship a resource pack that defines that name in `item_texture.json`.

Cooldowns: a cooldown property is enforced automatically by `when a player uses item` (the script is skipped while the item is cooling down) and shown on the client's hotbar.

### Custom Blocks
`custom block <id> named <name> texture <name>` with properties `hardness`, `explosion resistance`, `light emission`, `friction`, `lets light through`. `when a player clicks block <id>` runs on left/right click (empty = any block). `custom block id` gives the full id for `set block` / `give`. Block textures use vanilla terrain texture names (`stone`, `diamond_block`, `oak_planks`…) unless you ship a resource pack.

### Config
`config: key defaults to value` (writes `config.yml`, saved on first run), `config key`, `set config key to`, `config has key`, `reload config`.

### Control
`if`, `if/else`, `repeat n`, `repeat while/until`, `stop this script`.

### Time
`every N ticks` (repeating task registered on enable), `wait N ticks then` (delayed task, does not block the server), `server time (ms)`.

### Operators
Numbers, arithmetic, modulo, random, round, `number of`, comparisons, and/or/not, booleans, text, join, length, contains, starts with, replace, `color` (Minecraft § codes).

### Variables
Global variables shared by all scripts (like Scratch "for all sprites"). They hold numbers, text or booleans.

## Item and block ids

Use Bedrock identifiers, e.g. `minecraft:diamond`, `minecraft:stone`. The `minecraft:` prefix is added automatically when missing.
