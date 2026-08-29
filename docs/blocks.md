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

Reporters: `player`, `player named`, `name`, `health`, `food`, `x/y/z`, `world`, `gamemode`, `item in hand`, `item in offhand`, `has permission`, `is operator`, `is online`, `is sneaking`. Hands: `swap main hand and offhand`, `set main/off hand item to`.

### Server
`broadcast`, `run console command`, `log to console`, `for each online player`, `online player count/names`, `set block`, `block id at`, `set world time`, `play sound at`, `current world name`.

### Commands
`when command /name is run` (description + permission → `plugin.yml`), `reply to sender`, `sender name`, `sender is a player`, `argument #n`, `argument count`, `all arguments`, `permission ... default ...` (declares a permission in `plugin.yml`).

### Custom Items
`custom item <id> named <name> · kind · tier · texture` registers a new item. Kinds: plain item, sword, pickaxe, axe, shovel, hoe, helmet, chestplate, leggings, boots, food. The tier sets default durability, attack damage and armor points (override them with properties). The full id becomes `<pluginname>:<id>`; short ids work everywhere (`give`, filters) as long as they are unique.

Properties (snap inside the definition): `attack damage`, `durability`, `max stack size`, `enchanted glint`, `cooldown N seconds after use`, `usable with right click`, `armor points / toughness`, `food / saturation / always edible`, `held like a tool`.

Events: `when a player uses item` (right click; empty id = any item), `when a player hits an entity with item`, `when a player eats item`, `when a player switches to item`.

Other blocks: `custom item id` (full id reporter), `start cooldown of item … for player`, `item … is on cooldown`, `player is holding …`, `player is wearing …`, `remove effect`, and the `target` blocks for the entity hit (`target as player`, `target is a player`, `target name/health`, `set target on fire`, `give effect to target`, `set target health`).

Textures: the `texture` field is a vanilla texture name (`diamond_sword`, `apple`, `iron_helmet`, `blaze_rod`…) or a full path (`textures/items/my_sword`). When a plugin has custom items or blocks, the build also produces a **resource pack** (`<Plugin>-<version>.mcpack`) that maps each custom item/block to that texture. Drop it in the server's `resource_packs/` folder: the server sends it to players on join, and the icons appear. Without the pack the client shows an empty icon.

Cooldowns: a cooldown property is enforced automatically by `when a player uses item` (the script is skipped while the item is cooling down) and shown on the client's hotbar.

### Custom Blocks
`custom block <id> named <name> texture <name>` with properties `hardness`, `explosion resistance`, `light emission`, `friction`, `lets light through`. `when a player clicks block <id>` runs on left/right click (empty = any block). `custom block id` gives the full id for `set block` / `give`. Block textures use vanilla terrain texture names (`stone`, `diamond_block`, `oak_planks`…) or a full path; they are mapped in the generated resource pack too.

### Packets
Low-level access to the Bedrock protocol (Cloudburst packet classes, e.g. `TextPacket`, `SetTitlePacket`, `PlayerAuthInputPacket`, `TransferPacket`).

- `when packet <Type> is received from a player` / `when packet <Type> is sent to a player` (empty type = every packet; the `Packet` suffix is optional). Use `cancel event` to drop the packet.
- `packet type` (class name), `packet field <name>` (reads a getter by name: `message`, `serverAddress`, `position`...), `set packet field <name> to <value>` (calls the setter before the packet is handled or sent).
- `send packet <Type> to player` with a list of `field <name> = <value>` blocks: creates the packet by class name, fills the fields and sends it. Values are converted to the setter's type: numbers, text, booleans, enums (by name or index) and vectors (`"x y z"`).
- Shortcuts: `transfer player to server <address> port <port>` (TransferPacket) and `show toast <title> <content>` (ToastRequestPacket).

Field names are the Lombok property names of the packet class (the setter without `set`, case-insensitive). Complex fields (lists, NBT, custom objects) cannot be set from blocks.

### Forms
Bedrock UI forms, with the response scripts directly inside the block:

- `show button form to player title … content …` with `button <text> image <url or pack path>` blocks; `when a button is clicked` runs with `clicked button text` / `clicked button number` (1-based); `when closed` runs when the player dismisses the form.
- `show yes/no form` with custom button labels and `when yes` / `when no` scripts.
- `show custom form` with elements `label`, `header`, `divider`, `text input`, `toggle`, `slider`, `dropdown` (comma-separated options), `step slider`; `when submitted` runs with `form value #n` (text of inputs/dropdowns/step sliders, number for sliders, true/false for toggles) and `form choice number #n` (selected option, 1-based). `n` is the element position, labels/headers/dividers included.

Inside the response scripts, `player` is the player who answered, and everything from the surrounding context (command sender, arguments, event) is still available.

### Web
- `GET/POST/PUT/DELETE/PATCH request to <url>` with `body` and `headers` (one `Name: value` per line) and a nested `when the response arrives` script. The request runs in the background and the script runs back on the main thread with `response status` (0 if the request failed), `response body` and `response is OK`. A body starting with `{` or `[` is sent as `application/json`.
- `json <path> of <text>`: reads a value from JSON with a dotted path (`data.name`, `items.0.id`; empty path = whole value). `json length of` counts array items or object keys. `json text` escapes text for a JSON body. `url encode` escapes text for a URL.
- `send <text> to Discord webhook <url>` posts a message to a Discord webhook.

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

### Lists
Named lists (`add … to list <name>`, `remove … from list`, `remove item #`, `replace item #`, `clear list`, `list contains`, `length of list`, `item #`, `position of`, `list joined with`, `for each item in list` + `current list item`). Lists are global, case-insensitive by name, and saved automatically in the plugin's data folder (`lists.json`), so they survive restarts.

### Player data
Key/value storage per player, kept across reconnects and restarts (`players.json`): `set data <key> of player to`, `change data … by`, `remove data`, `clear all data`, `data <key> of player`, `player has data <key>`, plus `set/get data of player named <name>` for offline players. Values can be text, numbers or booleans.

## Item and block ids

Use Bedrock identifiers, e.g. `minecraft:diamond`, `minecraft:stone`. The `minecraft:` prefix is added automatically when missing.
