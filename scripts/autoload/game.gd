extends Node

## Real-time stacks. WASD, auto-fire, one library floor. Permadeath of the run.

signal frame_done
signal run_ended
signal levelup_opened
signal levelup_closed
signal folio_opened
signal folio_closed
signal recap_ready

enum Phase { MENU, RUN, LEVELUP, FOLIO, PAUSED, RECAP }

var rng := RandomNumberGenerator.new()
var phase: int = Phase.MENU
var run_active := false
var seed_used := 0

var elapsed := 0.0
var player_level := 1
var xp := 0
var xp_next := 10
var pending_levelups := 0

var gold := 0
var pages := 0
var kills := 0
var cracks := 0
var crack_strong := 0
var curse_streak := 0
var cause := ""
var won := false
var biggest_find := {"desc": "none", "value": 0}
var worst_misfile := {"desc": "none", "value": 0}
var last_identify := {}
var messages: Array[String] = []

var player := {}
var weapons: Array = []
var passives: Array = []
var next_id := 1
var next_uid := 1

var enemies: Array = []
var projectiles: Array = []
var pickups: Array = []
var stacks: Array = []

var spawn_acc := 0.0
var sfx_fire_cd := 0.0
var surge_started := false

var catalogue_slips: Array = []
var pending_folio := {}
var last_slam := ""
var offer_index := 0
var folio_ui_open_ms := 0
var folio_ui_samples: Array = []
var atlas_orbs: Array = []
var cookbook_r := 0.0
var horde_cap := Catalog.HORDE_CAP
var far_throttle := false
var perf_stage := 0
var tick_i := 0
var last_dt := 0.016
var locked_hold: Array = []

var smoke_move := Vector2.ZERO


func _process(dt: float) -> void:
	if phase == Phase.RUN and run_active:
		tick(dt)
		frame_done.emit()


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
	elapsed = 0.0
	player_level = 1
	xp = 0
	xp_next = Catalog.xp_to_next(1)
	pending_levelups = 0
	gold = 0
	pages = 0
	kills = 0
	cracks = 0
	crack_strong = 0
	curse_streak = 0
	surge_started = false
	spawn_acc = 2.2
	sfx_fire_cd = 0.0
	next_id = 1
	next_uid = 1
	catalogue_slips.clear()
	pending_folio = {}
	last_slam = ""
	offer_index = 0
	atlas_orbs.clear()
	cookbook_r = 0.0
	horde_cap = Catalog.HORDE_CAP
	far_throttle = false
	perf_stage = 0
	tick_i = 0
	locked_hold.clear()
	last_identify = {}
	biggest_find = {"desc": "none", "value": 0}
	worst_misfile = {"desc": "none", "value": 0}
	messages.clear()
	enemies.clear()
	projectiles.clear()
	pickups.clear()
	weapons.clear()
	passives.clear()
	player = {
		"pos": Vector2.ZERO,
		"facing": Vector2.RIGHT,
		"hp": 120.0,
		"hp_max": 120.0,
		"speed": 188.0,
		"radius": 12.0,
		"iframe": 0.0,
		"name": "the bookish potato",
	}
	_build_stacks()
	_add_weapon(Catalog.starter_tome())
	_place_reserved_folios()
	_log("The Stacks are open. Primer fires itself. Closing Time will come.")
	phase = Phase.RUN


func abandon_run() -> void:
	if not run_active:
		return
	cause = "left before closing time"
	_end(false)


func tick(dt: float) -> void:
	if not run_active or phase != Phase.RUN:
		return
	dt = minf(dt, 0.05)
	last_dt = dt
	_perf_budget()
	elapsed += dt
	if elapsed >= Catalog.STAGE_SECS:
		_win()
		return
	_move_player(dt)
	_weapons_tick(dt)
	_spawn_tick(dt)
	_enemies_tick(dt)
	_projectiles_tick(dt)
	_pickups_tick(dt)
	_contacts()
	if not surge_started and elapsed >= Catalog.SURGE_AT:
		_start_surge()
	player.iframe = maxf(0.0, float(player.iframe) - dt)
	sfx_fire_cd = maxf(0.0, sfx_fire_cd - dt)
	if float(player.hp) <= 0.0:
		_end(false)


func _build_stacks() -> void:
	stacks.clear()
	var rows := [-520.0, -260.0, 260.0, 520.0]
	var cols := [-720.0, -360.0, 150.0, 510.0]
	for y in rows:
		for x in cols:
			var r := Rect2(x, y, 200.0, 38.0)
			if r.grow(48.0).has_point(Vector2.ZERO):
				continue
			stacks.append(r)


func _blocked(pos: Vector2, radius: float) -> bool:
	var lim := Catalog.ARENA * 0.5 - 8.0
	if absf(pos.x) > lim or absf(pos.y) > lim:
		return true
	for r in stacks:
		if (r as Rect2).grow(radius - 2.0).has_point(pos):
			return true
	return false


func _slide(from: Vector2, delta: Vector2, radius: float) -> Vector2:
	var nx := from + Vector2(delta.x, 0.0)
	if _blocked(nx, radius):
		nx.x = from.x
	var ny := Vector2(nx.x, from.y) + Vector2(0.0, delta.y)
	if _blocked(ny, radius):
		ny.y = from.y
	return ny


func _move_player(dt: float) -> void:
	var v := smoke_move
	if v == Vector2.ZERO:
		v = Input.get_vector("move_w", "move_e", "move_n", "move_s")
	if v.length() > 1.0:
		v = v.normalized()
	var spd: float = float(player.speed) + _speed_bonus()
	player.pos = _slide(player.pos, v * spd * dt, float(player.radius))
	if v.length() > 0.15:
		player.facing = v.normalized()


func _magnet() -> float:
	var m := 18.0
	for p in passives:
		if str(p.pattern) == "bookplate":
			m += 70.0 * int(p.level)
	return m


func _armor() -> float:
	var a := 0.0
	for p in passives:
		if str(p.pattern) == "jacket":
			a += 0.08 * int(p.level)
	return minf(0.5, a)


func _speed_bonus() -> float:
	var s := 0.0
	for p in passives:
		if str(p.pattern) == "overdue":
			s += 12.0 * int(p.level)
	return s


func _add_weapon(item: Dictionary) -> void:
	var pattern := str(item.get("pattern", "primer"))
	for w in weapons:
		if str(w.pattern) == pattern:
			w.level = mini(8, int(w.level) + 1)
			w.name = str(item.get("name", w.name))
			last_slam = str(w.name)
			_log("%s slams onto the shelf." % w.name)
			return
	if weapons.size() >= Catalog.MAX_WEAPONS:
		pages += 2
		_log("Five tomes already. The folio becomes pages.")
		return
	var d := Catalog.def_by_pattern(pattern)
	weapons.append({
		"pattern": pattern,
		"name": str(item.get("name", d.get("name", "Tome"))),
		"level": 1,
		"cd": 0.0,
		"cd_max": float(item.get("cd", d.get("cd", 0.8))),
		"atk": int(item.get("atk", d.get("atk", 8))),
		"angle": rng.randf() * TAU,
	})
	last_slam = str(item.get("name", "a tome"))
	_log("%s slams onto the shelf. It fires itself." % last_slam)
	if pattern == "primer":
		_fire_pattern(weapons[weapons.size() - 1], 1)
		weapons[weapons.size() - 1].cd = float(weapons[weapons.size() - 1].cd_max)


func _add_passive(item: Dictionary) -> void:
	var pattern := str(item.get("pattern", "bookplate"))
	for p in passives:
		if str(p.pattern) == pattern:
			p.level = mini(5, int(p.level) + 1)
			_apply_passive_hp(pattern)
			last_slam = str(p.name)
			_log("%s, thicker." % p.name)
			return
	if passives.size() >= Catalog.MAX_PASSIVES:
		pages += 2
		_log("No more courtesies. Pages instead.")
		return
	passives.append({
		"pattern": pattern,
		"name": str(item.get("name", "Courtesy")),
		"level": 1,
		"effect": str(item.get("effect", "")),
	})
	_apply_passive_hp(pattern)
	last_slam = str(item.get("name", "a courtesy"))
	_log("%s slams onto the shelf." % last_slam)


func _apply_passive_hp(pattern: String) -> void:
	if pattern == "colophon":
		player.hp_max = float(player.hp_max) + 18.0
		player.hp = minf(float(player.hp_max), float(player.hp) + 18.0)


func _apply_item(item: Dictionary, curse_hp: int = 0) -> void:
	var kind := str(item.get("kind", ""))
	match kind:
		"tome":
			_add_weapon(item)
			_note_find(str(item.name), int(item.get("value_gold", 8)))
		"passive":
			_add_passive(item)
			_note_find(str(item.name), 6)
		"curse":
			var hurt := maxi(curse_hp, 0)
			if hurt > 0:
				player.hp = maxf(1.0, float(player.hp) - float(hurt))
				_note_misfile(str(item.name), hurt)
				_log("A taxed page. The sting is the fee; the folio still shelves.")
		_:
			pages += 1


func _weapons_tick(dt: float) -> void:
	atlas_orbs.clear()
	cookbook_r = 0.0
	for w in weapons:
		var lv := int(w.level)
		var cd_max: float = maxf(0.18, float(w.cd_max) / (1.0 + 0.07 * float(lv - 1)))
		match str(w.pattern):
			"atlas":
				_atlas_tick(w, dt)
			"cookbook":
				_cookbook_tick(w, dt)
			_:
				w.cd = float(w.cd) - dt
				if float(w.cd) <= 0.0:
					w.cd = cd_max
					_fire_pattern(w, lv)


func _fire_pattern(w: Dictionary, lv: int) -> void:
	var dmg := float(w.atk) * (1.0 + 0.16 * float(lv - 1))
	var face: Vector2 = player.facing
	if face.length() < 0.2:
		face = Vector2.RIGHT
	face = face.normalized()
	_maybe_fire_sfx()
	match str(w.pattern):
		"primer":
			var n := 1 + lv / 3
			for i in n:
				var spread := (float(i) - float(n - 1) * 0.5) * 0.16
				var dir := face.rotated(spread)
				_proj(player.pos + dir * 16.0, dir * 440.0, dmg, 0.72, 6.0, "primer", 0.0, 0.0, 0)
		"dictionary":
			_pulse(dmg, 52.0 + 10.0 * lv, 0.9 + 0.15 * lv)
		"gazette":
			var n3 := 7 + lv / 2
			for i in n3:
				var t := (float(i) / float(maxi(1, n3 - 1))) - 0.5
				var dir4 := face.rotated(t * 1.35)
				_proj(player.pos + dir4 * 12.0, dir4 * 340.0, dmg, 0.5, 8.0, "gazette", 48.0 + 8.0 * lv, 0.0, 1)
		_:
			_proj(player.pos + face * 16.0, face * 400.0, dmg, 0.7, 6.0, "primer", 0.0, 0.0, 0)


func _cookbook_tick(w: Dictionary, dt: float) -> void:
	var lv := int(w.level)
	var r := 58.0 + 8.0 * float(lv)
	cookbook_r = r
	var dmg := float(w.atk) * (1.0 + 0.14 * float(lv - 1)) * dt * 2.8
	_hurt_circle(player.pos, r, dmg, 6.0, 0.0)


func _atlas_tick(w: Dictionary, dt: float) -> void:
	var lv := int(w.level)
	var n := 2 + lv
	var rad := 46.0 + 7.0 * float(lv)
	w.angle = float(w.angle) + dt * (1.7 + 0.12 * float(lv))
	var dmg := float(w.atk) * (1.0 + 0.14 * float(lv - 1))
	for i in n:
		var a: float = float(w.angle) + TAU * float(i) / float(n)
		var p: Vector2 = player.pos + Vector2.from_angle(a) * rad
		atlas_orbs.append(p)
		_hurt_circle(p, 14.0, dmg * dt * 3.2, 18.0, 0.0)


func _pulse(dmg: float, r_max: float, slow: float) -> void:
	projectiles.append({
		"pos": player.pos, "vel": Vector2.ZERO, "life": 0.35, "dmg": dmg,
		"radius": 18.0, "r_max": r_max, "kind": "dictionary", "knock": 8.0,
		"slow": slow, "pierce": 99, "from_player": true, "seek": false,
		"gold_on_hit": 0, "pulse": true, "hits": {},
	})


func _proj(pos: Vector2, vel: Vector2, dmg: float, life: float, radius: float, kind: String, knock: float, slow: float, pierce: int, seek: bool = false, gold_on_hit: int = 0) -> void:
	if projectiles.size() > 90:
		return
	projectiles.append({
		"pos": pos, "vel": vel, "life": life, "dmg": dmg, "radius": radius,
		"kind": kind, "knock": knock, "slow": slow, "pierce": pierce,
		"from_player": true, "seek": seek, "gold_on_hit": gold_on_hit,
		"pulse": false, "hits": {},
	})


func _maybe_fire_sfx() -> void:
	if sfx_fire_cd <= 0.0:
		AudioMgr.play("page")
		sfx_fire_cd = 0.16


func _spawn_tick(dt: float) -> void:
	spawn_acc -= dt
	if spawn_acc > 0.0:
		return
	var t := elapsed
	var interval := clampf(1.45 - t / 280.0, 0.28, 1.45)
	if surge_started:
		interval *= 0.45
	spawn_acc = interval
	var n := 1
	if t > 45.0:
		n += 1
	if t > 120.0:
		n += 1
	if t > 240.0:
		n += 1
	n = mini(n, 8)
	if enemies.size() >= horde_cap:
		return
	if enemies.size() > Catalog.HORDE_SOFT:
		n = mini(n, 2)
	var wave := 1.0 + t / 95.0
	for _i in n:
		if enemies.size() >= horde_cap:
			break
		_spawn_enemy(Catalog.pick_enemy_kind(rng, t), wave)


func _spawn_enemy(kind: String, wave: float) -> void:
	var e: Dictionary = Catalog.enemy_template(kind, wave)
	e.id = next_id
	next_id += 1
	e.pos = _ring_pos(400.0, 540.0)
	var guard := 0
	while _blocked(e.pos, float(e.radius)) and guard < 8:
		e.pos = _ring_pos(400.0, 560.0)
		guard += 1
	enemies.append(e)


func _start_surge() -> void:
	surge_started = true
	var wave := 1.0 + elapsed / 95.0
	_spawn_enemy("collector", wave)
	for _i in 6:
		_spawn_enemy("patron", wave)
	_log("Closing Time. The Fine Collector is due.")
	AudioMgr.play("open")


func _ring_pos(d0: float, d1: float) -> Vector2:
	var ang := rng.randf() * TAU
	var dist := d0 + rng.randf() * (d1 - d0)
	var p: Vector2 = player.pos + Vector2.from_angle(ang) * dist
	var lim := Catalog.ARENA * 0.5 - 24.0
	p.x = clampf(p.x, -lim, lim)
	p.y = clampf(p.y, -lim, lim)
	return p


func _enemies_tick(dt: float) -> void:
	tick_i += 1
	var ppos: Vector2 = player.pos
	var far_sq := Catalog.FAR_PX * Catalog.FAR_PX
	for e in enemies:
		if float(e.hp) <= 0.0:
			continue
		var dsq: float = ppos.distance_squared_to(e.pos)
		if far_throttle and dsq > far_sq and ((int(e.id) + tick_i) % 10) >= 3:
			continue
		e.slow_t = maxf(0.0, float(e.slow_t) - dt)
		var smult := 0.4 if float(e.slow_t) > 0.0 else 1.0
		var to_p: Vector2 = ppos - e.pos
		var dir := Vector2.RIGHT
		if dsq > 1.0:
			dir = to_p / sqrt(dsq)
		if str(e.ai) == "strafe":
			var side := Vector2(-dir.y, dir.x)
			dir = (dir * 0.75 + side * sin(elapsed * 4.0 + float(e.id))).normalized()
		e.pos = _slide(e.pos, dir * float(e.speed) * smult * dt, float(e.radius))


func _projectiles_tick(dt: float) -> void:
	var keep: Array = []
	for pr in projectiles:
		pr.life = float(pr.life) - dt
		if float(pr.life) <= 0.0:
			continue
		if bool(pr.get("pulse", false)):
			var age := 1.0 - float(pr.life) / 0.35
			pr.radius = lerpf(18.0, float(pr.get("r_max", 80.0)), clampf(age, 0.0, 1.0))
			pr.pos = player.pos
			_hurt_proj(pr)
			keep.append(pr)
			continue
		if bool(pr.seek):
			var tgt: Dictionary = _nearest_enemy()
			if not tgt.is_empty():
				pr.vel = pr.vel.lerp((tgt.pos - pr.pos).normalized() * 390.0, 0.12)
		pr.pos += pr.vel * dt
		if bool(pr.from_player):
			_hurt_proj(pr)
			if int(pr.pierce) >= 0 and float(pr.life) > 0.0:
				keep.append(pr)
		else:
			keep.append(pr)
	projectiles = keep


func _hurt_proj(pr: Dictionary) -> void:
	var hits: Dictionary = pr.hits
	for e in enemies:
		if float(e.hp) <= 0.0:
			continue
		var id := int(e.id)
		if hits.has(id):
			continue
		if pr.pos.distance_squared_to(e.pos) <= (float(pr.radius) + float(e.radius)) * (float(pr.radius) + float(e.radius)):
			hits[id] = true
			_damage_enemy(e, float(pr.dmg), pr.pos, float(pr.knock), float(pr.slow))
			if int(pr.gold_on_hit) > 0 and rng.randf() < 0.35:
				gold += int(pr.gold_on_hit)
			if int(pr.pierce) <= 0:
				pr.life = 0.0
				return
			pr.pierce = int(pr.pierce) - 1


func _hurt_circle(pos: Vector2, radius: float, dmg: float, knock: float, slow: float) -> void:
	for e in enemies:
		if float(e.hp) <= 0.0:
			continue
		if pos.distance_squared_to(e.pos) <= (radius + float(e.radius)) * (radius + float(e.radius)):
			_damage_enemy(e, dmg, pos, knock, slow)


func _damage_enemy(e: Dictionary, dmg: float, from: Vector2, knock: float, slow: float) -> void:
	e.hp = float(e.hp) - dmg
	if knock > 0.0:
		var d: Vector2 = e.pos - from
		if d.length() > 0.2:
			e.pos = _slide(e.pos, d.normalized() * knock * 0.02 * dmg, float(e.radius))
	if slow > 0.0:
		e.slow_t = maxf(float(e.slow_t), slow)
	if float(e.hp) <= 0.0:
		_kill_enemy(e)


func _kill_enemy(e: Dictionary) -> void:
	kills += 1
	var pos: Vector2 = e.pos
	_spawn_pickup(Catalog.Pickup.GEM, pos)
	if int(e.get("gold", 0)) > 0 or rng.randf() < 0.14:
		_spawn_pickup(Catalog.Pickup.GOLD, pos + Vector2(8, -4))
	if rng.randf() < 0.035:
		_spawn_pickup(Catalog.Pickup.BISCUIT, pos + Vector2(-6, 6))
	if rng.randf() < 0.018 or (bool(e.get("elite", false)) and rng.randf() < 0.4):
		_spawn_pickup(Catalog.Pickup.FOLIO, pos + Vector2(0, 10))
	e.hp = 0.0


func _contacts() -> void:
	var live: Array = []
	for e in enemies:
		if float(e.hp) > 0.0:
			live.append(e)
	enemies = live
	if float(player.iframe) > 0.0:
		return
	var ppos: Vector2 = player.pos
	for e2 in enemies:
		var rsum: float = float(player.radius) + float(e2.radius) * 0.85
		if ppos.distance_squared_to(e2.pos) < rsum * rsum:
			_hurt_player(float(e2.atk) * (1.0 - _armor()), e2.name)
			var away: Vector2 = ppos - e2.pos
			if away.length() < 0.2:
				away = Vector2.RIGHT
			player.pos = _slide(player.pos, away.normalized() * 36.0, float(player.radius))
			return


func _hurt_player(dmg: float, src: String) -> void:
	if float(player.iframe) > 0.0 or not run_active:
		return
	player.hp = float(player.hp) - dmg
	player.iframe = 0.65
	AudioMgr.play("hit")
	if float(player.hp) <= 0.0:
		cause = src
		player.hp = 0.0


func _pickups_tick(dt: float) -> void:
	var mag := _magnet()
	var keep: Array = []
	for it in pickups:
		var d: Vector2 = player.pos - it.pos
		var dist := d.length()
		var kind := int(it.kind)
		var pull := mag if kind != Catalog.Pickup.FOLIO else 0.0
		if pull > 0.0 and dist < pull:
			it.pos += d.normalized() * 260.0 * dt
			dist = it.pos.distance_to(player.pos)
		if dist < float(player.radius) + (22.0 if kind != Catalog.Pickup.FOLIO else 14.0):
			_take_pickup(it)
		else:
			keep.append(it)
	pickups = keep


func _spawn_pickup(kind: int, pos: Vector2) -> void:
	if pickups.size() > 120:
		return
	pickups.append({"kind": kind, "pos": pos, "folio": {}})


func _place_reserved_folios() -> void:
	var reserved: Array = Persist.take_next_folios()
	var i := 0
	for raw in reserved:
		var folio: Dictionary = Catalog.unidentified(rng, str(raw.get("shelf", "")))
		if str(raw.get("quality", "")) != "":
			folio.quality = str(raw.quality)
			folio.tell = str(raw.get("tell", folio.tell))
		var ang := 0.8 + float(i) * 1.2
		pickups.append({
			"kind": Catalog.Pickup.FOLIO,
			"pos": Vector2.from_angle(ang) * 70.0,
			"folio": folio,
		})
		i += 1


func _take_pickup(it: Dictionary) -> void:
	match int(it.kind):
		Catalog.Pickup.GEM:
			_grant_xp(1)
			AudioMgr.play("pickup")
		Catalog.Pickup.GOLD:
			gold += 1
			AudioMgr.play("pickup")
		Catalog.Pickup.BISCUIT:
			player.hp = minf(float(player.hp_max), float(player.hp) + 22.0)
			_log("A butter biscuit.")
			AudioMgr.play("potion")
		Catalog.Pickup.FOLIO:
			_offer_folio(it.get("folio", {}))


func _offer_folio(preset: Dictionary) -> void:
	if phase != Phase.RUN:
		return
	if preset.is_empty() or str(preset.get("kind", "")) != "unid":
		pending_folio = Catalog.unidentified(rng, "")
	else:
		pending_folio = preset
	phase = Phase.FOLIO
	folio_ui_open_ms = Time.get_ticks_msec()
	AudioMgr.play("open")
	folio_opened.emit()


func _grant_xp(amount: int) -> void:
	xp += amount
	while xp >= xp_next:
		xp -= xp_next
		player_level += 1
		xp_next = Catalog.xp_to_next(player_level)
		pending_levelups += 1
	if pending_levelups > 0 and phase == Phase.RUN:
		_open_levelup()


func _open_levelup() -> void:
	if not run_active:
		return
	phase = Phase.LEVELUP
	catalogue_slips = CatalogueDraw.draw_levelup(rng, offer_index, locked_hold)
	for slip in catalogue_slips:
		if CatalogueDraw.is_forbidden_levelup(slip, offer_index):
			slip.item = Catalog.make_tome("cookbook", false)
			slip.title = str(slip.item.name)
			slip.kind = "tome"
			slip.pattern = "cookbook"
			slip.note = str(slip.item.desc)
	folio_ui_open_ms = Time.get_ticks_msec()
	AudioMgr.play("identify")
	levelup_opened.emit()


func catalogue_toggle_lock(index: int) -> void:
	if phase != Phase.LEVELUP or index < 0 or index >= catalogue_slips.size():
		return
	var slip: Dictionary = catalogue_slips[index]
	slip.locked = not bool(slip.locked)


func catalogue_take(index: int) -> void:
	if phase != Phase.LEVELUP:
		return
	if index < 0 or index >= catalogue_slips.size():
		return
	var slip: Dictionary = catalogue_slips[index]
	if CatalogueDraw.is_forbidden_levelup(slip, offer_index):
		slip.item = Catalog.make_tome("atlas", false)
	var kept: Array = []
	for i in catalogue_slips.size():
		if i == index:
			continue
		var other: Dictionary = catalogue_slips[i]
		if bool(other.get("locked", false)):
			kept.append(other.item)
	locked_hold = kept
	_apply_item(slip.item, 0)
	last_identify = {"name": slip.item.get("name", ""), "outcome": "shelve", "kind": "shelve"}
	pending_levelups = maxi(0, pending_levelups - 1)
	offer_index += 1
	catalogue_slips.clear()
	_log_folio_ui()
	AudioMgr.play("page")
	if pending_levelups > 0:
		_open_levelup()
	else:
		phase = Phase.RUN
		levelup_closed.emit()


func folio_collate() -> void:
	_resolve_floor_folio(false)


func folio_crack() -> void:
	_resolve_floor_folio(true)


func _resolve_floor_folio(crack: bool) -> void:
	if phase != Phase.FOLIO or pending_folio.is_empty():
		return
	if crack:
		cracks += 1
	var block := crack and curse_streak >= Catalog.PITY_CURSES
	var result: Dictionary = Catalog.resolve_floor(
		rng, crack, str(pending_folio.get("quality", "mixed")), block
	)
	last_identify = {"name": result.item.get("name", ""), "outcome": str(result.outcome), "kind": "crack" if crack else "collate"}
	pages += int(result.extra_pages)
	var tax := int(result.get("tax_hp", 0))
	if tax > 0:
		curse_streak += 1
		player.hp = maxf(1.0, float(player.hp) - float(tax))
		_note_misfile(str(result.item.name), tax)
		AudioMgr.play("curse")
		_log("Crack: a fee of %d, and a rarer folio — %s. Extra pages %d." % [tax, result.item.get("name", ""), int(result.extra_pages)])
	else:
		if crack:
			curse_streak = 0
			if str(result.outcome) == "strong":
				crack_strong += 1
				AudioMgr.play("boom")
			else:
				AudioMgr.play("identify")
			_log("The book opens. The page reads: %s." % result.item.get("name", "an edition"))
		else:
			AudioMgr.play("identify")
			_log("Collated. The page reads: %s." % result.item.get("name", "an edition"))
	_apply_item(result.item, 0)
	pending_folio = {}
	_log_folio_ui()
	phase = Phase.RUN
	folio_closed.emit()
	if pending_levelups > 0 and run_active:
		_open_levelup()


func _perf_budget() -> void:
	## FPS dip: cap 200, then throttle far enemies to 30% update. No enemy-vs-enemy blobs.
	if last_dt > 0.033:
		perf_stage = mini(3, perf_stage + 1)
	elif last_dt < 0.020:
		perf_stage = maxi(0, perf_stage - 1)
	match perf_stage:
		0:
			horde_cap = Catalog.HORDE_CAP
			far_throttle = false
		1:
			horde_cap = Catalog.HORDE_SOFT
			far_throttle = false
		_:
			horde_cap = Catalog.HORDE_SOFT
			far_throttle = true


func _log_folio_ui() -> void:
	if folio_ui_open_ms <= 0:
		return
	var ms := Time.get_ticks_msec() - folio_ui_open_ms
	folio_ui_samples.append(ms)
	folio_ui_open_ms = 0
	var copy: Array = folio_ui_samples.duplicate()
	copy.sort()
	var med: int = int(copy[copy.size() / 2])
	print("folio-ui %d ms  median %d ms  n=%d" % [ms, med, copy.size()])


func stamp_next_folio() -> bool:
	if phase != Phase.RECAP:
		return false
	return Persist.try_stamp_folio(rng)


func _nearest_enemy() -> Dictionary:
	var best: Dictionary = {}
	var bd := 1e12
	var ppos: Vector2 = player.pos
	for e in enemies:
		if float(e.hp) <= 0.0:
			continue
		var d: float = ppos.distance_squared_to(e.pos)
		if d < bd:
			bd = d
			best = e
	return best


func _note_find(desc: String, value: int) -> void:
	if value >= int(biggest_find.get("value", 0)):
		biggest_find = {"desc": desc, "value": value}


func _note_misfile(desc: String, value: int) -> void:
	if value >= int(worst_misfile.get("value", 0)):
		worst_misfile = {"desc": desc, "value": value}


func hud_line() -> String:
	if player.is_empty():
		return ""
	var t := _fmt_time(elapsed)
	var left := _fmt_time(maxf(0.0, Catalog.STAGE_SECS - elapsed))
	return "HP %d/%d   Lv %d   %d/%d leaves   Gold %d   Pages %d   %s  (closes in %s)" % [
		int(player.hp), int(player.hp_max), player_level, xp, xp_next, gold, pages, t, left
	]


func tome_line() -> String:
	var parts: Array[String] = []
	for w in weapons:
		parts.append("%s %d" % [w.name, w.level])
	return "  ·  ".join(parts) if not parts.is_empty() else "Primer"


func last_messages(n: int) -> Array:
	if messages.size() <= n:
		return messages.duplicate()
	return messages.slice(messages.size() - n)


func recap() -> Dictionary:
	return {
		"outcome": "closed the hour" if won else "overdue",
		"cause": cause,
		"time": _fmt_time(elapsed),
		"elapsed": elapsed,
		"kills": kills,
		"gold": gold,
		"pages": pages,
		"level": player_level,
		"tomes": tome_line(),
		"cracks": cracks,
		"crack_strong": crack_strong,
		"biggest_find": biggest_find.get("desc", "none"),
		"worst_misfile": worst_misfile.get("desc", "none"),
		"when": Time.get_datetime_string_from_system(true, true),
	}


func _fmt_time(secs: float) -> String:
	var s := int(secs)
	return "%d:%02d" % [s / 60, s % 60]


func _log(msg: String) -> void:
	messages.append(msg)
	if messages.size() > 40:
		messages = messages.slice(messages.size() - 40)


func _win() -> void:
	if not run_active:
		return
	won = true
	cause = "the hour closed; you still stood"
	AudioMgr.play("win")
	_end(true)


func _end(victory: bool) -> void:
	if not run_active:
		return
	run_active = false
	won = victory
	if not victory:
		AudioMgr.play("death")
		if cause == "":
			cause = "the stacks"
	Persist.bank_pages += pages
	Persist.save_meta()
	phase = Phase.RECAP
	Persist.add_entry(recap())
	run_ended.emit()
	recap_ready.emit()


func grant_xp(amount: int) -> void:
	if phase == Phase.RUN:
		_grant_xp(amount)


func force_levelup() -> void:
	pending_levelups += 1
	_open_levelup()


func force_folio() -> void:
	_offer_folio({})
