extends Node2D

const TS := 16
const SCALE := 3
const S := TS * SCALE

var tiles_tex: Texture2D
var ents_tex: Texture2D


func _ready() -> void:
	tiles_tex = load("res://assets/sprites/tiles.png")
	ents_tex = load("res://assets/sprites/entities.png")
	z_index = 0


func world_size() -> Vector2:
	return Vector2(Catalog.MAP_W * S, Catalog.MAP_H * S)


func tile_to_world(x: int, y: int) -> Vector2:
	return Vector2(x * S + S * 0.5, y * S + S * 0.5)


func world_to_tile(p: Vector2) -> Vector2i:
	return Vector2i(int(floor(p.x / float(S))), int(floor(p.y / float(S))))


func _process(_dt: float) -> void:
	queue_redraw()


func _draw() -> void:
	if Game.tiles.is_empty() or Game.player.is_empty():
		return
	var px: int = Game.player.x
	var py: int = Game.player.y
	for y in Catalog.MAP_H:
		for x in Catalog.MAP_W:
			if not Game.tile_seen(x, y):
				continue
			var t: int = int(Game.tiles[y][x])
			var v: int = 0
			if Game.variant.size() > y and (Game.variant[y] as Array).size() > x:
				v = int(Game.variant[y][x])
			var idx := Catalog.tile_atlas(t, v)
			if t == Catalog.Tile.FLOOR and Game.tile_vis(x, y):
				var d0 := Game.chebyshev(x, y, px, py)
				if d0 <= 2:
					idx = 5
			var dest := Rect2(x * S, y * S, S, S)
			var col := _modulate_for(x, y, px, py)
			_blit(tiles_tex, idx, dest, col)
			# items
			var pos := Vector2i(x, y)
			if Game.items_at.has(pos) and (Game.items_at[pos] as Array).size() > 0:
				var it: Dictionary = (Game.items_at[pos] as Array)[0]
				var iidx := _item_atlas(it)
				_blit(tiles_tex, iidx, dest, col)
	# entities
	for e in Game.entities:
		if int(e.hp) <= 0:
			continue
		if not Game.tile_vis(int(e.x), int(e.y)):
			continue
		var dest2 := Rect2(int(e.x) * S, int(e.y) * S, S, S)
		var col2 := _modulate_for(int(e.x), int(e.y), px, py)
		_blit(ents_tex, int(e.sprite), dest2, col2)
		# hp pip
		var ratio := clampf(float(e.hp) / maxf(1.0, float(e.hp_max)), 0.0, 1.0)
		draw_rect(Rect2(int(e.x) * S + 6, int(e.y) * S + 2, int((S - 12) * ratio), 3), Color(0.75, 0.2, 0.18))
		if int(e.get("bet_stake", 0)) > 0:
			draw_rect(Rect2(int(e.x) * S + 2, int(e.y) * S + S - 6, 6, 4), Color(0.9, 0.78, 0.35))
	# player
	var pdest := Rect2(px * S, py * S, S, S)
	var psprite := 0 if int(Game.player.hp) > int(Game.player.hp_max) / 3 else 1
	_blit(ents_tex, psprite, pdest, Color(1.1, 1.0, 0.9))
	# lantern ring hint
	var r := (Catalog.FOV_R * S)
	draw_arc(Vector2(px * S + S * 0.5, py * S + S * 0.5), r * 0.15, 0, TAU, 24, Color(1, 0.75, 0.3, 0.07), 8)


func _modulate_for(x: int, y: int, px: int, py: int) -> Color:
	if not Game.tile_vis(x, y):
		return Color(0.34, 0.30, 0.36, 1.0)
	var d := float(Game.chebyshev(x, y, px, py))
	var warm := clampf(1.0 - d / 8.0, 0.28, 1.0)
	return Color(0.55 + 0.45 * warm, 0.48 + 0.40 * warm, 0.32 + 0.28 * warm, 1.0)


func _item_atlas(it: Dictionary) -> int:
	var k := str(it.get("kind", ""))
	match k:
		"gold_pile":
			return 14
		"pages_pile":
			return 15
		"potion":
			return 16
		"scroll":
			return 17
		"first":
			return 18
		"unid":
			return 19
		"tome", "binding":
			return 19
	return 19


func _blit(tex: Texture2D, idx: int, dest: Rect2, col: Color) -> void:
	if tex == null:
		draw_rect(dest, col)
		return
	var sx := (idx % 16) * TS
	var sy := int(idx / 16) * TS
	draw_texture_rect_region(tex, dest, Rect2(sx, sy, TS, TS), col)
