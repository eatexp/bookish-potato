class_name Catalog
extends RefCounted

## v0.1: six tomes, four passives, two curses. Curses never sit on the 3-pick.

const PITY_CURSES := 2
const STAGE_SECS := 720.0
const SURGE_AT := 600.0
const MAX_WEAPONS := 6
const MAX_PASSIVES := 4
const HORDE_CAP := 300
const HORDE_SOFT := 200
const ARENA := 2000.0
const FOLIO_COST := 5
const NEXT_FOLIO_CAP := 3
const FAR_PX := 200.0

enum Pickup { GEM, GOLD, BISCUIT, FOLIO }


static func identity_count() -> int:
	return tome_defs().size() + passive_defs().size() + curse_defs().size()


static func tome_defs() -> Array:
	return [
		{
			"pattern": "primer",
			"name": "Primer",
			"effect": "darts",
			"desc": "Small glyphs. Paper darts in the way you face.",
			"atk": 8,
			"cd": 0.48,
			"sprite": 8,
		},
		{
			"pattern": "cookbook",
			"name": "Cookbook",
			"effect": "nova",
			"desc": "Close fire cones. A recipe nova.",
			"atk": 10,
			"cd": 0.72,
			"sprite": 8,
		},
		{
			"pattern": "dictionary",
			"name": "Dictionary",
			"effect": "define",
			"desc": "A slow pulse. Define.",
			"atk": 7,
			"cd": 1.45,
			"sprite": 9,
		},
		{
			"pattern": "atlas",
			"name": "Atlas",
			"effect": "orbit",
			"desc": "Pages orbit the potato.",
			"atk": 6,
			"cd": 0.0,
			"sprite": 10,
		},
		{
			"pattern": "hymnal",
			"name": "Hymnal",
			"effect": "wave",
			"desc": "A wide knockback wave.",
			"atk": 9,
			"cd": 1.25,
			"sprite": 11,
		},
		{
			"pattern": "gazette",
			"name": "Gazette",
			"effect": "spread",
			"desc": "A hail of clippings in a spread.",
			"atk": 8,
			"cd": 1.15,
			"sprite": 11,
		},
	]


static func passive_defs() -> Array:
	return [
		{"pattern": "bookplate", "name": "Bookplate", "effect": "magnet", "desc": "A page vacuum. Leaves snap in.", "sprite": 13},
		{"pattern": "colophon", "name": "Colophon", "effect": "firerate", "desc": "The printer's mark. Tomes speak faster.", "sprite": 13},
		{"pattern": "jacket", "name": "Dust jacket", "effect": "armor", "desc": "A wrap that takes the scuffs.", "sprite": 13},
		{"pattern": "overdue", "name": "Overdue stamp", "effect": "damage", "desc": "The fine is yours. Damage up.", "sprite": 13},
	]


static func curse_defs() -> Array:
	return [
		{"pattern": "errata", "name": "Errata", "effect": "misfire", "desc": "Hurtless chaos. Glyphs fly the wrong way.", "sprite": 12},
		{"pattern": "misfile", "name": "Misfile", "effect": "hiccup", "desc": "A brief scramble. The wrong tome hiccups.", "sprite": 12},
	]


static func def_by_pattern(pattern: String) -> Dictionary:
	for d in tome_defs():
		if str(d.pattern) == pattern:
			return (d as Dictionary).duplicate(true)
	for d in passive_defs():
		if str(d.pattern) == pattern:
			return (d as Dictionary).duplicate(true)
	for d in curse_defs():
		if str(d.pattern) == pattern:
			return (d as Dictionary).duplicate(true)
	return {}


static func _base_item() -> Dictionary:
	return {
		"uid": 0, "kind": "", "name": "", "true_name": "", "identified": true, "cursed": false,
		"pattern": "", "atk": 0, "cd": 0.8, "effect": "none", "desc": "", "sprite": 14,
		"value_gold": 0, "rarity": "common", "quality": "mixed", "tell": "", "shelf": "",
	}


static func make_tome(pattern: String, rare: bool = false) -> Dictionary:
	var d := def_by_pattern(pattern)
	if d.is_empty() or not d.has("atk"):
		d = def_by_pattern("primer")
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
		d = def_by_pattern("bookplate")
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


static func make_curse(pattern: String) -> Dictionary:
	var d := def_by_pattern(pattern)
	var eff := str(d.get("effect", ""))
	if d.is_empty() or (eff != "misfire" and eff != "hiccup"):
		d = def_by_pattern("errata")
	var it := _base_item()
	it.kind = "curse"
	it.cursed = true
	it.pattern = str(d.pattern)
	it.name = str(d.name)
	it.true_name = it.name
	it.effect = str(d.effect)
	it.desc = str(d.desc)
	it.sprite = int(d.sprite)
	it.value_gold = 0
	return it


static func starter_tome() -> Dictionary:
	return make_tome("primer", false)


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


static func tome_patterns() -> Array:
	var out: Array = []
	for d in tome_defs():
		out.append(str((d as Dictionary).get("pattern", "")))
	return out


static func passive_patterns() -> Array:
	var out: Array = []
	for d in passive_defs():
		out.append(str((d as Dictionary).get("pattern", "")))
	return out


static func curse_patterns() -> Array:
	var out: Array = []
	for d in curse_defs():
		out.append(str((d as Dictionary).get("pattern", "")))
	return out


static func first_offer_patterns() -> Array:
	return ["cookbook", "atlas"]


static func later_tome_patterns() -> Array:
	return ["cookbook", "atlas", "dictionary", "hymnal", "gazette", "primer"]


static func random_edition(rng: RandomNumberGenerator, rare: bool, allow_passive: bool, first_offer: bool) -> Dictionary:
	if first_offer:
		var fp: Array = first_offer_patterns()
		return make_tome(str(fp[rng.randi_range(0, fp.size() - 1)]), rare)
	if allow_passive and rng.randf() < 0.28:
		var pp: Array = []
		for d in passive_defs():
			pp.append(str(d.pattern))
		return make_passive(str(pp[rng.randi_range(0, pp.size() - 1)]), rare)
	var tp: Array = later_tome_patterns()
	return make_tome(str(tp[rng.randi_range(0, tp.size() - 1)]), rare)


static func resolve_floor(rng: RandomNumberGenerator, crack: bool, quality: String, block_tax: bool) -> Dictionary:
	## Collate: modest, never a curse card. Crack: swingy, tax only with a visible upside.
	var rare := false
	var extra_pages := 0
	var tax_hp := 0
	var outcome := "normal"
	if crack:
		var r := rng.randf()
		match quality:
			"promising":
				if r < 0.62:
					rare = true
					outcome = "strong"
					extra_pages = rng.randi_range(2, 4)
				elif r < 0.88:
					outcome = "normal"
					extra_pages = rng.randi_range(1, 2)
				else:
					outcome = "taxed"
			"sour":
				if r < 0.18:
					rare = true
					outcome = "strong"
					extra_pages = rng.randi_range(2, 3)
				elif r < 0.48:
					outcome = "normal"
				else:
					outcome = "taxed"
			_:
				if r < 0.32:
					rare = true
					outcome = "strong"
					extra_pages = rng.randi_range(1, 3)
				elif r < 0.74:
					outcome = "normal"
				else:
					outcome = "taxed"
		if outcome == "taxed":
			if block_tax:
				outcome = "normal"
				extra_pages = maxi(extra_pages, 2)
			else:
				extra_pages = maxi(extra_pages, rng.randi_range(3, 5))
				var curse_pat := "errata" if rng.randf() < 0.5 else "misfile"
				var cursed: Dictionary = make_curse(curse_pat)
				cursed.identified = true
				return {"item": cursed, "outcome": outcome, "extra_pages": extra_pages, "tax_hp": 0}
	else:
		match quality:
			"promising":
				rare = true
				outcome = "normal_good"
			_:
				outcome = "normal"
	var item: Dictionary = random_edition(rng, rare, true, false)
	item.identified = true
	return {"item": item, "outcome": outcome, "extra_pages": extra_pages, "tax_hp": tax_hp}


static func enemy_kinds() -> Array:
	return ["patron", "swift", "tank", "burst", "collector"]


static func enemy_template(kind: String, wave: float) -> Dictionary:
	var w := maxf(1.0, wave)
	var e := {
		"id": 0, "kind": kind, "name": "Overdue Patron", "pos": Vector2.ZERO,
		"hp": 10.0, "hp_max": 10.0, "atk": 4.0, "speed": 80.0, "radius": 11.0,
		"ai": "rush", "sprite": 2, "slow_t": 0.0, "xp": 1, "gold": 0, "elite": false,
		"burst": false,
	}
	match kind:
		"patron":
			e.name = "Overdue Patron"
			e.hp = 8.0 + w * 2.4
			e.atk = 4.0 + w * 0.25
			e.speed = 78.0 + w * 1.2
			e.radius = 10.0
			e.sprite = 2
			e.xp = 1
		"swift":
			e.name = "Overdue Patron"
			e.hp = 7.0 + w * 2.0
			e.atk = 4.0 + w * 0.22
			e.speed = 118.0 + w * 1.6
			e.radius = 9.0
			e.sprite = 7
			e.xp = 1
		"tank":
			e.name = "Overdue Patron"
			e.hp = 22.0 + w * 5.0
			e.atk = 7.0 + w * 0.4
			e.speed = 48.0
			e.radius = 15.0
			e.sprite = 2
			e.xp = 2
			e.gold = 1
		"burst":
			e.name = "Overdue Patron"
			e.hp = 10.0 + w * 2.6
			e.atk = 5.0 + w * 0.28
			e.speed = 72.0
			e.radius = 11.0
			e.sprite = 2
			e.xp = 2
			e.burst = true
		_:
			e.kind = "collector"
			e.name = "Fine Collector"
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
	var tank_w := 0.3 + minf(elapsed / 100.0, 1.8)
	var swift_w := 0.2 + minf(elapsed / 120.0, 1.4)
	var burst_w := 0.0 + minf(maxf(elapsed - 50.0, 0.0) / 90.0, 1.4)
	var total := 3.2 + tank_w + swift_w + burst_w
	var r := rng.randf() * total
	if r < 3.2:
		return "patron"
	if r < 3.2 + tank_w:
		return "tank"
	if r < 3.2 + tank_w + swift_w:
		return "swift"
	return "burst"


static func xp_to_next(player_level: int) -> int:
	return 8 + player_level * 5 + (player_level * player_level) / 2


static func librarian_pity_line(streak: int) -> String:
	if streak >= PITY_CURSES:
		return "The librarian will not let a third misfile stand."
	if streak == 1:
		return "The librarian frowns at the last misfile."
	return "Collate is the careful path. Crack opens the page as it is."
