extends Node

## Run simulation. No mid-run save. Permadeath.

signal turn_done
signal run_ended
signal floor_changed
signal stack_opened
signal stack_closed
signal recap_ready

enum Phase { MENU, DUNGEON, STACK, PAUSED, RECAP }

const T := Catalog.Tile
const W := Catalog.MAP_W
const H := Catalog.MAP_H

var rng := RandomNumberGenerator.new()
var phase: int = Phase.MENU
var run_active := false
var seed_used := 0
var depth := 1
var turn := 0
var wax_acc := 0

var tiles: Array = []
var variant: Array = []
var explored: Array = []
var visible: Array = []
var rooms: Array = []
var start_pos := Vector2i.ZERO
var stairs_pos := Vector2i.ZERO
var items_at: Dictionary = {} # Vector2i -> Array
var entities: Array = []
var player: Dictionary = {}
var next_id := 1

var gold := 0
var pages := 0
var candle := 90
var candle_max := 100
var inventory: Array = []
var equipped_tome: Dictionary = {}
var equipped_binding: Dictionary = {}
var has_notable := false

var messages: Array[String] = []
var kills := 0
var cause := ""
var won := false
var biggest_win := {"desc": "none", "value": 0}
var biggest_loss := {"desc": "none", "value": 0}
var cracks := 0
var crack_wins := 0
var curse_streak := 0
var miss_turns := 0
var between_desk := false
var catalogue_slips: Array = []
var catalogue_shelf := ""
var last_identify := {}
var look_name := ""


func new_run(p_seed: int = 0) -> void:
	if p_seed == 0:
		rng.randomize()
		seed_used = int(rng.seed)
	else:
		seed_used = p_seed
		rng.seed = p_seed
	run_active = true
	won = false
	cause = ""
	depth = 1
	turn = 0
	wax_acc = 0
	gold = 12
	pages = 4
	candle = 90
	kills = 0
	cracks = 0
	crack_wins = 0
	curse_streak = 0
	miss_turns = 0
	has_notable = false
	between_desk = false
	catalogue_slips.clear()
	catalogue_shelf = ""
	last_identify = {}
	biggest_win = {"desc": "none", "value": 0}
	biggest_loss = {"desc": "none", "value": 0}
	messages.clear()
	inventory.clear()
	equipped_tome = Catalog.starter_tome()
	equipped_binding = Catalog.starter_binding()
	_stamp_uid(equipped_tome)
	_stamp_uid(equipped_binding)
	inventory.append(Catalog.potion_starch())
	_stamp_uid(inventory[0])
	player = {
		"id": 0,
		"is_player": true,
		"name": "the bookish potato",
		"kind": "player",
		"x": 0,
		"y": 0,
		"hp": 24,
		"hp_max": 24,
		"sprite": 0,
	}
	_log("You tuck Margin Notes under one arm and descend. The stacks smell of dust and wax.")
	_make_floor()
	phase = Phase.DUNGEON
	floor_changed.emit()
	turn_done.emit()


func abandon_run() -> void:
	if not run_active:
		return
	cause = "abandoned the stacks"
	_end(false)


func _stamp_uid(item: Dictionary) -> void:
	item.uid = next_id
	next_id += 1


func _make_floor() -> void:
	var gen: Dictionary = MapGen.generate(rng, depth)
	tiles = gen.tiles
	variant = gen.variant
	rooms = gen.rooms
	start_pos = gen.start
	stairs_pos = gen.stairs
	items_at.clear()
	entities.clear()
	player.x = start_pos.x
	player.y = start_pos.y
	_init_memory()
	_populate()
	_recompute_fov()
	if depth == 1:
		_log("Chapter 1. A short lantern, a shorter floorplan.")
	else:
		_log("Chapter %d. A new floor of the stacks." % depth)


func _init_memory() -> void:
	explored = []
	visible = []
	for y in H:
		var erow: Array = []
		var vrow: Array = []
		erow.resize(W)
		vrow.resize(W)
		erow.fill(false)
		vrow.fill(false)
		explored.append(erow)
		visible.append(vrow)


func _populate() -> void:
	var spots: Array = []
	for p in _walkable():
		if absi(p.x - start_pos.x) + absi(p.y - start_pos.y) > 4:
			spots.append(p)
	_shuffle(spots)
	var ei := 0
	var enemy_n := 4 + depth + rng.randi_range(0, 1)
	for _i in enemy_n:
		if ei >= spots.size():
			break
		var pos: Vector2i = spots[ei]
		ei += 1
		if pos == stairs_pos:
			continue
		var kind := Catalog.pick_enemy_kind(rng, depth)
		var e: Dictionary = Catalog.enemy_template(kind, depth)
		e.id = next_id
		next_id += 1
		e.x = pos.x
		e.y = pos.y
		entities.append(e)

	var loot_n := 5 + depth / 2
	for _j in loot_n:
		if ei >= spots.size():
			break
		var lp: Vector2i = spots[ei]
		ei += 1
		var roll := rng.randf()
		var it: Dictionary
		if roll < 0.28:
			it = {"kind": "gold_pile", "name": "Gold", "amount": rng.randi_range(3, 8 + depth), "sprite": 14}
		elif roll < 0.48:
			it = {"kind": "pages_pile", "name": "Loose Pages", "amount": rng.randi_range(1, 3), "sprite": 15}
		elif roll < 0.72:
			it = Catalog.unidentified(rng)
			_stamp_uid(it)
		else:
			it = Catalog.random_identified_loot(rng, depth, false)
			if it.kind == "unid":
				it = Catalog.unidentified(rng)
			_stamp_uid(it)
		_drop_at(lp, it)

	if depth >= Catalog.DEPTHS:
		_drop_at(stairs_pos, Catalog.notable_folio())
		_stamp_uid(_top_item(stairs_pos))
		_log("A lectern holds the Notable Folio. Take it and leave by the Binding Exit.")


func _walkable() -> Array:
	var out: Array = []
	for y in H:
		for x in W:
			if Catalog.tile_walkable(tiles[y][x]):
				out.append(Vector2i(x, y))
	return out


func _drop_at(pos: Vector2i, item: Dictionary) -> void:
	if not items_at.has(pos):
		items_at[pos] = []
	items_at[pos].append(item)


func _top_item(pos: Vector2i) -> Dictionary:
	if not items_at.has(pos):
		return {}
	var arr: Array = items_at[pos]
	if arr.is_empty():
		return {}
	return arr[arr.size() - 1]


func in_bounds(x: int, y: int) -> bool:
	return x >= 0 and y >= 0 and x < W and y < H


func is_walkable(x: int, y: int) -> bool:
	if not in_bounds(x, y):
		return false
	return Catalog.tile_walkable(tiles[y][x])


func entity_at(x: int, y: int) -> Dictionary:
	if player.get("x", -1) == x and player.get("y", -1) == y:
		return player
	for e in entities:
		if e.x == x and e.y == y and int(e.hp) > 0:
			return e
	return {}


func blocking_at(x: int, y: int) -> bool:
	if not in_bounds(x, y):
		return true
	var t: int = int(tiles[y][x])
	if t == T.WALL or t == T.VOID or t == T.SHELF or t == T.DOOR_C or t == T.DESK:
		return true
	return not entity_at(x, y).is_empty()


func _recompute_fov() -> void:
	var fov: Dictionary = Fov.compute(tiles, Vector2i(player.x, player.y), Catalog.FOV_R)
	visible = fov.visible
	for y in H:
		for x in W:
			if visible[y][x]:
				explored[y][x] = true


func _log(text: String) -> void:
	messages.append(text)
	if messages.size() > 80:
		messages = messages.slice(messages.size() - 80)


func last_messages(n: int = 6) -> PackedStringArray:
	var out := PackedStringArray()
	var start := maxi(0, messages.size() - n)
	for i in range(start, messages.size()):
		out.append(messages[i])
	return out


func player_atk() -> int:
	var a := 1
	if not equipped_tome.is_empty():
		a += int(equipped_tome.atk)
	return a


func player_def() -> int:
	var d := 0
	if not equipped_binding.is_empty():
		d += int(equipped_binding.def)
	if not equipped_tome.is_empty():
		d += int(equipped_tome.get("def", 0))
	return d


func try_move(dx: int, dy: int) -> bool:
	if not run_active or phase != Phase.DUNGEON:
		return false
	if dx == 0 and dy == 0:
		return wait_turn()
	var nx: int = player.x + dx
	var ny: int = player.y + dy
	if not in_bounds(nx, ny):
		return false
	var t: int = int(tiles[ny][nx])
	if t == T.WALL or t == T.VOID or t == T.SHELF:
		_log("Stone. Unannotated.")
		return false
	if t == T.DOOR_C:
		tiles[ny][nx] = T.DOOR_O
		_log("You ease the door. Hinges complain in an old dialect.")
		AudioMgr.play("open")
		_spend_turn()
		return true
	if t == T.DESK:
		_log("A dusty counter. The Returns Desk is between floors.")
		return false
	var other := entity_at(nx, ny)
	if not other.is_empty() and not other.get("is_player", false):
		_player_hit(other)
		_spend_turn()
		return true
	if t == T.STAIRS_D:
		player.x = nx
		player.y = ny
		_auto_pickup()
		_descend()
		return true
	if t == T.EXIT:
		player.x = nx
		player.y = ny
		if has_notable:
			_win()
			return true
		_log("A sealed binding-arch. It wants the Notable Folio.")
		_spend_turn()
		return true
	if not Catalog.tile_walkable(t):
		return false
	player.x = nx
	player.y = ny
	_auto_pickup()
	_spend_turn()
	return true


func wait_turn() -> bool:
	if not run_active or phase != Phase.DUNGEON:
		return false
	_log("You wait, potato-still.")
	_spend_turn()
	return true


func use_stairs() -> bool:
	if not run_active or phase != Phase.DUNGEON:
		return false
	var t: int = int(tiles[player.y][player.x])
	if t == T.STAIRS_D:
		_descend()
		return true
	if t == T.EXIT and has_notable:
		_win()
		return true
	_log("No stair, no exit. Just floor.")
	return false


func _descend() -> void:
	if depth >= Catalog.DEPTHS:
		_log("This slice of the stacks ends here. Recover the Notable Folio and leave.")
		return
	AudioMgr.play("stairs")
	depth += 1
	# v0.1: Returns Desk between floors 2→3 and 4→5 only. Buys unidentified; sells nothing.
	between_desk = (depth == 3 or depth == 5)
	if between_desk:
		_log("Between chapters: a Returns Desk. They take unidentified folios for pages. Nothing is for sale.")
		_open_returns()
	else:
		_make_floor()
		floor_changed.emit()
		turn_done.emit()


func continue_from_stack() -> void:
	if not run_active:
		return
	phase = Phase.DUNGEON
	if between_desk:
		between_desk = false
		catalogue_slips.clear()
		catalogue_shelf = ""
		_make_floor()
		floor_changed.emit()
	stack_closed.emit()
	turn_done.emit()


func _open_returns() -> void:
	between_desk = true
	phase = Phase.STACK
	catalogue_slips.clear()
	catalogue_shelf = ""
	AudioMgr.play("page")
	stack_opened.emit()


func return_folio(inv_index: int) -> void:
	## Returns Desk buys unidentified folios for pages. Sells nothing.
	if phase != Phase.STACK:
		return
	if inv_index < 0 or inv_index >= inventory.size():
		return
	var it: Dictionary = inventory[inv_index]
	if str(it.kind) != "unid":
		_log("They only take unidentified folios.")
		return
	var pay := 2
	match str(it.get("quality", "mixed")):
		"promising":
			pay = 3
		"sour":
			pay = 1
	inventory.remove_at(inv_index)
	pages += pay
	_log("Returned %s. The desk pays %d pages." % [it.name, pay])
	AudioMgr.play("page")
	turn_done.emit()


func unid_inv_indices() -> Array:
	var out: Array = []
	for i in inventory.size():
		if str(inventory[i].kind) == "unid":
			out.append(i)
	return out


func catalogue_choose_shelf(shelf_id: String) -> void:
	if phase != Phase.STACK:
		return
	catalogue_shelf = shelf_id
	catalogue_slips = CatalogueDraw.draw_three(rng, depth, shelf_id)
	_log("You take three slips from the %s shelf." % CatalogueDraw.shelf_name(shelf_id))
	AudioMgr.play("page")
	turn_done.emit()


func catalogue_lock(index: int) -> void:
	if phase != Phase.STACK or index < 0 or index >= catalogue_slips.size():
		return
	var slip: Dictionary = catalogue_slips[index]
	if bool(slip.get("locked", false)):
		return
	if pages < 1:
		_log("No spare pages to lock a slip.")
		return
	pages -= 1
	slip.locked = true
	catalogue_slips[index] = slip
	_log("Locked: %s." % slip.title)
	AudioMgr.play("page")
	turn_done.emit()


func catalogue_redraw(index: int) -> void:
	if phase != Phase.STACK or index < 0 or index >= catalogue_slips.size():
		return
	var slip: Dictionary = catalogue_slips[index]
	if bool(slip.get("locked", false)):
		_log("That slip is locked.")
		return
	if pages < 1:
		_log("No spare pages to recatalogue a slip.")
		return
	pages -= 1
	catalogue_slips[index] = CatalogueDraw.draw_slip(rng, depth, catalogue_shelf)
	_log("Recatalogued. New slip: %s." % catalogue_slips[index].title)
	AudioMgr.play("page")
	turn_done.emit()


func catalogue_take(index: int) -> void:
	if phase != Phase.STACK or index < 0 or index >= catalogue_slips.size():
		return
	var slip: Dictionary = catalogue_slips[index]
	_apply_slip(slip)
	catalogue_slips.clear()
	catalogue_shelf = ""
	turn_done.emit()


func _apply_slip(slip: Dictionary) -> void:
	var net := int(slip.get("value", 0))
	match str(slip.kind):
		"gold":
			gold += int(slip.gold)
			_log("%s. +%d gold." % [slip.note, int(slip.gold)])
		"pages":
			pages += int(slip.pages)
			_log("%s. +%d pages." % [slip.note, int(slip.pages)])
		"wax":
			candle = mini(candle_max, candle + int(slip.wax))
			_log("%s. Candle +%d." % [slip.note, int(slip.wax)])
		"misfile":
			player.hp -= int(slip.curse_hp)
			if not (slip.item as Dictionary).is_empty():
				var it: Dictionary = slip.item
				_stamp_uid(it)
				if inventory.size() < Catalog.INV_CAP:
					inventory.append(it)
			_log("%s (−%d HP)." % [slip.note, int(slip.curse_hp)])
			AudioMgr.play("curse")
			_track_chance(net, "Misfile: %s" % slip.title)
			if player.hp <= 0:
				cause = "a misfiled slip"
				_end(false)
			return
		"item":
			var it2: Dictionary = slip.item
			_stamp_uid(it2)
			if inventory.size() < Catalog.INV_CAP:
				inventory.append(it2)
			else:
				_drop_at(Vector2i(player.x, player.y), it2)
				_log("Satchel full. The slip waits on the floor.")
			_log("%s You take %s." % [slip.note, it2.name])
			AudioMgr.play("pickup")
		_:
			_log(str(slip.note))
	_track_chance(net, "Catalogue: %s" % slip.title)
	if net > 0:
		crack_wins += 1


func _track_chance(net: int, desc: String) -> void:
	if net > int(biggest_win.value):
		biggest_win = {"desc": desc, "value": net}
	if net < int(biggest_loss.value):
		biggest_loss = {"desc": desc, "value": net}


func can_blurb(_target: Dictionary) -> bool:
	return false


func place_blurb_bet(_target_id: int, _stake: int) -> bool:
	return false


func adjacent_enemies() -> Array:
	var out: Array = []
	for e in entities:
		if int(e.hp) <= 0:
			continue
		if chebyshev(player.x, player.y, e.x, e.y) == 1:
			out.append(e)
	return out


func _auto_pickup() -> void:
	var pos := Vector2i(player.x, player.y)
	if not items_at.has(pos):
		return
	var remain: Array = []
	for it in items_at[pos]:
		if it.get("kind", "") == "gold_pile":
			gold += int(it.amount)
			_log("You pocket %d gold." % int(it.amount))
			AudioMgr.play("pickup")
		elif it.get("kind", "") == "pages_pile":
			pages += int(it.amount)
			_log("You gather %d pages." % int(it.amount))
			AudioMgr.play("page")
		elif it.get("kind", "") == "first":
			inventory.append(it)
			has_notable = true
			_log("The Notable Folio is in your hands. A Binding Exit unseals in the first chamber.")
			AudioMgr.play("identify")
			tiles[start_pos.y][start_pos.x] = T.EXIT
		else:
			if inventory.size() >= Catalog.INV_CAP:
				remain.append(it)
				_log("No room for %s." % it.name)
			else:
				inventory.append(it)
				_log("Picked up %s." % it.name)
				AudioMgr.play("pickup")
	if remain.is_empty():
		items_at.erase(pos)
	else:
		items_at[pos] = remain


func drop_item(index: int) -> void:
	if index < 0 or index >= inventory.size():
		return
	var it: Dictionary = inventory[index]
	inventory.remove_at(index)
	_drop_at(Vector2i(player.x, player.y), it)
	_log("Dropped %s." % it.name)
	if phase == Phase.DUNGEON:
		_spend_turn()
	else:
		turn_done.emit()


func equip_item(index: int) -> void:
	if index < 0 or index >= inventory.size():
		return
	var it: Dictionary = inventory[index]
	if not bool(it.get("identified", true)):
		_log("Unidentified. Read it before you trust it against your skin.")
		return
	if it.kind == "tome":
		inventory.remove_at(index)
		if not equipped_tome.is_empty():
			inventory.append(equipped_tome)
		equipped_tome = it
		_log("You ready %s." % it.name)
		if bool(it.cursed):
			_log("The folio nips your hands. Cursed.")
			AudioMgr.play("curse")
		if phase == Phase.DUNGEON:
			_spend_turn()
		else:
			turn_done.emit()
	elif it.kind == "binding":
		inventory.remove_at(index)
		if not equipped_binding.is_empty():
			inventory.append(equipped_binding)
		equipped_binding = it
		_log("You shrug into %s." % it.name)
		if phase == Phase.DUNGEON:
			_spend_turn()
		else:
			turn_done.emit()
	else:
		_log("That does not equip.")


func use_item(index: int) -> void:
	if index < 0 or index >= inventory.size():
		return
	var it: Dictionary = inventory[index]
	match str(it.kind):
		"potion":
			player.hp = mini(int(player.hp_max), int(player.hp) + int(it.get("heal", 0)))
			candle = mini(candle_max, candle + int(it.get("wax", it.get("food", 0))))
			_log("You drink %s." % it.name)
			inventory.remove_at(index)
			AudioMgr.play("potion")
			if phase == Phase.DUNGEON:
				_spend_turn()
			else:
				turn_done.emit()
		"scroll":
			inventory.remove_at(index)
			_do_scroll(str(it.effect), it.name)
		"unid":
			_log("Choose Collate (safe) or Crack the spine (risk).")
		"first":
			_log("It is already doing the only job this slice requires.")
		"tome", "binding":
			equip_item(index)
		_:
			_log("Nothing happens.")


func _do_scroll(effect: String, item_name: String) -> void:
	_log("You intone %s." % item_name)
	AudioMgr.play("identify")
	match effect:
		"map":
			for y in H:
				for x in W:
					if Catalog.tile_walkable(tiles[y][x]) or tiles[y][x] == T.DOOR_C or tiles[y][x] == T.DESK or tiles[y][x] == T.SHELF:
						explored[y][x] = true
			_log("The margins fill with a floorplan.")
		"sparks":
			var hits := 0
			for e in entities:
				if int(e.hp) <= 0:
					continue
				if chebyshev(player.x, player.y, e.x, e.y) <= 1:
					e.hp -= 6 + depth
					hits += 1
					if int(e.hp) <= 0:
						_kill(e, "errata of sparks")
			_log("Sparks lick the adjacent tiles (%d caught)." % hits)
			AudioMgr.play("boom")
		"recall":
			player.x = start_pos.x
			player.y = start_pos.y
			_log("The frontispiece yanks you to the first chamber.")
		_:
			_log("The errata fizzles.")
	if phase == Phase.DUNGEON:
		_spend_turn()
	else:
		turn_done.emit()


func carefully_read(index: int) -> void:
	collate(index)


func gamble_read(index: int) -> void:
	crack_spine(index)


func collate(index: int) -> void:
	if index < 0 or index >= inventory.size():
		return
	var it: Dictionary = inventory[index]
	if str(it.kind) != "unid":
		_log("Already known.")
		return
	var res: Dictionary = Catalog.resolve_unidentified(rng, depth, false, str(it.get("quality", "mixed")), false)
	var neu: Dictionary = res.item
	_stamp_uid(neu)
	inventory[index] = neu
	candle = maxi(0, candle - 2)
	last_identify = {"kind": "collate", "name": neu.name, "tell": it.get("tell", ""), "outcome": "identified"}
	_log("Collated. The tell was right enough: it is %s." % neu.name)
	AudioMgr.play("identify")
	if phase == Phase.DUNGEON:
		_spend_turn()
	else:
		turn_done.emit()


func crack_spine(index: int) -> void:
	if index < 0 or index >= inventory.size():
		return
	var it: Dictionary = inventory[index]
	if str(it.kind) != "unid":
		_log("Already known.")
		return
	cracks += 1
	var block := curse_streak >= Catalog.PITY_CURSES
	var res: Dictionary = Catalog.resolve_unidentified(rng, depth, true, str(it.get("quality", "mixed")), block)
	var neu: Dictionary = res.item
	_stamp_uid(neu)
	inventory[index] = neu
	pages += int(res.extra_pages)
	if pages < 0:
		pages = 0
	var outcome := str(res.outcome)
	last_identify = {"kind": "crack", "name": neu.name, "tell": it.get("tell", ""), "outcome": outcome, "pity": block}
	match outcome:
		"flare":
			crack_wins += 1
			curse_streak = 0
			_log("The spine gives. %s. Nearby ink flares." % neu.name)
			AudioMgr.play("boom")
			for e in entities:
				if int(e.hp) <= 0:
					continue
				if chebyshev(player.x, player.y, e.x, e.y) <= 2:
					e.hp -= 4 + depth
					if int(e.hp) <= 0:
						_kill(e, "a cracked spine")
			_track_chance(12 + int(res.extra_pages) * 4, "Crack flare (%s)" % neu.name)
		"curse":
			curse_streak += 1
			player.hp -= int(res.curse_hp)
			_log("Misfile. %s. Glue-smoke (−%d HP). Pity %d/%d." % [neu.name, int(res.curse_hp), curse_streak, Catalog.PITY_CURSES])
			AudioMgr.play("curse")
			_track_chance(-8 - int(res.curse_hp), "Crack misfile")
			if player.hp <= 0:
				cause = "a folio that objected to a cracked spine"
				_end(false)
				return
		_:
			curse_streak = 0
			var pity_note := " Pity held: no third misfile in a row." if block else ""
			_log("The spine was honest: %s.%s" % [neu.name, pity_note])
			AudioMgr.play("identify")
			_track_chance(1, "Crack even (%s)" % neu.name)
	if phase == Phase.DUNGEON:
		_spend_turn()
	else:
		turn_done.emit()


func _player_hit(foe: Dictionary) -> void:
	if miss_turns > 0:
		miss_turns -= 1
		_log("Errata dust: you miss %s." % foe.name)
		AudioMgr.play("miss")
		return
	var atk := player_atk()
	var defn := int(foe.def)
	var chance := clampf(0.72 + float(atk - defn) * 0.05, 0.2, 0.95)
	if rng.randf() > chance:
		_log("You swing %s at %s and miss." % [equipped_tome.get("name", "your notes"), foe.name])
		AudioMgr.play("miss")
		return
	var dmg := maxi(1, atk - defn + rng.randi_range(0, 2))
	var effect := str(equipped_tome.get("effect", "none"))
	if effect == "fire" and rng.randf() < 0.45:
		var extra := rng.randi_range(1, 3)
		dmg += extra
		_log("The cookbook spat grease-fire (+%d)." % extra)
	foe.hp -= dmg
	_log("You hit %s for %d." % [foe.name, dmg])
	AudioMgr.play("hit")
	if effect == "slow" and rng.randf() < 0.45:
		foe.skip = int(foe.get("skip", 0)) + 1
		_log("Defined: %s is delayed." % foe.name)
	if effect == "knock" and rng.randf() < 0.5:
		_knock(foe)
	if effect == "confuse" and rng.randf() < 0.4:
		foe.confuse = int(foe.get("confuse", 0)) + 2
		_log("%s loses the plot." % foe.name)
	if effect == "gold" and rng.randf() < 0.35:
		gold += 1
		_log("The ledger invoices %s for 1 gold." % foe.name)
	if int(foe.hp) <= 0:
		_kill(foe, equipped_tome.get("name", "your notes"))


func _knock(foe: Dictionary) -> void:
	var dx := signi(int(foe.x) - int(player.x))
	var dy := signi(int(foe.y) - int(player.y))
	var nx: int = foe.x + dx
	var ny: int = foe.y + dy
	if is_walkable(nx, ny) and entity_at(nx, ny).is_empty():
		foe.x = nx
		foe.y = ny
		_log("%s is shoved." % foe.name)


func _kill(foe: Dictionary, by: String) -> void:
	kills += 1
	gold += int(foe.get("xp_gold", 2))
	_log("%s dies (%s). You take %d gold." % [foe.name, by, int(foe.get("xp_gold", 2))])
	if rng.randf() < 0.22:
		_drop_at(Vector2i(foe.x, foe.y), Catalog.unidentified(rng))
		_stamp_uid(_top_item(Vector2i(foe.x, foe.y)))
	elif rng.randf() < 0.18:
		_drop_at(Vector2i(foe.x, foe.y), {"kind": "pages_pile", "name": "Loose Pages", "amount": rng.randi_range(1, 2), "sprite": 15})
	entities.erase(foe)


func _spend_turn() -> void:
	if not run_active:
		return
	turn += 1
	_tick_candle()
	_recompute_fov()
	if not run_active:
		return
	_enemies_act()
	_recompute_fov()
	if run_active and int(player.hp) <= 0:
		if cause == "":
			cause = "unspecified scholarly injury"
		_end(false)
		return
	look_name = _look_tile(player.x, player.y)
	turn_done.emit()


func _tick_candle() -> void:
	var every := 3
	if depth >= 4:
		every = 2
	wax_acc += 1
	if wax_acc >= every:
		wax_acc = 0
		candle -= 1
		if candle == 10:
			_log("The candle is a stub. Wax pools on the floor.")
		if candle <= 0:
			candle = 0
			player.hp -= 1
			_log("The candle dies to a nub. You take 1 in the dark.")
			if int(player.hp) <= 0:
				cause = "lost the last of the candle"
				_end(false)


func _enemies_act() -> void:
	# Copy because kills mutate the array.
	var snap: Array = entities.duplicate()
	for e in snap:
		if not run_active:
			return
		if not entities.has(e) or int(e.hp) <= 0:
			continue
		if int(e.get("skip", 0)) > 0:
			e.skip = int(e.skip) - 1
			continue
		if int(e.get("confuse", 0)) > 0:
			e.confuse = int(e.confuse) - 1
			_step_random(e)
			continue
		if not _can_see_player(e) and not bool(e.get("seen_player", false)):
			if str(e.ai) == "thief":
				continue
			if rng.randf() < 0.35:
				_step_random(e)
			continue
		e.seen_player = true
		match str(e.ai):
			"rush":
				_step_toward(e)
			"ranged":
				_ai_ranged(e)
			"tank":
				e.cooldown = int(e.get("cooldown", 0)) + 1
				if int(e.cooldown) % 2 == 1:
					_step_toward(e)
			"thief":
				_ai_thief(e)
			"errata":
				_ai_errata(e)
			_:
				_step_toward(e)


func _can_see_player(e: Dictionary) -> bool:
	var d := chebyshev(e.x, e.y, player.x, player.y)
	if d > Catalog.FOV_R + 1:
		return false
	return _los(e.x, e.y, player.x, player.y)


func _los(x0: int, y0: int, x1: int, y1: int) -> bool:
	var dx := absi(x1 - x0)
	var dy := -absi(y1 - y0)
	var sx := 1 if x0 < x1 else -1
	var sy := 1 if y0 < y1 else -1
	var err := dx + dy
	var x := x0
	var y := y0
	while true:
		if x == x1 and y == y1:
			return true
		if not (x == x0 and y == y0):
			if not in_bounds(x, y):
				return false
			if not Catalog.tile_transparent(tiles[y][x]):
				return false
		var e2 := 2 * err
		if e2 >= dy:
			err += dy
			x += sx
		if e2 <= dx:
			err += dx
			y += sy
	return false


func _ai_ranged(e: Dictionary) -> void:
	var d := chebyshev(e.x, e.y, player.x, player.y)
	if d == 1:
		_monster_hit(e)
		return
	if d >= int(e.range_min) and d <= int(e.range_max) and _los(e.x, e.y, player.x, player.y):
		if rng.randf() < 0.72:
			var dmg := maxi(1, int(e.atk) - player_def())
			player.hp -= dmg
			_log("%s spat ink for %d." % [e.name, dmg])
			AudioMgr.play("hit")
			if int(player.hp) <= 0:
				cause = "inked to death by an Inkblot"
		else:
			_log("%s spat ink and missed." % e.name)
			AudioMgr.play("miss")
		return
	if d < int(e.range_min):
		_step_away(e)
	else:
		_step_toward(e)


func _ai_thief(e: Dictionary) -> void:
	var d := chebyshev(e.x, e.y, player.x, player.y)
	if float(e.hp) / float(e.hp_max) < 0.4:
		_step_away(e)
		return
	if d == 1:
		if rng.randf() < 0.55 and (gold > 0 or pages > 0):
			if gold >= 3 and rng.randf() < 0.6:
				var steal := mini(gold, rng.randi_range(2, 6))
				gold -= steal
				_log("%s lifts %d gold and slips toward the stacks." % [e.name, steal])
			elif pages > 0:
				pages -= 1
				_log("%s steals a page.")
			AudioMgr.play("page")
			_step_away(e)
		else:
			_monster_hit(e)
		return
	_step_toward(e)


func _ai_errata(e: Dictionary) -> void:
	var d := chebyshev(e.x, e.y, player.x, player.y)
	if d == 1:
		if rng.randf() < 0.5:
			miss_turns = maxi(miss_turns, 3)
			_log("%s dusts you with errata. Your next swings may miss." % e.name)
			AudioMgr.play("curse")
		else:
			_monster_hit(e)
		return
	_step_toward(e)


func _monster_hit(e: Dictionary) -> void:
	var chance := clampf(0.65 + float(int(e.atk) - player_def()) * 0.05, 0.2, 0.92)
	if rng.randf() > chance:
		_log("%s misses you." % e.name)
		AudioMgr.play("miss")
		return
	var dmg := maxi(1, int(e.atk) - player_def() + rng.randi_range(0, 1))
	player.hp -= dmg
	_log("%s hits you for %d." % [e.name, dmg])
	AudioMgr.play("hit")
	if int(player.hp) <= 0:
		cause = "slain by %s" % e.name


func _step_toward(e: Dictionary) -> void:
	var step := _best_step(e, player.x, player.y, false)
	if step == Vector2i.ZERO:
		if chebyshev(e.x, e.y, player.x, player.y) == 1:
			_monster_hit(e)
		return
	var nx: int = e.x + step.x
	var ny: int = e.y + step.y
	if nx == player.x and ny == player.y:
		_monster_hit(e)
		return
	if is_walkable(nx, ny) and entity_at(nx, ny).is_empty():
		e.x = nx
		e.y = ny


func _step_away(e: Dictionary) -> void:
	var step := _best_step(e, player.x, player.y, true)
	var nx: int = e.x + step.x
	var ny: int = e.y + step.y
	if step != Vector2i.ZERO and is_walkable(nx, ny) and entity_at(nx, ny).is_empty():
		e.x = nx
		e.y = ny
	elif chebyshev(e.x, e.y, player.x, player.y) == 1:
		_monster_hit(e)


func _step_random(e: Dictionary) -> void:
	var dirs := _dirs()
	dirs.shuffle()
	for d in dirs:
		var nx: int = e.x + d.x
		var ny: int = e.y + d.y
		if is_walkable(nx, ny) and entity_at(nx, ny).is_empty():
			e.x = nx
			e.y = ny
			return


func _best_step(e: Dictionary, tx: int, ty: int, away: bool) -> Vector2i:
	var best := Vector2i.ZERO
	var best_score := -9999 if away else 9999
	for d in _dirs():
		var nx: int = e.x + d.x
		var ny: int = e.y + d.y
		if nx == player.x and ny == player.y and not away:
			return d
		if not is_walkable(nx, ny):
			continue
		if not entity_at(nx, ny).is_empty():
			continue
		var score := chebyshev(nx, ny, tx, ty)
		if away:
			if score > best_score:
				best_score = score
				best = d
		else:
			if score < best_score:
				best_score = score
				best = d
	return best


func _dirs() -> Array:
	return [
		Vector2i(1, 0), Vector2i(-1, 0), Vector2i(0, 1), Vector2i(0, -1),
		Vector2i(1, 1), Vector2i(1, -1), Vector2i(-1, 1), Vector2i(-1, -1)
	]


static func chebyshev(x0: int, y0: int, x1: int, y1: int) -> int:
	return maxi(absi(x1 - x0), absi(y1 - y0))


func _look_tile(x: int, y: int) -> String:
	if not in_bounds(x, y):
		return ""
	if not explored[y][x]:
		return "darkness"
	var e := entity_at(x, y)
	if not e.is_empty() and not e.get("is_player", false) and visible[y][x]:
		return e.name
	if items_at.has(Vector2i(x, y)) and (items_at[Vector2i(x, y)] as Array).size() > 0:
		return str((items_at[Vector2i(x, y)] as Array)[0].name)
	match int(tiles[y][x]):
		T.WALL, T.VOID:
			return "wall"
		T.DOOR_C:
			return "closed door"
		T.DOOR_O:
			return "open door"
		T.STAIRS_D:
			return "stairs down"
		T.STAIRS_U:
			return "stairs up"
		T.FELT:
			return "reading-room floor"
		T.DESK:
			return "returns counter"
		T.EXIT:
			return "Binding Exit"
		T.SHELF:
			return "bookshelf"
		_:
			return "stone floor"


func tile_seen(x: int, y: int) -> bool:
	if not in_bounds(x, y):
		return false
	return bool(explored[y][x])


func tile_vis(x: int, y: int) -> bool:
	if not in_bounds(x, y):
		return false
	return bool(visible[y][x])


func _win() -> void:
	won = true
	cause = "returned the Notable Folio"
	AudioMgr.play("win")
	_log("You step through the Binding Exit with the Notable Folio. The true First Edition can wait.")
	_end(true)


func _end(victory: bool) -> void:
	if not run_active:
		return
	run_active = false
	won = victory
	phase = Phase.RECAP
	if not victory:
		AudioMgr.play("death")
		if cause == "":
			cause = "died in the stacks"
	var entry := recap()
	Persist.add_entry(entry)
	recap_ready.emit()
	run_ended.emit()


func recap() -> Dictionary:
	return {
		"when": Time.get_datetime_string_from_system(true, true),
		"outcome": "escaped" if won else "died",
		"cause": cause,
		"depth": depth,
		"kills": kills,
		"gold": gold,
		"pages": pages,
		"turns": turn,
		"cracks": cracks,
		"crack_wins": crack_wins,
		"biggest_win": "%s (%d)" % [biggest_win.desc, biggest_win.value],
		"biggest_loss": "%s (%d)" % [biggest_loss.desc, biggest_loss.value],
		"seed": seed_used,
	}


func _shuffle(arr: Array) -> void:
	for i in range(arr.size() - 1, 0, -1):
		var j := rng.randi_range(0, i)
		var tmp = arr[i]
		arr[i] = arr[j]
		arr[j] = tmp


func is_floor_connected() -> bool:
	if tiles.is_empty() or player.is_empty():
		return false
	return MapGen._reachable(tiles, int(player.x), int(player.y), stairs_pos.x, stairs_pos.y)


func log_msg(text: String) -> void:
	_log(text)


func hud_line() -> String:
	var tome := str(equipped_tome.get("name", "none"))
	var bind := str(equipped_binding.get("name", "none"))
	return "HP %d/%d   Depth %d   Gold %d   Pages %d   Candle %d   ATK %d  DEF %d" % [
		int(player.get("hp", 0)), int(player.get("hp_max", 0)), depth, gold, pages, candle, player_atk(), player_def()
	] + "\nTome: %s   Binding: %s" % [tome, bind]
