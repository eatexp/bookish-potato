extends SceneTree

## Headless checks: maps connect, gambling resolves, a crawl can die and recap.


func _init() -> void:
	call_deferred("_run")


func _run() -> void:
	var failures := 0
	failures += _maps()
	failures += _catalog()
	failures += _slots()
	failures += _run_loop()
	if failures > 0:
		push_error("SMOKE FAILED (%d)" % failures)
		quit(1)
	else:
		print("SMOKE OK")
		quit(0)


func _maps() -> int:
	var fails := 0
	for seed in range(1, 21):
		var rng := RandomNumberGenerator.new()
		rng.seed = seed
		var depth := 1 + (seed % Catalog.DEPTHS)
		var gen: Dictionary = MapGen.generate(rng, depth)
		var tiles: Array = gen.tiles
		var start: Vector2i = gen.start
		var stairs: Vector2i = gen.stairs
		if not MapGen._reachable(tiles, start.x, start.y, stairs.x, stairs.y):
			push_error("map seed %d depth %d not connected" % [seed, depth])
			fails += 1
		var floors := 0
		for y in Catalog.MAP_H:
			for x in Catalog.MAP_W:
				if Catalog.tile_walkable(tiles[y][x]):
					floors += 1
		if floors < 40:
			push_error("map seed %d too small (%d floors)" % [seed, floors])
			fails += 1
	print("maps: %d failures / 20 seeds" % fails)
	return fails


func _catalog() -> int:
	var rng := RandomNumberGenerator.new()
	rng.seed = 7
	var boom := 0
	var curse := 0
	for _i in 40:
		var r: Dictionary = Catalog.resolve_unidentified(rng, 5, true)
		if str(r.outcome) == "boom":
			boom += 1
		elif str(r.outcome) == "curse":
			curse += 1
		if (r.item as Dictionary).is_empty():
			push_error("identify returned empty item")
			return 1
	if boom == 0 or curse == 0:
		push_error("gamble-read distribution looks broken boom=%d curse=%d" % [boom, curse])
		return 1
	for k in Catalog.enemy_kinds():
		var e: Dictionary = Catalog.enemy_template(str(k), 6)
		if int(e.hp) <= 0 or str(e.blurb) == "":
			push_error("bad enemy %s" % k)
			return 1
	print("catalog: boom=%d curse=%d in 40 gambled reads" % [boom, curse])
	return 0


func _slots() -> int:
	var rng := RandomNumberGenerator.new()
	rng.seed = 99
	var paid := 0
	for _i in 30:
		var r: Dictionary = Slots.spin(rng, 4)
		if int(r.gold) > 0 or int(r.pages) > 0 or not (r.item as Dictionary).is_empty():
			paid += 1
		if str(r.title) == "" or str(r.flavor) == "":
			push_error("slots missing fields")
			return 1
	print("slots: %d paying spins / 30" % paid)
	return 0


func _run_loop() -> int:
	var G: Node = root.get_node("Game")
	var P: Node = root.get_node("Persist")
	G.new_run(42)
	if not G.run_active:
		push_error("new_run did not start")
		return 1
	if not G.is_floor_connected():
		push_error("seed 42 floor not connected")
		return 1
	if str(G.equipped_tome.get("name", "")) == "":
		push_error("player has no tome")
		return 1
	var moved := 0
	for _i in 80:
		if not G.run_active:
			break
		var step := false
		for d in [Vector2i(1, 0), Vector2i(-1, 0), Vector2i(0, 1), Vector2i(0, -1), Vector2i(1, 1)]:
			var nx: int = G.player.x + d.x
			var ny: int = G.player.y + d.y
			if G.in_bounds(nx, ny) and (G.is_walkable(nx, ny) or int(G.tiles[ny][nx]) == Catalog.Tile.DOOR_C):
				if G.try_move(d.x, d.y):
					moved += 1
					step = true
					break
		if not step:
			G.wait_turn()
	print("crawl: moved %d, depth %d, turn %d, hp %s, connected %s" % [
		moved, G.depth, G.turn, G.player.get("hp", "?"), G.is_floor_connected()
	])
	var unid := Catalog.unidentified()
	G._stamp_uid(unid)
	G.inventory.append(unid)
	G.carefully_read(G.inventory.size() - 1)
	var unid2 := Catalog.unidentified()
	G._stamp_uid(unid2)
	G.inventory.append(unid2)
	G.gamble_read(G.inventory.size() - 1)
	G.gold += 20
	G.pages += 6
	G._open_stack(false)
	var spin: Dictionary = G.play_slots(false, 5)
	if spin.is_empty():
		push_error("slots would not spin")
		return 1
	G.continue_from_stack()
	if G.run_active:
		G.cause = "smoke-test scholarly injury"
		G.player.hp = 0
		G._end(false)
	if G.run_active:
		push_error("run still active after death")
		return 1
	if P.graveyard.is_empty():
		push_error("graveyard empty after death")
		return 1
	G.new_run(1001)
	G.has_first_edition = true
	G._win()
	if not G.won:
		push_error("win path failed")
		return 1
	print("run loop ok; graveyard %d" % P.graveyard.size())
	return 0
