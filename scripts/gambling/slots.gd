class_name Slots
extends RefCounted

## Chapter Slots — three-reel tome (title / chapter / footnote).


static func spin(rng: RandomNumberGenerator, depth: int) -> Dictionary:
	var title: String = Catalog.slot_titles()[rng.randi_range(0, Catalog.slot_titles().size() - 1)]
	var chapter: String = Catalog.slot_chapters()[rng.randi_range(0, Catalog.slot_chapters().size() - 1)]
	var note: String = Catalog.slot_footnotes()[rng.randi_range(0, Catalog.slot_footnotes().size() - 1)]
	return payout(rng, depth, title, chapter, note)


static func payout(rng: RandomNumberGenerator, depth: int, title: String, chapter: String, note: String) -> Dictionary:
	var result := {
		"title": title,
		"chapter": chapter,
		"note": note,
		"gold": 0,
		"pages": 0,
		"item": {},
		"curse_hp": 0,
		"flavor": "",
		"value": 0,
	}
	# Cursed errata line is always dangerous.
	if title == "CURSED" and chapter == "ERRATA" and note == "HEX":
		result.curse_hp = 8 + depth
		result.item = Catalog.cursed_folio()
		result.flavor = "Triple errata. The house takes a bite and leaves you a cursed folio."
		result.value = -20
		return result
	if note == "HEX" or title == "CURSED":
		result.curse_hp = rng.randi_range(2, 4)
		result.flavor = "A sour footnote. Something in the margin nips you."
		result.value = -result.curse_hp
		if rng.randf() < 0.35:
			result.item = Catalog.cursed_folio()
			result.flavor += " You also inherit cursed errata."
		return result
	if note == "GOLD":
		var g := 8 + depth * 2
		if title == "LEDGER":
			g *= 3
			result.flavor = "The ledger pays in coin, as ledgers will."
		elif chapter == "III":
			g = int(g * 1.5)
			result.flavor = "Chapter III: the accounts settle in your favor."
		else:
			result.flavor = "A golden footnote."
		result.gold = g
		result.value = g
		return result
	if note == "PAGES":
		var p := 2 + depth / 2
		if title == "FOLIO":
			p += 3
			result.flavor = "Loose leaves pour from the folio."
		else:
			result.flavor = "Bookmarks, paid in kind."
		result.pages = p
		result.value = p * 4
		return result
	if note == "ITEM":
		var rare := title != "FOLIO" and chapter != "APPENDIX"
		if title == "COOKBOOK":
			result.item = Catalog.random_tome(rng, depth, true)
			result.item.effect = "fire"
			result.item.name = "House Cookbook"
			result.item.true_name = result.item.name
			result.flavor = "The reel coughs up a cookbook still warm."
		elif title == "DICTIONARY":
			result.item = Catalog.random_tome(rng, depth, true)
			result.item.effect = "slow"
			result.item.name = "House Dictionary"
			result.item.true_name = result.item.name
			result.flavor = "A dictionary with the house's definitions."
		elif title == "ATLAS":
			result.item = Catalog.random_tome(rng, depth, true)
			result.item.effect = "knock"
			result.item.name = "House Atlas"
			result.item.true_name = result.item.name
			result.flavor = "An atlas of rooms you have not yet failed in."
		else:
			result.item = Catalog.random_identified_loot(rng, depth, rare)
			if result.item.kind == "unid":
				result.item = Catalog.unidentified()
			result.flavor = "The footnote is an item. Take it or leave it."
		result.value = 18
		return result
	# BLANK and mixed junk
	if rng.randf() < 0.4:
		result.gold = rng.randi_range(1, 3)
		result.flavor = "A consolation coin under the felt."
		result.value = result.gold
	else:
		result.flavor = "The reels shrug. The house keeps its face straight."
		result.value = 0
	return result
