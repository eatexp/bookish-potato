extends SceneTree

## Headless checks: five tomes, curses off the 3-pick, VS loop, recap desk.


func _init() -> void:
	call_deferred("_run")


func _run() -> void:
	var failures := 0
	failures += _catalog()
	failures += _cards()
	failures += _copy()
	failures += _run_loop()
	if failures > 0:
		push_error("SMOKE FAILED (%d)" % failures)
		quit(1)
	else:
		print("SMOKE OK six tomes, 12 identities, curses off the 3-pick")
		quit(0)


func _catalog() -> int:
	if Catalog.MAX_WEAPONS != 6:
		push_error("max tomes should be 6")
		return 1
	if Catalog.HORDE_CAP != 300:
		push_error("horde cap should be 300")
		return 1
	if Catalog.identity_count() != 12:
		push_error("identity count %d should be 12" % Catalog.identity_count())
		return 1
	var tp: Array = Catalog.tome_patterns()
	if tp.size() != 6 or not tp.has("hymnal") or not tp.has("gazette") or not tp.has("primer"):
		push_error("six tomes: primer cookbook dictionary atlas hymnal gazette")
		return 1
	if str(Catalog.starter_tome().get("pattern", "")) != "primer":
		push_error("starter must be Primer")
		return 1
	if Catalog.first_offer_patterns().size() != 2 or str(Catalog.first_offer_patterns()[0]) != "cookbook" or str(Catalog.first_offer_patterns()[1]) != "atlas":
		push_error("first offer must be cookbook/atlas")
		return 1
	var pp: Array = Catalog.passive_patterns()
	for need in ["bookplate", "colophon", "jacket", "overdue"]:
		if not pp.has(need):
			push_error("missing passive %s" % need)
			return 1
	var cp: Array = Catalog.curse_patterns()
	if not cp.has("errata") or not cp.has("misfile"):
		push_error("missing Errata/Misfile identities")
		return 1
	var colo: Dictionary = Catalog.make_passive("colophon")
	if str(colo.get("effect", "")) != "firerate":
		push_error("Colophon must be fire rate")
		return 1
	var stamp: Dictionary = Catalog.make_passive("overdue")
	if str(stamp.get("effect", "")) != "damage":
		push_error("Overdue stamp must be damage up")
		return 1
	var ek: Array = Catalog.enemy_kinds()
	if not ek.has("collector") or not ek.has("patron") or not ek.has("burst"):
		push_error("enemy family should be overdue patrons plus Fine Collector")
		return 1
	for k in ek:
		var e: Dictionary = Catalog.enemy_template(str(k), 2.0)
		if float(e.hp) <= 0.0:
			push_error("bad enemy %s" % k)
			return 1
		if str(k) != "collector" and str(e.name) != "Overdue Patron":
			push_error("zoo name %s" % e.name)
			return 1
	var rng := RandomNumberGenerator.new()
	rng.seed = 7
	var strong := 0
	var cursed := 0
	for _i in 40:
		var unid: Dictionary = Catalog.unidentified(rng)
		if str(unid.tell) == "":
			push_error("unid missing tell")
			return 1
		var r: Dictionary = Catalog.resolve_floor(rng, true, str(unid.quality), false)
		var cracked: Dictionary = r.item
		if str(r.outcome) == "strong":
			strong += 1
		elif str(r.outcome) == "taxed":
			cursed += 1
			if str(cracked.get("kind", "")) != "curse":
				push_error("crack tax should be Errata or Misfile")
				return 1
			if int(r.get("extra_pages", 0)) <= 0:
				push_error("crack curse must include extra pages")
				return 1
	var blocked: Dictionary = Catalog.resolve_floor(rng, true, "sour", true)
	if str(blocked.item.get("kind", "")) == "curse":
		push_error("pity failed to block a curse")
		return 1
	var collate: Dictionary = Catalog.resolve_floor(rng, false, "mixed", false)
	if str(collate.item.get("kind", "")) == "curse":
		push_error("collate must never curse")
		return 1
	if strong == 0 or cursed == 0:
		push_error("crack distribution broken strong=%d cursed=%d" % [strong, cursed])
		return 1
	print("catalog: identities=%d strong=%d cursed=%d pity held" % [Catalog.identity_count(), strong, cursed])
	return 0


func _cards() -> int:
	var rng := RandomNumberGenerator.new()
	rng.seed = 99
	for _i in 40:
		var three: Array = CatalogueDraw.draw_levelup(rng, 0)
		if three.size() != 3:
			push_error("level-up did not yield 3 cards")
			return 1
		for slip in three:
			var s: Dictionary = slip
			var pat := str(s.get("pattern", ""))
			if pat != "cookbook" and pat != "atlas":
				push_error("first draw was %s, not cookbook/atlas" % pat)
				return 1
			if str(s.get("kind", "")) == "passive" or pat == "dictionary":
				push_error("first draw included a passive or Dictionary")
				return 1
			if CatalogueDraw.is_forbidden_levelup(s, 0):
				push_error("forbidden card on first row: %s" % s.get("title", ""))
				return 1
			if str(s.title) == "" or str(s.note) == "" or str(s.stamp) == "":
				push_error("blank level-up card")
				return 1
	for _j in 20:
		var later: Array = CatalogueDraw.draw_levelup(rng, 2)
		for slip2 in later:
			var s2: Dictionary = slip2
			if CatalogueDraw.is_forbidden_levelup(s2, 2):
				push_error("curse or misfile on later row")
				return 1
			if str(s2.get("kind", "")) == "curse":
				push_error("curse kind on later row")
				return 1
	print("catalogue: 3 cards, first draw cookbook/atlas, curses off the row")
	return 0


func _copy() -> int:
	var paths := [
		"res://README.md",
		"res://scripts/ui/how_to_play.gd",
		"res://scripts/ui/main_menu.gd",
		"res://scripts/ui/game_root.gd",
	]
	var banned := [
		"JACKPOT", "WAGER", "PAYLINE", "PAYOUT", "NEAR-MISS", "SLOT MACHINE",
		"HOUSE EDGE", "THREE-REEL",
	]
	for p in paths:
		if not FileAccess.file_exists(p):
			push_error("missing %s" % p)
			return 1
		var t := FileAccess.get_file_as_string(p)
		var up := t.to_upper()
		for b in banned:
			if up.find(b) >= 0:
				push_error("%s contains banned %s" % [p, b])
				return 1
		if p.ends_with("README.md") or p.ends_with("how_to_play.gd") or p.ends_with("main_menu.gd"):
			if t.find("does not contain any real-world currency gambling") < 0:
				push_error("%s missing no-MTX line" % p)
				return 1
	var readme := FileAccess.get_file_as_string("res://README.md")
	var tag_at := readme.find("Bullet Heaven")
	var ar_at := readme.find("Action Roguelike")
	if tag_at < 0 or ar_at < 0 or tag_at > ar_at:
		push_error("README must lead Steam tags with Bullet Heaven")
		return 1
	if readme.to_lower().find("hymnal") < 0:
		push_error("README missing Hymnal")
		return 1
	for zoo in ["magic wand", "garlic", "knife", "bible"]:
		if readme.to_lower().find(zoo) >= 0:
			push_error("README invented a generic VS weapon: %s" % zoo)
			return 1
	print("copy: banned verbs absent; legal line present; Bullet Heaven first")
	return 0


func _run_loop() -> int:
	if root.get_node_or_null("Game") == null:
		push_error("Game autoload missing")
		return 1
	var G: Node = root.get_node("Game")
	var P: Node = root.get_node("Persist")
	G.new_run(42)
	if not G.run_active:
		push_error("new_run did not start")
		return 1
	if G.weapons.is_empty() or str(G.weapons[0].pattern) != "primer":
		push_error("starter must be Primer")
		return 1
	if G.stacks.is_empty():
		push_error("library stacks missing")
		return 1
	G.player.iframe = 10.0
	G.smoke_move = Vector2(1, 0)
	var start_x: float = G.player.pos.x
	for _i in 40:
		G.tick(0.05)
	if absf(G.player.pos.x - start_x) < 1.0:
		push_error("player did not move")
		return 1
	if G.projectiles.is_empty() and G.elapsed > 0.4:
		push_error("Primer did not auto-fire")
		return 1
	print("move+fire: x %.1f  projectiles %d  enemies %d" % [G.player.pos.x, G.projectiles.size(), G.enemies.size()])
	G.smoke_move = Vector2.ZERO
	G.force_levelup()
	if G.phase != G.Phase.LEVELUP:
		push_error("level-up did not pause")
		return 1
	if G.catalogue_slips.size() != 3:
		push_error("level-up not 3 cards")
		return 1
	for slip in G.catalogue_slips:
		var pat := str(slip.pattern)
		if pat != "cookbook" and pat != "atlas":
			push_error("run first offer was %s" % pat)
			return 1
	var before_w: int = G.weapons.size()
	G.catalogue_take(0)
	if G.phase == G.Phase.LEVELUP:
		push_error("take did not close level-up")
		return 1
	print("level-up take ok; weapons %d now %d last=%s" % [before_w, G.weapons.size(), G.last_slam])
	G.force_folio()
	if G.phase != G.Phase.FOLIO:
		push_error("folio pause missing")
		return 1
	G.folio_collate()
	if G.phase != G.Phase.RUN:
		push_error("collate did not resume")
		return 1
	G.force_folio()
	G.folio_crack()
	G.cause = "smoke-test scholarly injury"
	G.player.hp = 0
	G._end(false)
	if G.run_active:
		push_error("run still active after death")
		return 1
	if P.graveyard.is_empty():
		push_error("graveyard empty after death")
		return 1
	P.bank_pages = Catalog.FOLIO_COST + 2
	if not G.stamp_next_folio():
		push_error("returns desk could not stamp a folio")
		return 1
	G.new_run(1002)
	var folios := 0
	for it in G.pickups:
		if int(it.kind) == Catalog.Pickup.FOLIO:
			folios += 1
	if folios < 1:
		push_error("next-run folio did not appear on the floor")
		return 1
	G.elapsed = Catalog.STAGE_SECS
	G.phase = G.Phase.RUN
	G.run_active = true
	G.tick(0.02)
	if not G.won:
		push_error("closing the hour did not win")
		return 1
	print("run loop ok; graveyard %d bank %d" % [P.graveyard.size(), P.bank_pages])
	return 0
