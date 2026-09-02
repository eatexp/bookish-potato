class_name Fov
extends RefCounted

## Symmetric shadowcasting-ish FOV via Bresenham rays. Fine at this map size.


static func compute(tiles: Array, origin: Vector2i, radius: int) -> Dictionary:
	var h: int = tiles.size()
	var w: int = tiles[0].size()
	var vis: Array = []
	for y in h:
		var row: Array = []
		row.resize(w)
		row.fill(false)
		vis.append(row)
	vis[origin.y][origin.x] = true
	for dy in range(-radius, radius + 1):
		for dx in range(-radius, radius + 1):
			if dx * dx + dy * dy > radius * radius:
				continue
			_cast(tiles, vis, origin.x, origin.y, origin.x + dx, origin.y + dy, w, h)
	return {"visible": vis}


static func _cast(tiles: Array, vis: Array, x0: int, y0: int, x1: int, y1: int, w: int, h: int) -> void:
	var dx := absi(x1 - x0)
	var dy := -absi(y1 - y0)
	var sx := 1 if x0 < x1 else -1
	var sy := 1 if y0 < y1 else -1
	var err := dx + dy
	var x := x0
	var y := y0
	while true:
		if x < 0 or y < 0 or x >= w or y >= h:
			return
		vis[y][x] = true
		if x == x0 and y == y0:
			pass
		else:
			if not Catalog.tile_transparent(tiles[y][x]):
				return
		if x == x1 and y == y1:
			return
		var e2 := 2 * err
		if e2 >= dy:
			err += dy
			x += sx
		if e2 <= dx:
			err += dx
			y += sy
