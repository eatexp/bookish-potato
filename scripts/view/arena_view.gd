extends Node2D

## One library floor. Shelves as lanes. Potato small in the frame.

const TS := 16
const SCALE := 3
const S := TS * SCALE

var tiles_tex: Texture2D
var ents_tex: Texture2D


func _ready() -> void:
	tiles_tex = load("res://assets/sprites/tiles.png")
	ents_tex = load("res://assets/sprites/entities.png")
	z_index = 0


func _process(_dt: float) -> void:
	queue_redraw()


func _draw() -> void:
	if Game.player.is_empty():
		return
	var p: Vector2 = Game.player.pos
	_draw_floor(p)
	_draw_stacks()
	_draw_pickups()
	_draw_projectiles()
	_draw_enemies()
	_draw_player()


func _draw_floor(p: Vector2) -> void:
	var margin := 900.0
	var x0 := int(floor((p.x - margin) / float(S)))
	var y0 := int(floor((p.y - margin) / float(S)))
	var x1 := int(ceil((p.x + margin) / float(S)))
	var y1 := int(ceil((p.y + margin) / float(S)))
	for y in range(y0, y1 + 1):
		for x in range(x0, x1 + 1):
			var dest := Rect2(x * S, y * S, S, S)
			var idx := 4 if ((x + y) & 1) == 1 else 3
			_blit(tiles_tex, idx, dest, Color(0.88, 0.78, 0.64))


func _draw_stacks() -> void:
	for r in Game.stacks:
		var rect: Rect2 = r
		var tiles_n := int(ceil(rect.size.x / float(S)))
		for i in tiles_n:
			var dest := Rect2(rect.position.x + i * S, rect.position.y - 8.0, S, rect.size.y + 16.0)
			_blit(tiles_tex, 13, dest, Color(0.9, 0.82, 0.72))


func _draw_pickups() -> void:
	for it in Game.pickups:
		var dest := Rect2(it.pos.x - 16, it.pos.y - 16, 32, 32)
		var idx := 15
		match int(it.kind):
			Catalog.Pickup.GOLD:
				idx = 14
			Catalog.Pickup.BISCUIT:
				idx = 16
			Catalog.Pickup.FOLIO:
				idx = 19
				dest = Rect2(it.pos.x - 20, it.pos.y - 20, 40, 40)
		_blit(tiles_tex, idx, dest, Color.WHITE)


func _draw_projectiles() -> void:
	for pr in Game.projectiles:
		var col := Color(0.91, 0.86, 0.76, 0.9)
		match str(pr.kind):
			"cookbook":
				col = Color(0.92, 0.42, 0.16, 0.9)
			"dictionary":
				col = Color(0.45, 0.55, 0.82, 0.35)
			"hymnal":
				col = Color(0.78, 0.72, 0.88, 0.85)
			"ledger":
				col = Color(0.83, 0.63, 0.14, 0.95)
			"notes":
				col = Color(0.94, 0.90, 0.80, 0.95)
		var r: float = float(pr.radius)
		if bool(pr.get("pulse", false)):
			draw_arc(pr.pos, r, 0, TAU, 28, Color(0.45, 0.55, 0.82, 0.55), 3.0)
		else:
			draw_rect(Rect2(pr.pos.x - r, pr.pos.y - r * 0.6, r * 2.0, r * 1.2), col)


func _draw_enemies() -> void:
	var p: Vector2 = Game.player.pos
	for e in Game.enemies:
		if float(e.hp) <= 0.0:
			continue
		if e.pos.distance_to(p) > 980.0:
			continue
		var sz := 36.0
		match str(e.kind):
			"nymph":
				sz = 32.0
			"adult":
				sz = 46.0
			"winged":
				sz = 38.0
			"overdue":
				sz = 70.0
		var dest := Rect2(e.pos.x - sz * 0.5, e.pos.y - sz * 0.5, sz, sz)
		var tint := Color.WHITE
		if float(e.slow_t) > 0.0:
			tint = Color(0.65, 0.75, 1.0)
		elif str(e.kind) == "adult":
			tint = Color(0.92, 0.78, 0.82)
		elif str(e.kind) == "overdue":
			tint = Color(0.85, 0.7, 0.55)
		_blit(ents_tex, int(e.sprite), dest, tint)


func _draw_player() -> void:
	var p: Vector2 = Game.player.pos
	var hurt := float(Game.player.hp) < float(Game.player.hp_max) * 0.34 or float(Game.player.iframe) > 0.2
	var spr := 1 if hurt else 0
	var sz := 36.0
	var dest := Rect2(p.x - sz * 0.5, p.y - sz * 0.5, sz, sz)
	_blit(ents_tex, spr, dest, Color(1.08, 1.0, 0.9) if not hurt else Color(1.15, 0.72, 0.68))
	var f: Vector2 = Game.player.facing
	if f.length() > 0.2:
		draw_line(p, p + f.normalized() * 18.0, Color(0.91, 0.86, 0.76, 0.55), 1.5)


func _blit(tex: Texture2D, idx: int, dest: Rect2, col: Color) -> void:
	if tex == null:
		draw_rect(dest, col)
		return
	var sx := (idx % 16) * TS
	var sy := int(idx / 16) * TS
	draw_texture_rect_region(tex, dest, Rect2(sx, sy, TS, TS), col)
