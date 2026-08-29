# PowerScratchedX

Build [PowerNukkitX](https://github.com/PowerNukkitX/PowerNukkitX) plugins with Scratch-style blocks, straight from the browser, and download a ready-to-use `.jar`.

<p align="center">
  <a href="https://naysurgithub.github.io/">
    <img src="https://img.shields.io/badge/%E2%96%B6%20TRY%20IT-naysurgithub.github.io-4c97ff?style=for-the-badge&labelColor=ff8c1a" alt="Try it" height="48">
  </a>
</p>

- **Website** (`website/`): Vite + [Blockly](https://developers.google.com/blockly) editor with a Scratch-like toolbox (events, player, server, commands, config, control, time, operators, variables). The editor turns blocks into real Java source in your browser.
- **Backend** (`backend/`): a small Java 21 HTTP server that compiles the generated source against the PowerNukkitX jar (in-process `javac`) and returns the plugin jar.

## Features

- Events: plugin start/stop, join, quit, chat, command, block break/place, interact, death, respawn, damage, move - with `cancel event`, message/damage accessors and setters.
- Player actions: messages, titles, action bar, teleport, give item, kick, gamemode, health, food, effects, fire, xp, run command, op, sounds, display name - plus reporters (name, health, coords, world, permission checks...).
- Server: broadcast, console commands, logging, loop over online players, set/get blocks, world time, sounds.
- Custom items: plain items, swords, pickaxes, axes, shovels, hoes, armor pieces and food with tier, texture, damage, durability, glint, cooldown, armor points, nutrition - plus events for using, hitting with, eating or switching to an item, cooldown blocks and "target" blocks for the entity hit.
- Custom blocks with hardness, resistance, light, friction and a click event.
- A resource pack (`.mcpack`) is generated alongside the JAR when the plugin has custom items or blocks, mapping them to the chosen textures; drop it in the server's `resource_packs/` folder.
- Custom commands with description and permission, sender/argument reporters, permission declarations (`plugin.yml`).
- Config: default values (`config.yml`), get/set/has/reload.
- Time: repeating tasks (`every N ticks`) and delayed tasks (`wait N ticks then`).
- Control & operators: if/else, repeat, while/until, math, comparison, logic, text, Minecraft color codes, variables.
- Plugin metadata (name, version, author, description) in the top bar; projects autosave in the browser and can be exported/imported as `.psx.json`.
- "Java" panel shows the generated source live; build errors are reported with line numbers.

## Quick start

### 1. Backend

Requirements: JDK 21+ (a JDK, not a JRE - the server needs `javac`), a PowerNukkitX jar.

```bash
cd backend
# put the server jar in lib/powernukkitx.jar, or set PNX_JAR=/path/to/powernukkitx.jar
./gradlew run
```

The API listens on `http://localhost:8080`.

| Variable / flag              | Default                 | Purpose                                     |
|------------------------------|-------------------------|---------------------------------------------|
| `PORT` / `--port`            | `8080`                  | HTTP port                                   |
| `PNX_JAR` / `--pnx-jar`      | `lib/powernukkitx.jar`  | PowerNukkitX jar used as compile classpath  |
| `STATIC_DIR` / `--static`    | `../website/dist` if it exists | Serve the built website from the backend |
| `WORK_DIR` / `--work`        | `work`                  | Temporary build directory                   |
| `MAX_CONCURRENT_BUILDS`      | `2`                     | Parallel compilations                       |
| `MAX_SOURCE_BYTES`           | `524288`                | Max project size per build                  |
| `BUILDS_PER_MINUTE`          | `10`                    | Per-IP rate limit                           |
| `ALLOWED_ORIGIN`             | `*`                     | CORS origin                                 |

Endpoints:

- `GET /api/health` → `{ ok, pnxJar, javaVersion }`
- `POST /api/build` with `{ name, version, main, files: { "plugin.yml": "...", "src/.../Main.java": "..." } }` → the jar (`application/java-archive`), or `422` with `{ errors: [{ line, message }] }` on compile errors.

### 2. Website

Requirements: Node 20+.

```bash
cd website
npm install
npm run dev        # http://localhost:5173, /api is proxied to the backend
npm run build      # static site in website/dist (served by the backend if present)
```

Set `VITE_API_URL` (see `website/.env.example`) if the backend is hosted elsewhere.

### Headless generation

```bash
cd website
npm run gen -- my-project.psx.json --out ./out --build http://localhost:8080
```

Prints/writes the generated Java and optionally asks the backend to build the jar. Without arguments it uses the bundled starter project.

## Production

1. `cd website && npm run build`
2. `cd backend && ./gradlew jar` → `backend/build/libs/powerscratchedx-backend.jar`
3. `PNX_JAR=/srv/powernukkitx.jar STATIC_DIR=/srv/website/dist java -jar powerscratchedx-backend.jar`

The backend compiles user-provided source: run it in a container or a dedicated user, keep the rate limits, and put it behind a reverse proxy with TLS.

## How the generated plugin works

Every script (hat block) becomes a method receiving a `Ctx` object (player, sender, args, event, message, block, item, damage). Loops over players and delayed tasks copy that context, so `player` always means the right player. All values are dynamically typed like Scratch (`num`, `str`, `bool` helpers), and every player action is null-safe.

```
plugin.yml           name, main, version, api, commands, permissions
config.yml           generated from "config: key defaults to value" blocks
src/psx/<name>/Main.java
```

## Repository layout

```
website/   Vite app (src/blocks, src/generator/java.js, src/toolbox.js, src/examples)
backend/   Gradle project (io.powerscratchedx.backend)
docs/      Additional documentation
```

## Disclaimer

PowerScratchedX is an independent community project. It is not affiliated with, endorsed by, or maintained by the PowerNukkitX team.

## License

MIT - see [LICENSE](LICENSE).
