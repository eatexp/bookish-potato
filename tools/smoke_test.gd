extends SceneTree

## Headless checks: maps connect, collate/crack, catalogue slips, crawl, recap.


func _init() -> void:
	call_deferred("_run")


func _run() -> void:
	var failures := 0
	failures += _maps()
	failures += _catalog()
	failures += _slips()
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
	var flare := 0
	var curse := 0
	for _i in 40:
		var unid: Dictionary = Catalog.unidentified(rng)
		if str(unid.tell) == "":
			push_error("unid missing tell")
			return 1
		var r: Dictionary = Catalog.resolve_unidentified(rng, 4, true, str(unid.quality), false)
		if str(r.outcome) == "flare":
			flare += 1
		elif str(r.outcome) == "curse":
			curse += 1
		if (r.item as Dictionary).is_empty():
			push_error("identify returned empty item")
			return 1
	# Pity: two curses then block.
	var blocked: Dictionary = Catalog.resolve_unidentified(rng, 4, true, "sour", true)
	if str(blocked.outcome) == "curse":
		push_error("pity failed to block a curse")
		return 1
	if flare == 0 or curse == 0:
		push_error("crack distribution looks broken flare=%d curse=%d" % [flare, curse])
		return 1
	for k in Catalog.enemy_kinds():
		var e: Dictionary = Catalog.enemy_template(str(k), 4)
		if int(e.hp) <= 0:
			push_error("bad enemy %s" % k)
			return 1
	print("catalog: flare=%d curse=%d in 40 cracks; pity held" % [flare, curse])
	return 0


func _slips() -> int:
	var rng := RandomNumberGenerator.new()
	rng.seed = 99
	for s in CatalogueDraw.shelves():
		var three: Array = CatalogueDraw.draw_three(rng, 3, str(s.id))
		if three.size() != 3:
			push_error("shelf %s did not yield 3 slips" % s.id)
			return 1
		for slip in three:
			if str(slip.title) == "" or str(slip.note) == "":
				push_error("blank slip on %s" % s.id)
				return 1
	print("catalogue: 5 shelves × 3 slips ok")
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
	if Catalog.DEPTHS != 5:
		push_error("v0.1 should be 5 floors")
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
	print("crawl: moved %d, depth %d, turn %d, hp %s, candle %s, connected %s" % [
		moved, G.depth, G.turn, G.player.get("hp", "?"), G.candle, G.is_floor_connected()
	])
	var unid := Catalog.unidentified(G.rng)
	G._stamp_uid(unid)
	G.inventory.append(unid)
	G.collate(G.inventory.size() - 1)
	var unid2 := Catalog.unidentified(G.rng)
	G._stamp_uid(unid2)
	G.inventory.append(unid2)
	G.crack_spine(G.inventory.size() - 1)
	G.pages += 6
	G._open_returns()
	G.catalogue_choose_shelf("cookery")
	if G.catalogue_slips.size() != 3:
		push_error("catalogue did not lay out slips")
		return 1
	G.catalogue_lock(0)
	G.catalogue_redraw(1)
	G.catalogue_take(0)
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
	G.has_notable = true
	G._win()
	if not G.won:
		push_error("win path failed")
		return 1
	print("run loop ok; graveyard %d" % P.graveyard.size())
	return 0
