class_name CatalogueDraw
extends RefCounted

## Level-up is three cards. One click shelves a folio. Not a filing minigame.


static func shelves() -> Array:
	return [
		{"id": "cookery", "name": "Cookery"},
		{"id": "reference", "name": "Reference"},
		{"id": "maps", "name": "Maps"},
		{"id": "accounts", "name": "Accounts"},
		{"id": "restricted", "name": "Restricted"},
	]


static func shelf_name(shelf_id: String) -> String:
	for s in shelves():
		if str(s.id) == shelf_id:
			return str(s.name)
	return shelf_id


static func draw_levelup(rng: RandomNumberGenerator) -> Array:
	var ids: Array = ["cookery", "reference", "maps", "accounts", "restricted"]
	var slips: Array = []
	for i in 3:
		var sid := str(ids[rng.randi_range(0, ids.size() - 1)])
		slips.append(draw_slip(rng, sid))
	return slips


static func draw_slip(rng: RandomNumberGenerator, shelf_id: String) -> Dictionary:
	var unid: Dictionary = Catalog.unidentified(rng, shelf_id)
	return {
		"shelf": shelf_id,
		"title": "Unidentified Folio",
		"kind": "unid",
		"unid": unid,
		"item": {},
		"identified": false,
		"outcome": "",
		"note": "\"%s\"" % str(unid.tell),
		"stamp": shelf_name(shelf_id),
		"locked": false,
		"pages": 0,
		"curse_hp": 0,
	}
