# Bookish Potato: The First Edition

Searchable name: **Bookish Potato**. Window title, project name, and menus use **Bookish Potato: The First Edition**.

v0.1 is a short **bullet-heaven / survivor-like** for desktop: one library floor, WASD, tomes that auto-fire, a timed horde of booklice. The library is the stage. The potato is the protagonist, not the marketing gag. This is not a deckbuilder and not a dungeon crawler.

**This game does not contain any real-world currency gambling or microtransactions.** There is no real-money purchase of gold, pages, or folios, no item trading, no marketplace, and no cash-out.

Suggested Steam tags: **Bullet Heaven**, **Action Roguelike**, **Roguelite**, **Survival**, **2D**. Do not lead with Bullet Hell. Do not tag Gambling, Casino, Cute, or Meme.

Price intent (not a store listing): **$5.99 / £4.99**.

Before a public Steam store page: complete the IARC/Steam content survey (Germany hides unrated store pages as of 15 Nov 2024).

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

## Controls

| Action | Keys |
| --- | --- |
| Move | WASD or arrows (facing follows movement) |
| Fire | Automatic — equipped tomes |
| Level-up | Click a folio card, or `1` / `2` / `3` |
| Floor folio | **Collate** (safe) or **Crack** (swingy) |
| Pause | `Esc` |

Settings live in `user://settings.cfg`. Graveyard: `user://graveyard.json`. Banked pages and next-run folios: `user://meta.cfg`.

## How to play (v0.1)

- **One floor.** Shelves are lanes and cover. Survive the hour (~12 minutes). Closing time is a brood surge.
- **Permadeath of the run.** No mid-run save.
- **Level-up** pauses the world. Three unidentified folio cards. One click slams a tome onto the shelf. **Shelve** / **stamp** are toggles on the card, not a filing minigame.
- **Floor folios:** Collate or Crack. The book opens (cover, crack, page flutter). Collate is always available.
- **Returns Desk** is after the run only. Pages buy unidentified folios for the **next** run. Sells nothing. No wave shop.
- **Six tomes** on the lectern at most. Ten folio identities in the whole slice.
- **Gold** and **pages** are in-run. Pages bank between runs only to stamp next-run folios.

## Steamworks later

Nothing Steam-specific is implemented. `SteamGate` (`scripts/autoload/steam_gate.gd`) no-ops while `APP_ID` is 0.

Still to do: Steamworks partner account, $100 Steam Direct fee, App ID, GodotSteam overlay/achievements, depots, store capsules/screenshots/trailer. Cloud only for graveyard/settings/meta — never a mid-run save.

## License

MIT. See `LICENSE`. Art and audio in `assets/` were generated for this project.
