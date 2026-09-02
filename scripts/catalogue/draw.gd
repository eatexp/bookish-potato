class_name CatalogueDraw
extends RefCounted

## Player-commanded cataloguing. Not a reel, not a spin, not a payout table.
## Choose a shelf → three slips appear → lock or recatalogue one slip → take one.


static func shelves() -> Array:
	return [
		{"id": "cookery", "name": "Cookery", "hint": "Recipes, grease, mash. Fire and wax."},
		{"id": "reference", "name": "Reference", "hint": "Definitions. Slow, exact."},
		{"id": "maps", "name": "Maps", "hint": "Atlases, corridors, a shove."},
		{"id": "accounts", "name": "Accounts", "hint": "Coin, ledgers, pages."},
		{"id": "restricted", "name": "Restricted", "hint": "Poorly catalogued. Stronger editions, worse misfiles."},
	]


static func shelf_name(shelf_id: String) -> String:
	for s in shelves():
		if str(s.id) == shelf_id:
			return str(s.name)
	return shelf_id


static func draw_three(rng: RandomNumberGenerator, depth: int, shelf_id: String) -> Array:
	var slips: Array = []
	for _i in 3:
		slips.append(draw_slip(rng, depth, shelf_id))
	return slips


static func draw_slip(rng: RandomNumberGenerator, depth: int, shelf_id: String) -> Dictionary:
	var slip := {
		"shelf": shelf_id,
		"title": "",
		"kind": "gold",
		"gold": 0,
		"pages": 0,
		"wax": 0,
		"item": {},
		"curse_hp": 0,
		"value": 0,
		"note": "",
		"locked": false,
	}
	var r := rng.randf()
	match shelf_id:
		"cookery":
			if r < 0.40:
				_fill_item(slip, Catalog.random_tome(rng, depth, false), "fire")
				slip.title = str(slip.item.name)
				slip.note = "A recipe card, slightly scorched."
			elif r < 0.70:
				_fill_item(slip, Catalog.potion_starch(), "")
				slip.title = "Jar of Cold Mash"
				slip.note = "Kitchen surplus."
			elif r < 0.88:
				slip.kind = "wax"
				slip.wax = 18 + depth
				slip.title = "Candle stub"
				slip.note = "Kitchen tallow. The wick still takes."
				slip.value = slip.wax
			else:
				_misfile(slip, rng, 2)
		"reference":
			if r < 0.45:
				_fill_item(slip, Catalog.random_tome(rng, depth, false), "slow")
				slip.title = str(slip.item.name)
				slip.note = "A definition, underlined twice."
			elif r < 0.70:
				_fill_item(slip, Catalog.scroll_map(), "")
				slip.title = str(slip.item.name)
				slip.note = "An index of rooms."
			elif r < 0.88:
				slip.kind = "pages"
				slip.pages = 2 + depth / 2
				slip.title = "Loose leaves"
				slip.note = "Margins torn free."
				slip.value = int(slip.pages) * 4
			else:
				_misfile(slip, rng, 2)
		"maps":
			if r < 0.45:
				_fill_item(slip, Catalog.random_tome(rng, depth, false), "knock")
				slip.title = str(slip.item.name)
				slip.note = "A corridor, annotated."
			elif r < 0.72:
				_fill_item(slip, Catalog.scroll_recall(), "")
				slip.title = str(slip.item.name)
				slip.note = "A way back to the frontispiece."
			elif r < 0.88:
				slip.kind = "gold"
				slip.gold = 6 + depth
				slip.title = "Surveyor's fee"
				slip.note = "Coin taped to a map."
				slip.value = int(slip.gold)
			else:
				_misfile(slip, rng, 2)
		"accounts":
			if r < 0.35:
				_fill_item(slip, Catalog.random_tome(rng, depth, false), "gold")
				slip.title = str(slip.item.name)
				slip.note = "A debt, itemized."
			elif r < 0.70:
				slip.kind = "gold"
				slip.gold = 10 + depth * 2
				slip.title = "Settled account"
				slip.note = "The column adds up."
				slip.value = int(slip.gold)
			elif r < 0.88:
				slip.kind = "pages"
				slip.pages = 3 + depth / 2
				slip.title = "Duplicate leaves"
				slip.note = "The copyist was generous."
				slip.value = int(slip.pages) * 4
			else:
				_misfile(slip, rng, 2)
		_:
			# Restricted: stronger editions, more misfiles. No "hit" copy.
			if r < 0.38:
				_fill_item(slip, Catalog.random_tome(rng, depth, true), "")
				slip.title = str(slip.item.name)
				slip.note = "Unlisted. The stamp is wrong."
			elif r < 0.55:
				_fill_item(slip, Catalog.random_binding(rng, depth, true), "")
				slip.title = str(slip.item.name)
				slip.note = "Boards too fine for this shelf."
			elif r < 0.70:
				slip.kind = "pages"
				slip.pages = 4 + depth
				slip.title = "Uncut signatures"
				slip.note = "Still folded. Still blank."
				slip.value = int(slip.pages) * 4
			else:
				_misfile(slip, rng, 4)
	if slip.title == "":
		slip.title = "Blank slip"
		slip.note = "Nothing filed."
	return slip


static func _fill_item(slip: Dictionary, item: Dictionary, force_effect: String) -> void:
	if force_effect != "" and str(item.get("kind", "")) == "tome":
		item.effect = force_effect
	slip.kind = "item"
	slip.item = item
	slip.value = int(item.get("value_gold", 8))
	if slip.title == "":
		slip.title = str(item.get("name", "folio"))


static func _misfile(slip: Dictionary, rng: RandomNumberGenerator, hurt: int) -> void:
	slip.kind = "misfile"
	slip.curse_hp = hurt + rng.randi_range(0, 2)
	slip.item = Catalog.cursed_folio()
	slip.title = "Misfiled errata"
	slip.note = "The slip was in the wrong drawer. The folio bites."
	slip.value = -int(slip.curse_hp)
