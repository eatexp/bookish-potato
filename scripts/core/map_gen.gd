class_name MapGen
extends RefCounted

const W := Catalog.MAP_W
const H := Catalog.MAP_H
const T := Catalog.Tile


static func generate(rng: RandomNumberGenerator, depth: int) -> Dictionary:
	var tiles: Array = []
	var variant: Array = []
	for y in H:
		var row: Array = []
		var vrow: Array = []
		row.resize(W)
		vrow.resize(W)
		row.fill(T.WALL)
		for x in W:
			vrow[x] = rng.randi_range(0, 1)
		tiles.append(row)
		variant.append(vrow)

	var rooms: Array = []
	var max_rooms := 7 + rng.randi_range(0, 4)
	for _i in 50:
		if rooms.size() >= max_rooms:
			break
		var rw := rng.randi_range(5, 10)
		var rh := rng.randi_range(4, 8)
		var rx := rng.randi_range(1, W - rw - 2)
		var ry := rng.randi_range(1, H - rh - 2)
		var candidate := {"x": rx, "y": ry, "w": rw, "h": rh, "cx": rx + rw / 2, "cy": ry + rh / 2}
		var ok := true
		for other in rooms:
			if _overlap(candidate, other, 2):
				ok = false
				break
		if not ok:
			continue
		_carve_room(tiles, candidate)
		if rooms.size() > 0:
			_tunnel(tiles, rng, rooms[rooms.size() - 1], candidate)
		rooms.append(candidate)

	if rooms.size() < 3:
		# Fail-safe: a handful of rooms so the floor is always playable.
		rooms.clear()
		for y in H:
			for x in W:
				tiles[y][x] = T.WALL
		for i in 5:
			var rr := {"x": 3 + i * 9, "y": 6 + (i % 2) * 8, "w": 7, "h": 6, "cx": 0, "cy": 0}
			rr.cx = rr.x + rr.w / 2
			rr.cy = rr.y + rr.h / 2
			_carve_room(tiles, rr)
			if i > 0:
				_tunnel(tiles, rng, rooms[rooms.size() - 1], rr)
			rooms.append(rr)

	# Extra loop corridors so the graph is not a pure tree.
	if rooms.size() >= 3:
		var extra := 1 + rng.randi_range(0, 2)
		for _j in extra:
			var a: Dictionary = rooms[rng.randi_range(0, rooms.size() - 1)]
			var b: Dictionary = rooms[rng.randi_range(0, rooms.size() - 1)]
			if a != b:
				_tunnel(tiles, rng, a, b)

	_place_doors(tiles, rooms)

	var start: Dictionary = rooms[0]
	var stairs_room: Dictionary = rooms[0]
	var best := -1
	for r in rooms:
		var dist: int = absi(r.cx - start.cx) + absi(r.cy - start.cy)
		if dist > best:
			best = dist
			stairs_room = r

	var px := int(start.cx)
	var py := int(start.cy)
	var sx := int(stairs_room.cx)
	var sy := int(stairs_room.cy)
	if depth < Catalog.DEPTHS:
		tiles[sy][sx] = T.STAIRS_D
	else:
		tiles[sy][sx] = T.FLOOR

	# Guarantee connectivity from player to stairs/goal.
	if not _reachable(tiles, px, py, sx, sy):
		_carve_line(tiles, px, py, sx, sy)

	var stack_room: Dictionary = {}
	var want_stack := (depth % 3 == 0) or rng.randf() < 0.38
	if want_stack and rooms.size() >= 3:
		for r in rooms:
			if r == start or r == stairs_room:
				continue
			stack_room = r
			break
		if not stack_room.is_empty():
			_paint_stack(tiles, rng, stack_room)

	var walk := _walkable_list(tiles)
	return {
		"tiles": tiles,
		"variant": variant,
		"rooms": rooms,
		"start": Vector2i(px, py),
		"stairs": Vector2i(sx, sy),
		"stack_room": stack_room,
		"walkable": walk,
	}


static func _overlap(a: Dictionary, b: Dictionary, pad: int) -> bool:
	return not (a.x + a.w + pad <= b.x or b.x + b.w + pad <= a.x or a.y + a.h + pad <= b.y or b.y + b.h + pad <= a.y)


static func _carve_room(tiles: Array, r: Dictionary) -> void:
	for y in range(r.y, r.y + r.h):
		for x in range(r.x, r.x + r.w):
			if x > 0 and y > 0 and x < W - 1 and y < H - 1:
				tiles[y][x] = T.FLOOR


static func _tunnel(tiles: Array, rng: RandomNumberGenerator, a: Dictionary, b: Dictionary) -> void:
	var x1 := int(a.cx)
	var y1 := int(a.cy)
	var x2 := int(b.cx)
	var y2 := int(b.cy)
	if rng.randf() < 0.5:
		_carve_h(tiles, x1, x2, y1)
		_carve_v(tiles, y1, y2, x2)
	else:
		_carve_v(tiles, y1, y2, x1)
		_carve_h(tiles, x1, x2, y2)


static func _carve_h(tiles: Array, x1: int, x2: int, y: int) -> void:
	var a := mini(x1, x2)
	var b := maxi(x1, x2)
	for x in range(a, b + 1):
		_floor_if_in(tiles, x, y)
		if y > 1 and tiles[y - 1][x] == T.WALL and randf() < 0.04:
			pass


static func _carve_v(tiles: Array, y1: int, y2: int, x: int) -> void:
	var a := mini(y1, y2)
	var b := maxi(y1, y2)
	for y in range(a, b + 1):
		_floor_if_in(tiles, x, y)


static func _carve_line(tiles: Array, x1: int, y1: int, x2: int, y2: int) -> void:
	_carve_h(tiles, x1, x2, y1)
	_carve_v(tiles, y1, y2, x2)


static func _floor_if_in(tiles: Array, x: int, y: int) -> void:
	if x > 0 and y > 0 and x < W - 1 and y < H - 1:
		if tiles[y][x] == T.WALL or tiles[y][x] == T.VOID:
			tiles[y][x] = T.FLOOR


static func _place_doors(tiles: Array, rooms: Array) -> void:
	for r in rooms:
		for x in range(r.x, r.x + r.w):
			_maybe_door(tiles, x, r.y - 1)
			_maybe_door(tiles, x, r.y + r.h)
		for y in range(r.y, r.y + r.h):
			_maybe_door(tiles, r.x - 1, y)
			_maybe_door(tiles, r.x + r.w, y)


static func _maybe_door(tiles: Array, x: int, y: int) -> void:
	if x <= 0 or y <= 0 or x >= W - 1 or y >= H - 1:
		return
	if tiles[y][x] != T.FLOOR:
		return
	var horiz: bool = int(tiles[y][x - 1]) == T.WALL and int(tiles[y][x + 1]) == T.WALL
	var vert: bool = int(tiles[y - 1][x]) == T.WALL and int(tiles[y + 1][x]) == T.WALL
	if horiz or vert:
		tiles[y][x] = T.DOOR_C


static func _paint_stack(tiles: Array, rng: RandomNumberGenerator, r: Dictionary) -> void:
	for y in range(r.y, r.y + r.h):
		for x in range(r.x, r.x + r.w):
			tiles[y][x] = T.FELT
	var dx := int(r.cx)
	var dy := int(r.cy)
	tiles[dy][dx] = T.DESK
	# Shelves along a wall, not blocking the desk.
	for x in range(r.x, r.x + r.w):
		if rng.randf() < 0.45 and tiles[r.y][x] == T.FELT:
			tiles[r.y][x] = T.SHELF


static func _walkable_list(tiles: Array) -> Array:
	var out: Array = []
	for y in H:
		for x in W:
			if Catalog.tile_walkable(tiles[y][x]):
				out.append(Vector2i(x, y))
	return out


static func _reachable(tiles: Array, x1: int, y1: int, x2: int, y2: int) -> bool:
	var seen := {}
	var q: Array = [Vector2i(x1, y1)]
	seen[Vector2i(x1, y1)] = true
	var dirs := [Vector2i(1, 0), Vector2i(-1, 0), Vector2i(0, 1), Vector2i(0, -1), Vector2i(1, 1), Vector2i(1, -1), Vector2i(-1, 1), Vector2i(-1, -1)]
	while q.size() > 0:
		var p: Vector2i = q.pop_front()
		if p.x == x2 and p.y == y2:
			return true
		for d in dirs:
			var n: Vector2i = p + d
			if n.x <= 0 or n.y <= 0 or n.x >= W - 1 or n.y >= H - 1:
				continue
			if seen.has(n):
				continue
			var t: int = int(tiles[n.y][n.x])
			if t == T.WALL or t == T.VOID or t == T.SHELF:
				continue
			# Closed doors still count as reachable (player can open them).
			seen[n] = true
			q.append(n)
	return false
