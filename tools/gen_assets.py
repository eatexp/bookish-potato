#!/usr/bin/env python3
"""Generate original pixel art and SFX for Bookish Potatoe. No third-party tilesets."""

from __future__ import annotations

import math
import os
import struct
import wave
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
SPR = ROOT / "assets" / "sprites"
AUD = ROOT / "assets" / "audio"
SPR.mkdir(parents=True, exist_ok=True)
AUD.mkdir(parents=True, exist_ok=True)

TS = 16  # tile size

# Coherent library-dungeon palette
C = {
    "void": (8, 6, 5, 255),
    "bg": (18, 12, 10, 255),
    "wall_d": (42, 32, 26, 255),
    "wall": (61, 48, 40, 255),
    "wall_h": (84, 64, 50, 255),
    "mortar": (28, 20, 16, 255),
    "floor": (36, 28, 20, 255),
    "floor2": (44, 34, 24, 255),
    "floor_lit": (58, 44, 30, 255),
    "speck": (52, 40, 28, 255),
    "wood": (92, 58, 36, 255),
    "wood_d": (58, 36, 22, 255),
    "wood_h": (120, 78, 48, 255),
    "moss": (22, 58, 42, 255),
    "moss_d": (14, 38, 28, 255),
    "moss_h": (36, 88, 58, 255),
    "gold": (212, 160, 24, 255),
    "gold_h": (240, 210, 90, 255),
    "paper": (232, 220, 196, 255),
    "paper_d": (196, 176, 140, 255),
    "ink": (28, 20, 18, 255),
    "lantern": (232, 150, 48, 255),
    "lantern_h": (255, 214, 110, 255),
    "potato": (196, 150, 86, 255),
    "potato_d": (139, 96, 42, 255),
    "potato_h": (232, 196, 130, 255),
    "eye": (28, 22, 16, 255),
    "glass": (40, 48, 56, 255),
    "hp": (176, 52, 42, 255),
    "hp_h": (220, 80, 60, 255),
    "worm": (168, 92, 108, 255),
    "worm_d": (112, 52, 68, 255),
    "blot": (72, 42, 96, 255),
    "blot_h": (110, 70, 140, 255),
    "stone": (118, 122, 128, 255),
    "stone_d": (72, 76, 82, 255),
    "thief": (220, 210, 190, 255),
    "thief_d": (160, 148, 128, 255),
    "green": (90, 150, 70, 255),
    "blue": (70, 110, 170, 255),
    "white": (240, 236, 228, 255),
    "black": (0, 0, 0, 255),
    "trans": (0, 0, 0, 0),
}


def new_img(w, h, fill="trans"):
    im = Image.new("RGBA", (w, h), C[fill] if isinstance(fill, str) else fill)
    return im


def px(im, x, y, col):
    if isinstance(col, str):
        col = C[col]
    if 0 <= x < im.size[0] and 0 <= y < im.size[1]:
        im.putpixel((x, y), col)


def rect(im, x, y, w, h, col):
    for yy in range(y, y + h):
        for xx in range(x, x + w):
            px(im, xx, yy, col)


def ellipse(im, cx, cy, rx, ry, col):
    for yy in range(cy - ry, cy + ry + 1):
        for xx in range(cx - rx, cx + rx + 1):
            dx = (xx - cx) / max(rx, 0.001)
            dy = (yy - cy) / max(ry, 0.001)
            if dx * dx + dy * dy <= 1.05:
                px(im, xx, yy, col)


def paste_tile(atlas: Image.Image, tile: Image.Image, index: int, cols: int = 16):
    x = (index % cols) * TS
    y = (index // cols) * TS
    atlas.paste(tile, (x, y))


def tile_wall() -> Image.Image:
    im = new_img(TS, TS, "wall_d")
    rect(im, 0, 0, 16, 16, "wall")
    for y in (0, 5, 10):
        rect(im, 0, y, 16, 1, "mortar")
    for y, offs in ((1, 0), (6, 8), (11, 4)):
        rect(im, offs, y, 1, 4, "mortar")
        rect(im, offs + 8, y, 1, 4, "mortar")
    rect(im, 0, 0, 16, 1, "wall_h")
    px(im, 3, 2, "wall_h")
    px(im, 12, 7, "wall_h")
    return im


def tile_wall_top() -> Image.Image:
    im = tile_wall()
    rect(im, 0, 0, 16, 3, "wall_h")
    rect(im, 0, 3, 16, 1, "mortar")
    return im


def tile_floor(variant: int = 0) -> Image.Image:
    im = new_img(TS, TS, "floor" if variant == 0 else "floor2")
    if variant == 0:
        px(im, 2, 4, "speck")
        px(im, 11, 9, "speck")
        px(im, 7, 13, "floor2")
    else:
        px(im, 4, 2, "speck")
        px(im, 13, 11, "floor")
        px(im, 1, 14, "speck")
    rect(im, 0, 0, 16, 1, "mortar")
    rect(im, 0, 0, 1, 16, "mortar")
    return im


def tile_floor_lit() -> Image.Image:
    im = new_img(TS, TS, "floor_lit")
    px(im, 3, 5, "lantern")
    px(im, 12, 8, "gold")
    px(im, 8, 12, "speck")
    return im


def tile_door_closed() -> Image.Image:
    im = new_img(TS, TS, "wood_d")
    rect(im, 2, 1, 12, 14, "wood")
    rect(im, 3, 2, 10, 12, "wood_h")
    rect(im, 7, 1, 2, 14, "wood_d")
    px(im, 11, 8, "gold")
    px(im, 12, 8, "gold_h")
    rect(im, 2, 1, 12, 1, "ink")
    return im


def tile_door_open() -> Image.Image:
    im = tile_floor(0)
    rect(im, 0, 1, 3, 14, "wood")
    rect(im, 1, 2, 1, 12, "wood_d")
    return im


def tile_stairs_down() -> Image.Image:
    im = tile_floor(0)
    for i, col in enumerate(["wood_d", "wood", "wood_h", "ink"]):
        rect(im, 3 + i, 3 + i * 2, 10 - i * 2, 2, col)
    return im


def tile_stairs_up() -> Image.Image:
    im = tile_floor(0)
    rect(im, 4, 10, 8, 3, "wood_d")
    rect(im, 5, 6, 6, 4, "wood")
    rect(im, 6, 3, 4, 3, "wood_h")
    px(im, 7, 2, "lantern_h")
    px(im, 8, 2, "lantern")
    return im


def tile_carpet() -> Image.Image:
    im = new_img(TS, TS, "moss")
    for x, y in ((1, 1), (8, 4), (4, 10), (13, 12), (10, 7)):
        px(im, x, y, "moss_d")
    rect(im, 0, 0, 16, 1, "moss_h")
    return im


def tile_desk() -> Image.Image:
    im = tile_carpet()
    rect(im, 1, 6, 14, 8, "wood_d")
    rect(im, 2, 7, 12, 6, "wood")
    rect(im, 4, 8, 5, 4, "paper")
    px(im, 5, 9, "ink")
    px(im, 6, 10, "ink")
    rect(im, 11, 8, 2, 3, "gold")
    return im


def tile_exit() -> Image.Image:
    im = tile_floor_lit()
    ellipse(im, 8, 8, 5, 6, "lantern")
    ellipse(im, 8, 8, 3, 4, "lantern_h")
    ellipse(im, 8, 8, 1, 2, "white")
    return im


def tile_shelf() -> Image.Image:
    im = new_img(TS, TS, "wood_d")
    rect(im, 1, 1, 14, 14, "wood")
    for y in (3, 8, 13):
        rect(im, 2, y, 12, 1, "wood_d")
    for x, col in ((3, "hp"), (6, "blue"), (9, "green"), (12, "gold")):
        rect(im, x, 4, 2, 3, col)
        rect(im, x, 9, 2, 3, "paper")
    return im


def draw_book(im, x, y, col, w=5, h=6):
    rect(im, x, y, w, h, col)
    rect(im, x + 1, y + 1, w - 2, h - 2, "paper")
    px(im, x + 2, y + 2, "ink")
    px(im, x + 2, y + 3, "ink")


def tile_gold() -> Image.Image:
    im = new_img(TS, TS, "trans")
    ellipse(im, 8, 10, 5, 3, "gold")
    ellipse(im, 6, 8, 3, 2, "gold_h")
    px(im, 10, 7, "gold")
    px(im, 8, 6, "gold_h")
    return im


def tile_pages() -> Image.Image:
    im = new_img(TS, TS, "trans")
    rect(im, 4, 5, 8, 7, "paper_d")
    rect(im, 5, 4, 8, 7, "paper")
    px(im, 7, 6, "ink")
    px(im, 8, 7, "ink")
    px(im, 7, 8, "ink")
    return im


def tile_potion() -> Image.Image:
    im = new_img(TS, TS, "trans")
    rect(im, 6, 3, 4, 2, "glass")
    rect(im, 7, 2, 2, 2, "wood")
    ellipse(im, 8, 10, 4, 4, "hp")
    ellipse(im, 8, 10, 3, 3, "hp_h")
    px(im, 6, 8, "white")
    return im


def tile_scroll() -> Image.Image:
    im = new_img(TS, TS, "trans")
    rect(im, 4, 4, 8, 9, "paper")
    rect(im, 4, 4, 8, 1, "paper_d")
    px(im, 6, 7, "ink")
    px(im, 7, 8, "ink")
    px(im, 8, 7, "ink")
    px(im, 6, 9, "ink")
    return im


def tile_first_edition() -> Image.Image:
    im = new_img(TS, TS, "trans")
    rect(im, 3, 3, 10, 11, "gold")
    rect(im, 4, 4, 8, 9, "ink")
    rect(im, 5, 5, 6, 7, "gold_h")
    px(im, 8, 8, "lantern")
    return im


def tile_unid() -> Image.Image:
    im = new_img(TS, TS, "trans")
    draw_book(im, 5, 4, "blue", 6, 8)
    px(im, 7, 7, "gold")
    px(im, 8, 8, "white")
    px(im, 9, 7, "gold")
    return im


def make_tileset() -> Image.Image:
    atlas = new_img(16 * TS, 4 * TS, "void")
    tiles = [
        new_img(TS, TS, "void"),  # 0
        tile_wall(),  # 1
        tile_wall_top(),  # 2
        tile_floor(0),  # 3
        tile_floor(1),  # 4
        tile_floor_lit(),  # 5
        tile_door_closed(),  # 6
        tile_door_open(),  # 7
        tile_stairs_down(),  # 8
        tile_stairs_up(),  # 9
        tile_carpet(),  # 10
        tile_desk(),  # 11
        tile_exit(),  # 12
        tile_shelf(),  # 13
        tile_gold(),  # 14
        tile_pages(),  # 15
        tile_potion(),  # 16
        tile_scroll(),  # 17
        tile_first_edition(),  # 18
        tile_unid(),  # 19
    ]
    for i, t in enumerate(tiles):
        paste_tile(atlas, t, i)
    return atlas


def spr_potato() -> Image.Image:
    im = new_img(TS, TS, "trans")
    ellipse(im, 8, 9, 6, 6, "potato_d")
    ellipse(im, 8, 8, 5, 6, "potato")
    ellipse(im, 7, 7, 3, 3, "potato_h")
    # glasses
    rect(im, 3, 6, 4, 3, "glass")
    rect(im, 9, 6, 4, 3, "glass")
    px(im, 7, 7, "glass")
    px(im, 8, 7, "glass")
    px(im, 4, 7, "eye")
    px(im, 5, 7, "white")
    px(im, 10, 7, "eye")
    px(im, 11, 7, "white")
    # tiny book
    rect(im, 10, 11, 4, 3, "hp")
    rect(im, 11, 12, 2, 1, "paper")
    # sprout
    px(im, 8, 2, "green")
    px(im, 7, 3, "green")
    px(im, 9, 3, "green")
    return im


def spr_potato_hurt() -> Image.Image:
    im = spr_potato()
    px(im, 4, 7, "hp")
    px(im, 10, 7, "hp")
    return im


def spr_bookworm() -> Image.Image:
    im = new_img(TS, TS, "trans")
    ellipse(im, 5, 10, 3, 2, "worm_d")
    ellipse(im, 8, 8, 3, 3, "worm")
    ellipse(im, 11, 6, 3, 3, "worm")
    px(im, 12, 5, "eye")
    px(im, 13, 5, "white")
    px(im, 14, 4, "paper")
    return im


def spr_inkblot() -> Image.Image:
    im = new_img(TS, TS, "trans")
    ellipse(im, 8, 9, 6, 5, "blot")
    ellipse(im, 6, 7, 3, 3, "blot_h")
    px(im, 3, 5, "blot")
    px(im, 12, 4, "blot")
    px(im, 14, 10, "blot")
    px(im, 2, 11, "blot")
    px(im, 6, 8, "white")
    px(im, 7, 8, "eye")
    px(im, 10, 8, "white")
    px(im, 11, 8, "eye")
    return im


def spr_golem() -> Image.Image:
    im = new_img(TS, TS, "trans")
    rect(im, 4, 3, 8, 10, "stone")
    rect(im, 5, 4, 6, 8, "stone_d")
    rect(im, 6, 5, 4, 6, "paper")
    px(im, 7, 7, "ink")
    px(im, 8, 8, "ink")
    rect(im, 3, 12, 3, 3, "stone_d")
    rect(im, 10, 12, 3, 3, "stone_d")
    px(im, 6, 6, "eye")
    px(im, 9, 6, "eye")
    return im


def spr_thief() -> Image.Image:
    im = new_img(TS, TS, "trans")
    rect(im, 5, 3, 6, 8, "thief")
    rect(im, 6, 4, 4, 6, "paper")
    px(im, 7, 6, "eye")
    px(im, 9, 6, "eye")
    rect(im, 4, 11, 3, 4, "thief_d")
    rect(im, 9, 11, 3, 4, "thief_d")
    px(im, 11, 5, "gold")
    px(im, 12, 4, "gold_h")
    return im


def spr_overdue() -> Image.Image:
    im = new_img(TS, TS, "trans")
    rect(im, 3, 2, 10, 12, "paper")
    rect(im, 4, 3, 8, 10, "paper_d")
    rect(im, 5, 6, 6, 4, "hp")
    px(im, 7, 8, "white")
    px(im, 8, 8, "white")
    return im


def spr_errata() -> Image.Image:
    im = new_img(TS, TS, "trans")
    ellipse(im, 8, 8, 5, 5, "paper_d")
    ellipse(im, 8, 8, 4, 4, "paper")
    px(im, 6, 7, "hp")
    px(im, 10, 9, "hp")
    px(im, 8, 6, "ink")
    px(im, 5, 10, "ink")
    px(im, 12, 5, "gold")
    return im


def spr_tome(col_key: str) -> Image.Image:
    im = new_img(TS, TS, "trans")
    draw_book(im, 4, 3, col_key, 8, 11)
    rect(im, 6, 6, 4, 1, "gold")
    return im


def make_entities() -> Image.Image:
    atlas = new_img(16 * TS, 2 * TS, "trans")
    ents = [
        spr_potato(),
        spr_potato_hurt(),
        spr_bookworm(),
        spr_inkblot(),
        spr_golem(),
        spr_thief(),
        spr_overdue(),
        spr_errata(),
        spr_tome("hp"),
        spr_tome("blue"),
        spr_tome("green"),
        spr_tome("gold"),
        spr_tome("ink"),
        tile_potion(),
        tile_unid(),
        tile_first_edition(),
    ]
    for i, t in enumerate(ents):
        paste_tile(atlas, t, i)
    return atlas


def make_icon() -> Image.Image:
    """32x32 source, then scale for Godot icon."""
    src = new_img(32, 32, "bg")
    # lantern glow
    ellipse(src, 16, 18, 14, 14, "wood_d")
    ellipse(src, 16, 17, 12, 13, "potato_d")
    ellipse(src, 16, 16, 11, 12, "potato")
    ellipse(src, 14, 13, 5, 5, "potato_h")
    # glasses
    rect(src, 6, 12, 8, 6, "glass")
    rect(src, 18, 12, 8, 6, "glass")
    rect(src, 14, 14, 4, 2, "glass")
    px(src, 9, 14, "white")
    px(src, 10, 15, "eye")
    px(src, 21, 14, "white")
    px(src, 22, 15, "eye")
    # sprout
    rect(src, 15, 3, 2, 4, "green")
    px(src, 14, 4, "green")
    px(src, 18, 5, "green")
    # book
    rect(src, 20, 20, 9, 8, "hp")
    rect(src, 22, 22, 5, 5, "paper")
    px(src, 23, 24, "ink")
    px(src, 24, 25, "ink")
    # gold corner
    px(src, 3, 28, "gold")
    px(src, 4, 27, "gold_h")
    hi = src.resize((256, 256), Image.NEAREST)
    return hi


def make_portrait() -> Image.Image:
    return make_icon().resize((96, 96), Image.NEAREST)


def make_logo_banner() -> Image.Image:
    im = new_img(320, 64, "bg")
    draw = ImageDraw.Draw(im)
    draw.rectangle([4, 4, 315, 59], outline=C["gold"], width=2)
    potato = spr_potato().resize((48, 48), Image.NEAREST)
    im.paste(potato, (12, 8), potato)
    book = tile_first_edition().resize((32, 32), Image.NEAREST)
    im.paste(book, (276, 16), book)
    # title pixels - simple block letters BOOKISH POTATOE
    return im


def write_wav(path: Path, samples: np.ndarray, rate: int = 22050):
    samples = np.clip(samples, -1.0, 1.0)
    data = (samples * 32767).astype(np.int16)
    with wave.open(str(path), "w") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(rate)
        w.writeframes(data.tobytes())


def env(n, a=0.01, d=0.08):
    e = np.zeros(n)
    ai = max(1, int(n * a))
    di = max(1, int(n * d))
    e[:ai] = np.linspace(0, 1, ai)
    e[ai:] = np.linspace(1, 0, n - ai)
    if di < n:
        e[-di:] *= np.linspace(1, 0, di)
    return e


def tone(freq, dur, rate=22050, wave="square", vol=0.35):
    n = int(rate * dur)
    t = np.arange(n) / rate
    if wave == "square":
        s = np.sign(np.sin(2 * math.pi * freq * t) + 1e-9)
    elif wave == "tri":
        s = 2 * np.abs(2 * ((t * freq) % 1) - 1) - 1
    else:
        s = np.sin(2 * math.pi * freq * t)
    return s * vol * env(n)


def noise(dur, rate=22050, vol=0.2):
    n = int(rate * dur)
    s = np.random.default_rng(7).uniform(-1, 1, n) * vol
    return s * env(n, 0.005, 0.3)


def mix(parts, rate=22050):
    m = 0
    for p in parts:
        m = max(m, len(p))
    out = np.zeros(m)
    for p in parts:
        out[: len(p)] += p
    return out


def gen_sfx():
    write_wav(AUD / "hit.wav", mix([tone(140, 0.08, wave="square", vol=0.4), noise(0.06, vol=0.15)]))
    write_wav(AUD / "miss.wav", tone(420, 0.07, wave="tri", vol=0.22))
    write_wav(
        AUD / "pickup.wav",
        mix(
            [
                np.concatenate([tone(520, 0.06, wave="tri", vol=0.28), tone(740, 0.08, wave="tri", vol=0.28)])
            ]
        ),
    )
    write_wav(
        AUD / "stairs.wav",
        mix(
            [
                np.concatenate(
                    [
                        tone(330, 0.09, wave="square", vol=0.22),
                        tone(262, 0.09, wave="square", vol=0.22),
                        tone(196, 0.12, wave="square", vol=0.22),
                    ]
                )
            ]
        ),
    )
    write_wav(
        AUD / "death.wav",
        mix(
            [
                np.concatenate(
                    [
                        tone(220, 0.15, wave="square", vol=0.3),
                        tone(165, 0.18, wave="square", vol=0.28),
                        tone(110, 0.28, wave="square", vol=0.25),
                    ]
                ),
                noise(0.4, vol=0.12),
            ]
        ),
    )
    write_wav(AUD / "page.wav", mix([noise(0.09, vol=0.18), tone(1800, 0.04, wave="tri", vol=0.08)]))
    write_wav(
        AUD / "curse.wav",
        mix([tone(155, 0.2, wave="square", vol=0.28), tone(164, 0.2, wave="square", vol=0.22)]),
    )
    write_wav(
        AUD / "identify.wav",
        mix(
            [
                np.concatenate(
                    [
                        tone(392, 0.08, wave="tri", vol=0.24),
                        tone(523, 0.1, wave="tri", vol=0.24),
                    ]
                )
            ]
        ),
    )
    write_wav(
        AUD / "win.wav",
        mix(
            [
                np.concatenate(
                    [
                        tone(262, 0.1, wave="tri", vol=0.25),
                        tone(330, 0.1, wave="tri", vol=0.25),
                        tone(392, 0.1, wave="tri", vol=0.25),
                        tone(523, 0.22, wave="tri", vol=0.28),
                    ]
                )
            ]
        ),
    )
    write_wav(
        AUD / "boom.wav",
        mix(
            [
                tone(880, 0.06, wave="tri", vol=0.2),
                tone(1320, 0.08, wave="tri", vol=0.16),
                noise(0.1, vol=0.1),
            ]
        ),
    )
    write_wav(AUD / "potion.wav", mix([tone(300, 0.08, wave="sine", vol=0.2), tone(200, 0.1, wave="sine", vol=0.18)]))
    write_wav(AUD / "ui.wav", tone(660, 0.04, wave="tri", vol=0.14))
    write_wav(AUD / "open.wav", tone(196, 0.1, wave="square", vol=0.2))

    # Short original library ostinato (~6s), D dorian, triangle + quiet pulse.
    rate = 22050
    bpm = 100
    beat = 60 / bpm
    notes = [
        (146.83, 1),
        (174.61, 1),
        (196.00, 1),
        (220.00, 1),
        (196.00, 1),
        (174.61, 1),
        (164.81, 1),
        (146.83, 1),
        (174.61, 1),
        (196.00, 0.5),
        (220.00, 0.5),
        (246.94, 1),
        (220.00, 1),
        (196.00, 1),
        (174.61, 1),
        (146.83, 2),
    ]
    melody = []
    for f, beats in notes:
        melody.append(tone(f, beat * beats, rate, "tri", 0.16))
        melody.append(tone(f * 2, beat * beats, rate, "sine", 0.05))
    # stitch
    total = sum(len(tone(n[0], beat * n[1], rate, "tri", 0.16)) for n in notes)
    out = np.zeros(total)
    pos = 0
    for f, beats in notes:
        a = tone(f, beat * beats, rate, "tri", 0.18)
        b = tone(f * 1.5, beat * beats, rate, "sine", 0.04)
        chunk = np.zeros(len(a))
        chunk += a
        chunk[: len(b)] += b[: len(a)]
        out[pos : pos + len(chunk)] += chunk
        pos += len(a)
    # soft drum-like paper thump on beats
    rng = np.random.default_rng(3)
    pos = 0
    step = int(rate * beat)
    while pos < len(out):
        n = min(int(rate * 0.04), len(out) - pos)
        thump = rng.uniform(-1, 1, n) * 0.04 * env(n, 0.01, 0.8)
        out[pos : pos + n] += thump
        pos += step * 2
    write_wav(AUD / "theme.wav", out * 0.7)


def main():
    tiles = make_tileset()
    tiles.save(SPR / "tiles.png")
    ents = make_entities()
    ents.save(SPR / "entities.png")
    icon = make_icon()
    icon.save(ROOT / "icon.png")
    icon.save(SPR / "icon_256.png")
    make_portrait().save(SPR / "portrait.png")
    make_logo_banner().save(SPR / "banner.png")
    # 16x16 window icon variant
    spr_potato().resize((16, 16), Image.NEAREST).save(SPR / "icon_16.png")
    gen_sfx()
    print("Wrote sprites to", SPR)
    print("Wrote audio to", AUD)


if __name__ == "__main__":
    main()
