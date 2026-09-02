class_name CatalogueDraw
extends RefCounted

## Three cards. One click. Never a curse, errata, or misfile on this row.


static func draw_levelup(rng: RandomNumberGenerator, offer_index: int, held: Array = []) -> Array:
	var first := offer_index <= 0
	var slips: Array = []
	var used: Dictionary = {}
	if not first:
		for raw in held:
			if slips.size() >= 2:
				break
			var held_item: Dictionary = raw
			var held_card: Dictionary = _card_from_item(held_item)
			held_card.locked = true
			if is_forbidden_levelup(held_card, offer_index):
				continue
			used[str(held_card.pattern)] = true
			slips.append(held_card)
	while slips.size() < 3:
		var item: Dictionary
		if first:
			var pats: Array = Catalog.first_offer_patterns()
			var pattern := str(pats[slips.size() % pats.size()])
			if used.has(pattern):
				pattern = str(pats[rng.randi_range(0, pats.size() - 1)])
			used[pattern] = true
			item = Catalog.make_tome(pattern, false)
		else:
			item = Catalog.random_edition(rng, rng.randf() < 0.18, true, false)
			var guard := 0
			while used.has(str(item.pattern)) and guard < 6:
				item = Catalog.random_edition(rng, false, guard > 2, false)
				guard += 1
			used[str(item.pattern)] = true
		var card: Dictionary = _card_from_item(item)
		if is_forbidden_levelup(card, offer_index):
			var fallback := str(Catalog.first_offer_patterns()[slips.size() % 2])
			card = _card_from_item(Catalog.make_tome(fallback, false))
		slips.append(card)
	return slips


static func _card_from_item(item: Dictionary) -> Dictionary:
	return {
		"title": str(item.name),
		"kind": str(item.kind),
		"item": item,
		"pattern": str(item.pattern),
		"note": str(item.desc),
		"stamp": "folio",
		"locked": false,
	}


static func is_forbidden_levelup(slip: Dictionary, offer_index: int = 1) -> bool:
	var k := str(slip.get("kind", ""))
	var p := str(slip.get("pattern", "")).to_lower()
	var title := str(slip.get("title", "")).to_lower()
	if k == "curse" or p == "curse" or p == "errata" or p == "misfile":
		return true
	if title.find("errata") >= 0 or title.find("misfile") >= 0:
		return true
	if offer_index <= 0:
		if k == "passive" or p == "dictionary" or p == "primer":
			return true
		if p != "cookbook" and p != "atlas":
			return true
	return false
