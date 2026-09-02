# Bookish Potato: The First Edition

Window title, project name, and menus use **Bookish Potato: The First Edition**. The potato is the sprite you steer, not the marketing noun.

v0.1 is a short **bullet heaven** for desktop: one library floor (The Stacks), WASD, tomes that auto-fire, a timed horde of overdue patrons. This is not a deckbuilder and not a dungeon crawler.

**This game does not contain any real-world currency gambling or microtransactions.** There is no real-money purchase of gold, pages, or folios, no item trading, no marketplace, and no cash-out.

Suggested Steam tags, in order: **Bullet Heaven**, Action Roguelike, Roguelite, Survival, 2D. Do not lead with Bullet Hell. Do not tag Gambling, Casino, Cute, or Meme.

Price intent (not a store listing): **$5.99 / £4.99**.

Before a public Steam store page: complete the IARC/Steam content survey (Germany hides unrated store pages as of 15 Nov 2024).

## How to run (Godot editor)

1. Install **Godot 4.7.x** (developed on **4.7.2** stable). Compatibility (GL) renderer.
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

Primary target is **Windows**. Desktop only. Do not commit binaries.

## Controls

| Action | Keys |
| --- | --- |
| Move | WASD or arrows (facing follows movement) |
| Fire | Automatic — Primer fires on spawn |
| Level-up | Click a folio card, or `1` / `2` / `3` |
| Floor folio | **Collate** (safe) or **Crack** (swingy; book opens) |
| Pause | `Esc` |

Settings: `user://settings.cfg`. Graveyard: `user://graveyard.json`. Pages and next-run folios: `user://meta.cfg`.

## How to play (v0.1)

- **The Stacks.** One floor. Aisles are lanes and cover. Survive ~12 minutes. Closing Time brings the Fine Collector, then the run ends on survive or death.
- **Permadeath of the run.** No mid-run save.
- **Five tomes** (max in a run): Primer (start; glyphs / paper darts), Cookbook (close cones / nova), Atlas (orbiting pages), Dictionary (slow pulse: define; not first offer), Gazette (hail of clippings that shove).
- **Folio identities** include those five, plus Bookplate (magnet), Colophon (fire rate), Dust jacket (armor), Overdue stamp (damage up), Errata (hurtless misfire), Misfile (wrong-tome hiccup).
- **Level-up** pauses. Three folio cards. One click. Lock is a toggle on the card. Errata and Misfile never sit on that row.
- **Floor folios:** Collate or Crack. Crack VFX is a book opening. Curses only from Crack, and they come with extra pages.
- **One enemy family:** overdue patrons — hunched readers and stamped date cards. Variants are faster, tankier, or burst into pages. Not a zoo.
- **Returns Desk** after the run only. Acquire unidentified folios. Stamp with **pages**. Nothing is for sale. At most three stamps.

`SteamGate` no-ops while `APP_ID` is 0.

## License

MIT. See `LICENSE`. Art and audio in `assets/` were generated for this project.
