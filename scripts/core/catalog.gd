class_name Catalog
extends RefCounted

## Item, enemy, and edition tables for Bookish Potato: The First Edition (v0.1).

const DEPTHS := 5
const PITY_CURSES := 2
const MAP_W := 52
const MAP_H := 34
const FOV_R := 8
const INV_CAP := 18

enum Tile {
	VOID,
	WALL,
	FLOOR,
	DOOR_C,
	DOOR_O,
	STAIRS_D,
	STAIRS_U,
	FELT,
	DESK,
	EXIT,
	SHELF,
}


static func tile_walkable(t: int) -> bool:
	return t == Tile.FLOOR or t == Tile.DOOR_O or t == Tile.STAIRS_D or t == Tile.STAIRS_U or t == Tile.FELT or t == Tile.EXIT


static func tile_transparent(t: int) -> bool:
	return t == Tile.FLOOR or t == Tile.DOOR_O or t == Tile.STAIRS_D or t == Tile.STAIRS_U or t == Tile.FELT or t == Tile.EXIT or t == Tile.DESK


static func tile_atlas(t: int, variant: int = 0) -> int:
	match t:
		Tile.VOID:
			return 0
		Tile.WALL:
			return 1 if variant == 0 else 2
		Tile.FLOOR:
			return 3 if variant == 0 else 4
		Tile.DOOR_C:
			return 6
		Tile.DOOR_O:
			return 7
		Tile.STAIRS_D:
			return 8
		Tile.STAIRS_U:
			return 9
		Tile.FELT:
			return 10
		Tile.DESK:
			return 11
		Tile.EXIT:
			return 12
		Tile.SHELF:
			return 13
	return 0


static func starter_tome() -> Dictionary:
	return _tome("Margin Notes", 2, 0, "none", "A heavily annotated pamphlet. Barely a weapon, but it is yours.", 8, false)


static func starter_binding() -> Dictionary:
	return _binding("Cloth Cover", 1, "A soft jacket that still smells of starch.", 0, false)


static func _base_item() -> Dictionary:
	return {
		"uid": 0,
		"kind": "",
		"name": "",
		"true_name": "",
		"identified": true,
		"cursed": false,
		"atk": 0,
		"def": 0,
		"effect": "none",
		"desc": "",
		"sprite": 14,
		"value_gold": 0,
		"heal": 0,
		"food": 0,
		"wax": 0,
		"rarity": "common",
		"quality": "mixed",
		"tell": "",
	}


static func _tome(item_name: String, atk: int, _def: int, effect: String, desc: String, sprite: int, cursed: bool) -> Dictionary:
	var it := _base_item()
	it.kind = "tome"
	it.name = item_name
	it.true_name = item_name
	it.atk = atk
	it.effect = effect
	it.desc = desc
	it.sprite = sprite
	it.cursed = cursed
	it.value_gold = 8 + atk * 6
	if cursed:
		it.value_gold = 2
	return it


static func _binding(item_name: String, defn: int, desc: String, sprite: int, cursed: bool) -> Dictionary:
	var it := _base_item()
	it.kind = "binding"
	it.name = item_name
	it.true_name = item_name
	it.def = defn
	it.desc = desc
	it.sprite = sprite
	it.cursed = cursed
	it.value_gold = 6 + defn * 8
	return it


static func potion_starch() -> Dictionary:
	var it := _base_item()
	it.kind = "potion"
	it.name = "Jar of Cold Mash"
	it.true_name = it.name
	it.effect = "food"
	it.food = 36
	it.heal = 2
	it.wax = 36
	it.desc = "Yesterday's potatoes, which is either poetry or cannibalism."
	it.sprite = 13
	it.value_gold = 8
	return it


static func potion_ink() -> Dictionary:
	var it := _base_item()
	it.kind = "potion"
	it.name = "Ink Tonic"
	it.true_name = it.name
	it.effect = "heal"
	it.heal = 14
	it.desc = "Tastes like a fountain pen. Knits tuber-flesh anyway."
	it.sprite = 13
	it.value_gold = 12
	return it


static func potion_tea() -> Dictionary:
	var it := _base_item()
	it.kind = "potion"
	it.name = "Librarian's Tea"
	it.true_name = it.name
	it.effect = "tea"
	it.heal = 7
	it.wax = 14
	it.desc = "Steeped too long. Perfectly judgmental."
	it.sprite = 13
	it.value_gold = 10
	return it


static func scroll_map() -> Dictionary:
	var it := _base_item()
	it.kind = "scroll"
	it.name = "Errata of Mapping"
	it.true_name = it.name
	it.effect = "map"
	it.desc = "Corrects the floorplan in the margins. Explored tiles flood in."
	it.sprite = 17
	it.value_gold = 16
	return it


static func scroll_sparks() -> Dictionary:
	var it := _base_item()
	it.kind = "scroll"
	it.name = "Errata of Sparks"
	it.true_name = it.name
	it.effect = "sparks"
	it.desc = "A footnote that catches fire in a 1-tile radius."
	it.sprite = 17
	it.value_gold = 18
	return it


static func scroll_recall() -> Dictionary:
	var it := _base_item()
	it.kind = "scroll"
	it.name = "Errata of the Frontispiece"
	it.true_name = it.name
	it.effect = "recall"
	it.desc = "Returns you to this floor's first chamber."
	it.sprite = 17
	it.value_gold = 14
	return it


static func unidentified(rng: RandomNumberGenerator) -> Dictionary:
	var it := _base_item()
	it.kind = "unid"
	it.name = "Unidentified Folio"
	it.true_name = "Unidentified Folio"
	it.identified = false
	it.sprite = 14
	it.value_gold = 20
	var q := rng.randf()
	if q < 0.28:
		it.quality = "sour"
	elif q > 0.72:
		it.quality = "promising"
	else:
		it.quality = "mixed"
	it.tell = _tell_for(rng, str(it.quality))
	it.desc = "Unknown edition. Librarian's tell: \"%s\"" % it.tell
	return it


static func _tell_for(rng: RandomNumberGenerator, quality: String) -> String:
	var sour := [
		"The glue smells of vinegar.",
		"The boards warp inward.",
		"A stain like old tea, or worse.",
	]
	var mixed := [
		"A ribbon marks a page.",
		"The boards are scuffed.",
		"Someone dog-eared chapter two.",
	]
	var promising := [
		"The stitching is tight.",
		"A gold thread in the spine.",
		"The ink still smells of citrus.",
	]
	var pool: Array = mixed
	match quality:
		"sour":
			pool = sour
		"promising":
			pool = promising
	return str(pool[rng.randi_range(0, pool.size() - 1)])


static func notable_folio() -> Dictionary:
	var it := _base_item()
	it.kind = "first"
	it.name = "The Notable Folio"
	it.true_name = it.name
	it.desc = "A working copy the stacks should not have lost. The true First Edition is a later descent."
	it.sprite = 15
	it.value_gold = 0
	it.rarity = "unique"
	return it


static func cursed_folio() -> Dictionary:
	var it := _tome("Cursed Errata", 0, 0, "curse", "The footnotes bite. Equipping it is unwise; dropping it is a relief.", 12, true)
	it.atk = 1
	it.def = -1
	return it


static func random_identified_loot(rng: RandomNumberGenerator, depth: int, rare: bool = false) -> Dictionary:
	var roll := rng.randf()
	if rare:
		roll = minf(roll + 0.35, 0.99)
	if roll < 0.22:
		return potion_for_depth(rng, depth)
	if roll < 0.34:
		return scroll_for_depth(rng)
	if roll < 0.62:
		return random_tome(rng, depth, rare)
	if roll < 0.82:
		return random_binding(rng, depth, rare)
	return unidentified(rng)


static func potion_for_depth(rng: RandomNumberGenerator, _depth: int) -> Dictionary:
	var r := rng.randf()
	if r < 0.4:
		return potion_starch()
	if r < 0.75:
		return potion_ink()
	return potion_tea()


static func scroll_for_depth(rng: RandomNumberGenerator) -> Dictionary:
	var r := rng.randf()
	if r < 0.4:
		return scroll_map()
	if r < 0.75:
		return scroll_sparks()
	return scroll_recall()


static func random_tome(rng: RandomNumberGenerator, depth: int, rare: bool) -> Dictionary:
	var bonus := (depth / 3) + (2 if rare else 0)
	var table: Array = [
		_tome("Charred Cookbook", 3 + bonus, 0, "fire", "Grease-fire recipes. Hits sometimes flare.", 8, false),
		_tome("Pocket Dictionary", 2 + bonus, 0, "slow", "To be named is to be delayed. Hits may skip a foe's turn.", 9, false),
		_tome("Pocket Atlas", 2 + bonus, 0, "knock", "Geography with opinions. Hits may shove a foe.", 10, false),
		_tome("Hymnal of Errata", 3 + bonus, 0, "confuse", "Wrong words, loudly. Hits may send a foe wandering.", 11, false),
		_tome("Ledger of Debts", 2 + bonus, 0, "gold", "Each wound collects a coin. Hits may mint gold.", 11, false),
		_tome("Margin Notes", 1 + bonus, 0, "none", "Still just notes. Honest, at least.", 8, false),
	]
	if rare:
		table.append(_tome("Annotated Cookbook", 5 + bonus, 0, "fire", "The deluxe grease-fire. Boomier.", 8, false))
		table.append(_tome("Unabridged Dictionary", 3 + bonus, 0, "slow", "Definitions at length. Often stalls a foe.", 9, false))
	return (table[rng.randi_range(0, table.size() - 1)] as Dictionary).duplicate(true)


static func random_binding(rng: RandomNumberGenerator, depth: int, rare: bool) -> Dictionary:
	var bonus := (depth / 4) + (1 if rare else 0)
	var table: Array = [
		_binding("Cloth Cover", 1 + bonus, "A soft jacket. Better than skin.", 0, false),
		_binding("Board Binding", 2 + bonus, "Pasteboard and stubbornness.", 0, false),
		_binding("Iron Clasps", 3 + bonus, "The book stays shut. So do you.", 0, false),
	]
	if rare:
		table.append(_binding("Errata Plates", 4 + bonus, "Lead type, worn as armor. Heavy footnotes.", 0, false))
	return (table[rng.randi_range(0, table.size() - 1)] as Dictionary).duplicate(true)


static func resolve_unidentified(rng: RandomNumberGenerator, depth: int, crack: bool, quality: String, block_curse: bool) -> Dictionary:
	## Collate (crack=false) is honest to quality. Crack is weighted; pity can forbid a curse.
	var outcome := "normal"
	if crack:
		var r := rng.randf()
		match quality:
			"promising":
				if r < 0.55:
					outcome = "flare"
				elif r < 0.88:
					outcome = "normal"
				else:
					outcome = "curse"
			"sour":
				if r < 0.12:
					outcome = "flare"
				elif r < 0.42:
					outcome = "normal"
				else:
					outcome = "curse"
			_:
				if r < 0.28:
					outcome = "flare"
				elif r < 0.72:
					outcome = "normal"
				else:
					outcome = "curse"
		if block_curse and outcome == "curse":
			outcome = "normal"
	else:
		match quality:
			"promising":
				outcome = "normal_good"
			"sour":
				outcome = "curse"
			_:
				outcome = "normal"
	var item: Dictionary
	var extra_pages := 0
	var boom := false
	var curse_hp := 0
	match outcome:
		"flare":
			item = random_identified_loot(rng, depth, true)
			if item.kind == "unid":
				item = random_tome(rng, depth, true)
			item.rarity = "rare"
			item.name = "Noted " + str(item.name)
			item.true_name = item.name
			item.identified = true
			if item.kind == "tome":
				item.atk += 1
			extra_pages = rng.randi_range(2, 4)
			boom = true
		"curse":
			item = cursed_folio()
			item.identified = true
			curse_hp = rng.randi_range(3, 7)
			extra_pages = -rng.randi_range(0, 2)
		"normal_good":
			item = random_tome(rng, depth, true)
			item.identified = true
		_:
			item = random_identified_loot(rng, depth, false)
			if item.kind == "unid":
				item = random_tome(rng, depth, false)
			item.identified = true
	item.identified = true
	if item.name == "Unidentified Folio":
		item.name = item.true_name
	return {"item": item, "outcome": outcome, "extra_pages": extra_pages, "boom": boom, "curse_hp": curse_hp}


static func enemy_kinds() -> Array:
	return ["bookworm", "inkblot", "golem", "thief", "errata"]


static func enemy_template(kind: String, depth: int) -> Dictionary:
	var d := maxi(1, depth)
	var e := {
		"id": 0,
		"kind": kind,
		"name": "",
		"x": 0,
		"y": 0,
		"hp": 8,
		"hp_max": 8,
		"atk": 2,
		"def": 0,
		"ai": "rush",
		"sprite": 2,
		"is_player": false,
		"skip": 0,
		"slow": 0,
		"confuse": 0,
		"cooldown": 0,
		"ranged": false,
		"range_min": 2,
		"range_max": 6,
		"steal": false,
		"ambush": false,
		"seen_player": false,
		"blurb": "",
		"odds": 2.0,
		"bet_stake": 0,
		"bet_odds": 0.0,
		"xp_gold": 2,
	}
	match kind:
		"bookworm":
			e.name = "Bookworm"
			e.hp = 6 + d * 2
			e.atk = 2 + d / 3
			e.def = 0
			e.ai = "rush"
			e.sprite = 2
			e.blurb = "A pink segmented pest that reads with its whole body. Fast, unsubtle, poorly cited."
			e.odds = 1.6
			e.xp_gold = 2 + d
		"inkblot":
			e.name = "Inkblot"
			e.hp = 7 + d * 2
			e.atk = 2 + d / 4
			e.def = 0
			e.ai = "ranged"
			e.sprite = 3
			e.ranged = true
			e.blurb = "A Rorschach with ambition. Prefers to spit from the margins rather than close."
			e.odds = 2.0
			e.xp_gold = 3 + d
		"golem":
			e.name = "Codex Golem"
			e.hp = 14 + d * 3
			e.atk = 3 + d / 2
			e.def = 1 + d / 5
			e.ai = "tank"
			e.sprite = 4
			e.blurb = "Bound in stone and patience. Moves like a due date: rarely, then all at once."
			e.odds = 2.4
			e.xp_gold = 5 + d
		"thief":
			e.name = "Page Thief"
			e.hp = 5 + d * 2
			e.atk = 1 + d / 4
			e.def = 0
			e.ai = "thief"
			e.sprite = 5
			e.steal = true
			e.ambush = true
			e.blurb = "Paper folded into a pickpocket. Will quote you, then invoice you."
			e.odds = 3.0
			e.xp_gold = 4 + d
		_:
			e.kind = "errata"
			e.name = "Errata Moth"
			e.hp = 8 + d * 2
			e.atk = 2 + d / 3
			e.def = 0
			e.ai = "errata"
			e.sprite = 7
			e.blurb = "A flutter of corrections. Its dust makes your next swing miss the point."
			e.odds = 2.2
			e.xp_gold = 4 + d
	e.hp_max = e.hp
	return e


static func pick_enemy_kind(rng: RandomNumberGenerator, depth: int) -> String:
	var weights := {
		"bookworm": 3.0,
		"inkblot": 1.4 if depth >= 2 else 0.4,
		"golem": 1.2 if depth >= 3 else 0.2,
		"thief": 1.3 if depth >= 2 else 0.3,
		"errata": 1.0 if depth >= 4 else 0.0,
	}
	var total := 0.0
	for k in weights:
		total += float(weights[k])
	var r := rng.randf() * total
	for k in weights:
		r -= float(weights[k])
		if r <= 0.0:
			return str(k)
	return "bookworm"
