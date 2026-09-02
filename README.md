# Bookish Potatoe

A classic **turn-based** dungeon crawler for desktop. You are a potato who reads. The dungeon is a library that gambles.

Working title on Steam: **Bookish Potatoe** (the e is intentional). Window title, project name, and menus all use that spelling.

This repository **is** the game. Original pixel art and SFX only. No Steamworks is required to run.

## How to run (Godot editor)

1. Install **Godot 4.7.x** (developed on **4.7.2** stable). The Compatibility (GL) renderer is selected so the 2D game runs on a wide range of Windows machines.
2. Open the project folder (the directory that contains `project.godot`).
3. Press Play. The main scene is `scenes/boot.tscn` → main menu.

Optional: regenerate sprites and WAV files (requires Python 3, Pillow, NumPy):

```bash
python3 tools/gen_assets.py
```

Headless smoke (map connectivity, identify, slots, a short crawl):

```bash
godot --headless --path . -s res://tools/smoke_test.gd
```

## How to export

Export templates for 4.7.2 must be installed once in the editor: **Editor → Manage Export Templates**.

Presets live in `export_presets.cfg`:

| Preset | Output |
| --- | --- |
| Windows Desktop | `build/windows/BookishPotatoe.exe` (x86_64, PCK embedded) |
| Linux | `build/linux/BookishPotatoe.x86_64` |
| macOS | `build/macos/BookishPotatoe.zip` |

From the editor: **Project → Export**, pick a preset, **Export Project**.

CLI example (after templates are installed):

```bash
godot --headless --path . --export-release "Windows Desktop" build/windows/BookishPotatoe.exe
```

Create the `build/...` folders first. Do not commit binaries.

Primary ship target is **Windows**. Linux and macOS presets are included so those builds are one export away. This is a **desktop** game, not HTML5.

## Controls

| Action | Keys |
| --- | --- |
| Move | WASD, arrow keys, numpad (diagonals on 1/3/7/9). Q/E/Z/C also diagonal |
| Wait | `.` or numpad 5 or `X` |
| Inventory | `I` — Equip `E`, Use `U`, Drop `D`, Carefully Read `R`, Gamble-Read `G` |
| Blurb Odds | `B` while standing next to a foe (optional, never forced) |
| Stairs / exit | Bump the tile, or `,` |
| The Stack | Bump the felt desk, or visit the between-chapter room |
| Pause | `Esc` — resume, abandon run, settings, quit to menu |
| Mouse | Optional: click a tile to step toward it |

Settings (fullscreen, master / SFX / music volume, key hints) are stored in `user://settings.cfg`.

## How to play (short)

- **Permadeath.** No mid-run save. Death or victory writes a recap to the local graveyard (`user://graveyard.json`).
- **Ten floors.** Recover **the First Edition** on floor 10, then walk the **Binding Exit** that unseals in that floor’s first chamber.
- **FOV / fog of war.** Unseen tiles are hidden; explored tiles stay as dim memory.
- **Hunger** is **Appetite**. Floor 1 is lenient. Starvation eventually deals damage.
- **Gold** and **pages** are both currencies. Pages are the house’s chips.

### Booky gambling (the hook)

1. **Unidentified folios.** Carefully Read (safe, costs a turn and a little appetite) or **Gamble-Read** (instant: a rare boom — or a curse / explosion / bad folio).
2. **The Stack.** A bookie-librarian nook on some floors and between chapters. Buy/sell books. **Chapter Slots**: three reels (title / chapter / footnote) pay items, gold, pages, or cursed errata.
3. **Blurb Odds.** Optional. Adjacent to a monster, stake pages on the quoted blurb. Killing that foe pays; leaving the floor or dying burns the stake.
4. Recap tracks **biggest gamble won** and **lost**.

Equippable tomes include a burning cookbook, a slowing dictionary, a knocking atlas, confusing errata, and a gold-minting ledger.

## What is left for Steamworks

Nothing Steam-specific is implemented. The game runs offline with local `user://` data only. Structure the later integration as an optional autoload that **must not** be required at boot.

Still to do before a Steam page is real:

1. **Steamworks partner account** and the **$100 Steam Direct fee**.
2. **App ID** — none exists yet. Do not hard-require one in `project.godot`.
3. **GodotSteam** (or equivalent) for overlay, Steam Input, Cloud, achievements. `SteamGate` is already an autoload (`scripts/autoload/steam_gate.gd`) that no-ops while `APP_ID` is 0. Wire the plugin there later so editor and itch builds still run.
4. **Depots** and the Steamworks backend (Windows depot first, then Linux/macOS if you ship them).
5. **Store assets** you still have to make: capsule art, library header, screenshots, trailer, page copy. This repo is the game, not the marketing kit.
6. **Achievements / stats** worth wiring once GodotSteam exists (first escape, first Gamble-Read boom, Chapter Slots jackpot, die to a Page Thief, etc.).
7. **Cloud saves** — only graveyard/settings belong there. Never a mid-run save.

Until then: ship a Windows exe from the export preset, zip it, and play.

## License

MIT. See `LICENSE`. All art and audio in `assets/` were generated for this project (pixel atlas + short WAV). No third-party tilesets, fonts, or commercial samples.

## Layout

```
project.godot          Godot 4.7 project
scenes/                Boot, menu, how-to, game
scripts/               GDScript (autoload simulation + UI)
assets/sprites/        Original 16×16 atlas
assets/audio/          Original SFX + short theme loop
tools/gen_assets.py    Regenerates art/audio
tools/smoke_test.gd    Headless checks
```
