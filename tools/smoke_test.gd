extends SceneTree

## Headless checks: survivor loop, three-card level-up, collate/crack, recap desk.


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
		print("SMOKE OK")
		quit(0)


func _catalog() -> int:
	if Catalog.identity_count() < 8 or Catalog.identity_count() > 12:
		push_error("identity count %d not in 8–12" % Catalog.identity_count())
		return 1
	if Catalog.MAX_WEAPONS != 6:
		push_error("max tomes should be 6")
		return 1
	var rng := RandomNumberGenerator.new()
	rng.seed = 7
	var strong := 0
	var curse := 0
	for _i in 40:
		var unid: Dictionary = Catalog.unidentified(rng)
		if str(unid.tell) == "":
			push_error("unid missing tell")
			return 1
		var r: Dictionary = Catalog.resolve_unidentified(rng, true, str(unid.quality), false, "cookery")
		if str(r.outcome) == "strong":
			strong += 1
		elif str(r.outcome) == "curse":
			curse += 1
	var blocked: Dictionary = Catalog.resolve_unidentified(rng, true, "sour", true, "cookery")
	if str(blocked.outcome) == "curse":
		push_error("pity failed to block a curse")
		return 1
	if strong == 0 or curse == 0:
		push_error("crack distribution broken strong=%d curse=%d" % [strong, curse])
		return 1
	for k in Catalog.enemy_kinds():
		var e: Dictionary = Catalog.enemy_template(str(k), 2.0)
		if float(e.hp) <= 0.0:
			push_error("bad enemy %s" % k)
			return 1
	print("catalog: identities=%d strong=%d curse=%d pity held" % [Catalog.identity_count(), strong, curse])
	return 0


func _cards() -> int:
	var rng := RandomNumberGenerator.new()
	rng.seed = 99
	var three: Array = CatalogueDraw.draw_levelup(rng)
	if three.size() != 3:
		push_error("level-up did not yield 3 cards")
		return 1
	for slip in three:
		if str(slip.title) == "" or str(slip.note) == "" or str(slip.stamp) == "":
			push_error("blank level-up card")
			return 1
	print("catalogue: 3 cards ok")
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
	print("copy: banned verbs absent; legal line present")
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
	if G.weapons.is_empty():
		push_error("no starting tome")
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
		# Margin Notes should have fired.
		push_error("no auto-fire projectiles")
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
	var before_w: int = G.weapons.size()
	G.catalogue_take(0)
	if G.phase == G.Phase.LEVELUP:
		push_error("take did not close level-up")
		return 1
	print("level-up take ok; weapons %d→? now %d last=%s" % [before_w, G.weapons.size(), G.last_slam])
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
