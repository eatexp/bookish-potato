extends Node2D

## One library floor — The Stacks. Horde via MultiMeshInstance2D. No per-enemy Area2D.

const TS := 16
const S := 48

var tiles_tex: Texture2D
var ents_tex: Texture2D
var mm_nodes: Dictionary = {}


func _ready() -> void:
	tiles_tex = load("res://assets/sprites/tiles.png")
	ents_tex = load("res://assets/sprites/entities.png")
	z_index = 0
	_setup_horde_meshes()


func _setup_horde_meshes() -> void:
	var kinds := {
		"patron": {"idx": 2, "sz": 32.0},
		"overdue": {"idx": 2, "sz": 46.0},
		"notice": {"idx": 7, "sz": 38.0},
		"collector": {"idx": 4, "sz": 70.0},
	}
	for k in kinds:
		var spec: Dictionary = kinds[k]
		var at := AtlasTexture.new()
		at.atlas = ents_tex
		var idx: int = int(spec.idx)
		at.region = Rect2((idx % 16) * TS, int(idx / 16) * TS, TS, TS)
		var mesh := QuadMesh.new()
		mesh.size = Vector2(float(spec.sz), float(spec.sz))
		var mm := MultiMesh.new()
		mm.transform_format = MultiMesh.TRANSFORM_2D
		mm.use_colors = true
		mm.instance_count = Catalog.HORDE_CAP
		mm.visible_instance_count = 0
		mm.mesh = mesh
		var n := MultiMeshInstance2D.new()
		n.name = "Horde_%s" % k
		n.texture = at
		n.multimesh = mm
		n.z_index = 2
		add_child(n)
		mm_nodes[k] = n


func _process(_dt: float) -> void:
	_sync_horde()
	queue_redraw()


func _sync_horde() -> void:
	var counts := {"patron": 0, "overdue": 0, "notice": 0, "collector": 0}
	var p: Vector2 = Game.player.pos if not Game.player.is_empty() else Vector2.ZERO
	for e in Game.enemies:
		if float(e.hp) <= 0.0:
			continue
		if e.pos.distance_squared_to(p) > 980.0 * 980.0:
			continue
		var k := str(e.kind)
		if not counts.has(k):
			k = "patron"
		var n: MultiMeshInstance2D = mm_nodes.get(k)
		if n == null:
			continue
		var i: int = int(counts[k])
		if i >= Catalog.HORDE_CAP:
			continue
		var xf := Transform2D(0.0, e.pos)
		n.multimesh.set_instance_transform_2d(i, xf)
		var col := Color.WHITE
		if float(e.slow_t) > 0.0:
			col = Color(0.65, 0.75, 1.0)
		elif k == "overdue":
			col = Color(0.92, 0.78, 0.82)
		elif k == "collector":
			col = Color(0.85, 0.7, 0.55)
		n.multimesh.set_instance_color(i, col)
		counts[k] = i + 1
	for k in mm_nodes:
		(mm_nodes[k] as MultiMeshInstance2D).multimesh.visible_instance_count = int(counts.get(k, 0))


func _draw() -> void:
	if Game.player.is_empty():
		return
	var p: Vector2 = Game.player.pos
	_draw_floor(p)
	_draw_stacks()
	_draw_pickups()
	_draw_projectiles()
	_draw_atlas()
	_draw_cookbook()
	_draw_player()
	_draw_enemies_if_needed(p)


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
		var col := Color(0.94, 0.90, 0.80, 0.95)
		match str(pr.kind):
			"primer":
				col = Color(0.93, 0.88, 0.74, 0.95)
			"dictionary":
				col = Color(0.45, 0.55, 0.82, 0.35)
			"gazette":
				col = Color(0.78, 0.72, 0.55, 0.9)
		var r: float = float(pr.radius)
		if bool(pr.get("pulse", false)):
			draw_arc(pr.pos, r, 0, TAU, 28, Color(0.45, 0.55, 0.82, 0.55), 2.5)
			draw_arc(pr.pos, r * 0.7, 0.2, TAU * 0.85, 16, Color(0.55, 0.5, 0.35, 0.35), 1.5)
		else:
			if str(pr.kind) == "primer":
				var vel: Vector2 = pr.vel
				var back := -vel.normalized() * 10.0 if vel.length() > 1.0 else Vector2.LEFT * 10.0
				draw_rect(Rect2(pr.pos.x + back.x - 3.0, pr.pos.y + back.y - 2.0, 6, 4), Color(0.91, 0.86, 0.76, 0.45))
			draw_rect(Rect2(pr.pos.x - r * 1.2, pr.pos.y - r * 0.45, r * 2.4, r * 0.9), col)


func _draw_atlas() -> void:
	for p in Game.atlas_orbs:
		var pos: Vector2 = p
		var wob := sin(Time.get_ticks_msec() * 0.02 + pos.x * 0.01) * 2.0
		var trail := Vector2.from_angle(Time.get_ticks_msec() * 0.004 + pos.x) * 8.0
		draw_rect(Rect2(pos.x - trail.x - 4, pos.y - trail.y - 6 + wob, 8, 10), Color(0.93, 0.88, 0.74, 0.35))
		draw_rect(Rect2(pos.x - 10, pos.y - 12 + wob, 20, 16), Color(0.93, 0.88, 0.74, 0.95))
		draw_rect(Rect2(pos.x - 8, pos.y - 10 + wob, 8, 14), Color(0.45, 0.22, 0.16, 0.9))
		draw_rect(Rect2(pos.x, pos.y - 10 + wob, 8, 14), Color(0.38, 0.18, 0.14, 0.9))


func _draw_cookbook() -> void:
	if Game.cookbook_r <= 1.0:
		return
	var p: Vector2 = Game.player.pos
	draw_arc(p, Game.cookbook_r, 0, TAU, 32, Color(0.92, 0.55, 0.22, 0.28), 3.0)
	draw_circle(p, Game.cookbook_r * 0.55, Color(0.95, 0.72, 0.35, 0.08))


func _draw_player() -> void:
	var p: Vector2 = Game.player.pos
	var hurt := float(Game.player.hp) < float(Game.player.hp_max) * 0.34 or float(Game.player.iframe) > 0.2
	var spr := 1 if hurt else 0
	var sz := 36.0
	var dest := Rect2(p.x - sz * 0.5, p.y - sz * 0.5, sz, sz)
	_blit(ents_tex, spr, dest, Color(1.08, 1.0, 0.9) if not hurt else Color(1.15, 0.72, 0.68))


func _draw_enemies_if_needed(p: Vector2) -> void:
	var vis := 0
	for k in mm_nodes:
		vis += (mm_nodes[k] as MultiMeshInstance2D).multimesh.visible_instance_count
	var near := 0
	var far_sq := 980.0 * 980.0
	for e in Game.enemies:
		if float(e.hp) <= 0.0:
			continue
		if e.pos.distance_squared_to(p) <= far_sq:
			near += 1
	if near == 0 or vis > 0:
		return
	for e2 in Game.enemies:
		if float(e2.hp) <= 0.0:
			continue
		var sz := 32.0
		match str(e2.kind):
			"overdue":
				sz = 46.0
			"notice":
				sz = 38.0
			"collector":
				sz = 70.0
		var dest := Rect2(e2.pos.x - sz * 0.5, e2.pos.y - sz * 0.5, sz, sz)
		_blit(ents_tex, int(e2.get("sprite", 2)), dest, Color.WHITE)


func _blit(tex: Texture2D, idx: int, dest: Rect2, col: Color) -> void:
	if tex == null:
		draw_rect(dest, col)
		return
	var sx := (idx % 16) * TS
	var sy := int(idx / 16) * TS
	draw_texture_rect_region(tex, dest, Rect2(sx, sy, TS, TS), col)
