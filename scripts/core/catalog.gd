class_name Catalog
extends RefCounted

## v0.1 tables. Ten folio identities. One enemy family (booklice). No casino copy.

const PITY_CURSES := 2
const STAGE_SECS := 720.0
const SURGE_AT := 600.0
const MAX_WEAPONS := 6
const MAX_PASSIVES := 3
const ARENA := 2000.0
const FOLIO_COST := 5
const NEXT_FOLIO_CAP := 2

enum Pickup { GEM, GOLD, BISCUIT, FOLIO }


static func identity_count() -> int:
	return tome_defs().size() + passive_defs().size() + 1


static func tome_defs() -> Array:
	return [
		{
			"pattern": "notes",
			"name": "Margin Notes",
			"effect": "dart",
			"desc": "Paper darts the way you last stepped.",
			"atk": 8,
			"cd": 0.55,
			"sprite": 8,
		},
		{
			"pattern": "cookbook",
			"name": "Charred Cookbook",
			"effect": "fire",
			"desc": "A cone of grease-fire from the page.",
			"atk": 11,
			"cd": 1.05,
			"sprite": 8,
		},
		{
			"pattern": "dictionary",
			"name": "Pocket Dictionary",
			"effect": "slow",
			"desc": "A defining pulse. Named things hesitate.",
			"atk": 7,
			"cd": 1.35,
			"sprite": 9,
		},
		{
			"pattern": "atlas",
			"name": "Pocket Atlas",
			"effect": "orbit",
			"desc": "Pages orbit and shove.",
			"atk": 6,
			"cd": 0.0,
			"sprite": 10,
		},
		{
			"pattern": "hymnal",
			"name": "Hymnal of Errata",
			"effect": "knock",
			"desc": "A wide page of knockback.",
			"atk": 9,
			"cd": 1.55,
			"sprite": 11,
		},
		{
			"pattern": "ledger",
			"name": "Ledger of Debts",
			"effect": "seek",
			"desc": "Seeking entries. Fees cling to the wounded.",
			"atk": 8,
			"cd": 0.95,
			"sprite": 11,
		},
	]


static func passive_defs() -> Array:
	return [
		{
			"pattern": "bookmark",
			"name": "Silk Bookmark",
			"effect": "magnet",
			"desc": "Loose leaves snap toward you.",
			"sprite": 13,
		},
		{
			"pattern": "cloth",
			"name": "Cloth Cover",
			"effect": "hp",
			"desc": "A soft jacket. More tuber to bruise.",
			"sprite": 13,
		},
		{
			"pattern": "clasps",
			"name": "Iron Clasps",
			"effect": "armor",
			"desc": "The book stays shut. So do you.",
			"sprite": 13,
		},
	]


static func def_by_pattern(pattern: String) -> Dictionary:
	for d in tome_defs():
		if str(d.pattern) == pattern:
			return (d as Dictionary).duplicate(true)
	for d in passive_defs():
		if str(d.pattern) == pattern:
			return (d as Dictionary).duplicate(true)
	return {}


static func _base_item() -> Dictionary:
	return {
		"uid": 0,
		"kind": "",
		"name": "",
		"true_name": "",
		"identified": true,
		"cursed": false,
		"pattern": "",
		"atk": 0,
		"cd": 0.8,
		"effect": "none",
		"desc": "",
		"sprite": 14,
		"value_gold": 0,
		"rarity": "common",
		"quality": "mixed",
		"tell": "",
		"shelf": "",
	}


static func make_tome(pattern: String, rare: bool = false) -> Dictionary:
	var d := def_by_pattern(pattern)
	if d.is_empty() or not d.has("atk"):
		d = def_by_pattern("notes")
	var it := _base_item()
	it.kind = "tome"
	it.pattern = str(d.pattern)
	it.name = str(d.name)
	it.true_name = it.name
	it.atk = int(d.atk)
	it.cd = float(d.cd)
	it.effect = str(d.effect)
	it.desc = str(d.desc)
	it.sprite = int(d.sprite)
	it.value_gold = 10 + int(d.atk)
	if rare:
		it.rarity = "rare"
		it.name = "Noted " + str(it.name)
		it.true_name = it.name
		it.atk = int(it.atk) + 3
	return it


static func make_passive(pattern: String, rare: bool = false) -> Dictionary:
	var d := def_by_pattern(pattern)
	if d.is_empty() or d.has("atk"):
		d = def_by_pattern("bookmark")
	var it := _base_item()
	it.kind = "passive"
	it.pattern = str(d.pattern)
	it.name = str(d.name)
	it.true_name = it.name
	it.effect = str(d.effect)
	it.desc = str(d.desc)
	it.sprite = int(d.sprite)
	it.value_gold = 8
	if rare:
		it.rarity = "rare"
		it.name = "Noted " + str(it.name)
		it.true_name = it.name
	return it


static func starter_tome() -> Dictionary:
	return make_tome("notes", false)


static func cursed_folio() -> Dictionary:
	var it := _base_item()
	it.kind = "curse"
	it.pattern = "curse"
	it.name = "Cursed Errata"
	it.true_name = it.name
	it.cursed = true
	it.identified = true
	it.desc = "The page is a curse."
	it.sprite = 12
	it.value_gold = 1
	return it


static func unidentified(rng: RandomNumberGenerator, shelf_id: String = "") -> Dictionary:
	var it := _base_item()
	it.kind = "unid"
	it.name = "Unidentified Folio"
	it.true_name = "Unidentified Folio"
	it.identified = false
	it.sprite = 14
	it.shelf = shelf_id
	it.value_gold = 16
	var q := rng.randf()
	if q < 0.28:
		it.quality = "sour"
	elif q > 0.72:
		it.quality = "promising"
	else:
		it.quality = "mixed"
	it.tell = _tell_for(rng, str(it.quality))
	it.desc = "Tell: \"%s\"" % it.tell
	return it


static func _tell_for(rng: RandomNumberGenerator, quality: String) -> String:
	var sour := ["The glue smells of vinegar.", "The boards warp inward.", "A stain like old tea, or worse."]
	var mixed := ["A ribbon marks a page.", "The boards are scuffed.", "Someone dog-eared chapter two."]
	var promising := ["The stitching is tight.", "A gold thread in the spine.", "The ink still smells of citrus."]
	var pool: Array = mixed
	match quality:
		"sour":
			pool = sour
		"promising":
			pool = promising
	return str(pool[rng.randi_range(0, pool.size() - 1)])


static func _is_tome_pattern(pattern: String) -> bool:
	for d in tome_defs():
		if str(d.pattern) == pattern:
			return true
	return false


static func patterns_for_shelf(shelf_id: String) -> Array:
	match shelf_id:
		"cookery":
			return ["cookbook", "notes"]
		"reference":
			return ["dictionary", "bookmark"]
		"maps":
			return ["atlas", "clasps"]
		"accounts":
			return ["ledger", "cloth"]
		_:
			return ["hymnal", "cookbook", "dictionary"]


static func random_edition(rng: RandomNumberGenerator, shelf_id: String, rare: bool) -> Dictionary:
	var pats: Array = patterns_for_shelf(shelf_id)
	var pattern := str(pats[rng.randi_range(0, pats.size() - 1)])
	if _is_tome_pattern(pattern):
		return make_tome(pattern, rare)
	return make_passive(pattern, rare)


static func resolve_unidentified(rng: RandomNumberGenerator, crack: bool, quality: String, block_curse: bool, shelf_id: String) -> Dictionary:
	var outcome := "normal"
	if crack:
		var r := rng.randf()
		match quality:
			"promising":
				if r < 0.55:
					outcome = "strong"
				elif r < 0.88:
					outcome = "normal"
				else:
					outcome = "curse"
			"sour":
				if r < 0.12:
					outcome = "strong"
				elif r < 0.42:
					outcome = "normal"
				else:
					outcome = "curse"
			_:
				if r < 0.28:
					outcome = "strong"
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
	var curse_hp := 0
	match outcome:
		"strong":
			item = random_edition(rng, shelf_id, true)
			extra_pages = rng.randi_range(1, 2)
		"curse":
			item = cursed_folio()
			curse_hp = rng.randi_range(8, 16)
		"normal_good":
			item = random_edition(rng, shelf_id, true)
		_:
			item = random_edition(rng, shelf_id, false)
	item.identified = true
	return {"item": item, "outcome": outcome, "extra_pages": extra_pages, "curse_hp": curse_hp}


static func enemy_kinds() -> Array:
	return ["nymph", "adult", "winged", "overdue"]


static func enemy_template(kind: String, wave: float) -> Dictionary:
	var w := maxf(1.0, wave)
	var e := {
		"id": 0,
		"kind": kind,
		"name": "Booklouse",
		"pos": Vector2.ZERO,
		"hp": 10.0,
		"hp_max": 10.0,
		"atk": 7.0,
		"speed": 80.0,
		"radius": 11.0,
		"ai": "rush",
		"sprite": 2,
		"slow_t": 0.0,
		"xp": 1,
		"gold": 0,
		"elite": false,
	}
	match kind:
		"nymph":
			e.name = "Booklouse Nymph"
			e.hp = 8.0 + w * 2.4
			e.atk = 6.0 + w * 0.45
			e.speed = 96.0 + w * 1.8
			e.radius = 10.0
			e.sprite = 2
			e.xp = 1
		"adult":
			e.name = "Booklouse"
			e.hp = 16.0 + w * 4.0
			e.atk = 9.0 + w * 0.7
			e.speed = 62.0
			e.radius = 14.0
			e.sprite = 2
			e.xp = 2
			e.gold = 1
		"winged":
			e.name = "Winged Booklouse"
			e.hp = 11.0 + w * 2.8
			e.atk = 7.0 + w * 0.5
			e.speed = 108.0
			e.radius = 11.0
			e.ai = "errata"
			e.sprite = 7
			e.xp = 2
		_:
			e.kind = "overdue"
			e.name = "Overdue Brood"
			e.hp = 380.0 + w * 36.0
			e.atk = 15.0
			e.speed = 46.0
			e.radius = 22.0
			e.sprite = 4
			e.xp = 10
			e.gold = 6
			e.elite = true
	e.hp_max = e.hp
	return e


static func pick_enemy_kind(rng: RandomNumberGenerator, elapsed: float) -> String:
	var adult_w := 0.3 + minf(elapsed / 100.0, 1.8)
	var wing_w := 0.0 + minf(maxf(elapsed - 70.0, 0.0) / 90.0, 1.6)
	var total := 3.2 + adult_w + wing_w
	var r := rng.randf() * total
	if r < 3.2:
		return "nymph"
	if r < 3.2 + adult_w:
		return "adult"
	return "winged"


static func xp_to_next(player_level: int) -> int:
	return 8 + player_level * 5 + (player_level * player_level) / 2


static func librarian_pity_line(streak: int) -> String:
	if streak >= PITY_CURSES:
		return "The librarian will not let a third misfile stand."
	if streak == 1:
		return "The librarian frowns at the last misfile."
	return "Collate is the careful path. Crack opens the page as it is."
