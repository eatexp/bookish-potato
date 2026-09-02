# Bookish Potato: The First Edition

Searchable name: **Bookish Potato**. Window title, project name, and menus use **Bookish Potato: The First Edition**.

v0.1 is a short classic **turn-based** dungeon crawler for desktop. Grid, fog of war, permadeath, unidentified editions. The library is flavor. The crawl is the product.

**This game does not contain any real-world currency gambling or microtransactions.** There is no real-money purchase of gold, pages, or draws, no item trading, no marketplace, and no cash-out.

Suggested future Steam tags: Roguelike, Traditional Roguelike, Turn-Based, Dungeon Crawler.

## How to run (Godot editor)

1. Install **Godot 4.7.x** (developed on **4.7.2** stable). Compatibility (GL) renderer is selected for broad Windows hardware.
2. Open the folder that contains `project.godot`.
3. Press Play. Main scene: `scenes/boot.tscn`.

Optional sprite/SFX regen (Python 3, Pillow, NumPy):

```bash
python3 tools/gen_assets.py
```

Headless smoke:

```bash
godot --headless --path . -s res://tools/smoke_test.gd
```

## How to export (Windows)

Install 4.7.2 export templates: **Editor → Manage Export Templates**.

Presets in `export_presets.cfg`:

| Preset | Output |
| --- | --- |
| Windows Desktop | `build/windows/BookishPotato.exe` |
| Linux | `build/linux/BookishPotato.x86_64` |
| macOS | `build/macos/BookishPotato.zip` |

```bash
godot --headless --path . --export-release "Windows Desktop" build/windows/BookishPotato.exe
```

Primary target is **Windows**. Desktop only, not HTML5. Do not commit binaries.

Before a public Steam store page: complete the IARC/Steam content survey (Germany hides unrated store pages as of 15 Nov 2024).

## Controls

| Action | Keys |
| --- | --- |
| Move | WASD, arrows, numpad (diagonals 1/3/7/9). Q/E/Z/C also diagonal |
| Wait | `.` or numpad 5 or `X` |
| Inventory | `I` — Equip `E`, Use `U`, Drop `D`, Collate `R`, Crack spine `G` |
| Stairs / exit | Bump the tile, or `,` |
| Pause | `Esc` |
| Mouse | Optional: click a tile to step toward it |

Settings (fullscreen, volumes, key hints) live in `user://settings.cfg`. Graveyard: `user://graveyard.json`.

## How to play (v0.1)

- **Five floors.** Recover the **Notable Folio** on the last floor, then walk the **Binding Exit** in the first chamber. The full First Edition descent is later.
- **Permadeath.** No mid-run save.
- **FOV / fog of war.** Unseen is black; explored is dim memory.
- **Candle** (anti-stall). Floor 1 is lenient. A dead wick deals damage.
- **Gold** and **pages**. Pages are earned in-run only (loot, returns, catalogue slips).

### Unidentified editions

Unread books show a **librarian's tell** (learnable: tight stitching vs vinegar glue).

- **Collate** — safe identify. Costs a turn and candle.
- **Crack the spine** — instant, always a choice. Strong edition (nearby flare) or misfile. **Pity:** you will not take three misfiles in a row from cracking.

### Catalogue (not a machine)

Between some floors, a **Returns Desk** buys unidentified folios for pages and sells nothing.

There you may also **catalogue a shelf you choose**. Three slips are laid out. Spend pages to **lock** a slip or **recatalogue** an unlocked one, then take one. No reels. Nothing spins.

## Steamworks later

Nothing Steam-specific is implemented. `SteamGate` (`scripts/autoload/steam_gate.gd`) no-ops while `APP_ID` is 0.

Still to do: Steamworks partner account, $100 Steam Direct fee, App ID, GodotSteam overlay/achievements, depots, store capsules/screenshots/trailer. Cloud only for graveyard/settings — never a mid-run save.

## License

MIT. See `LICENSE`. Art and audio in `assets/` were generated for this project.
