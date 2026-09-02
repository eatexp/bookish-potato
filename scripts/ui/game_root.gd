extends Node

var view: Node2D
var camera: Camera2D
var hud: CanvasLayer
var hp_bar: ProgressBar
var xp_bar: ProgressBar
var hud_stats: Label
var tome_lbl: Label
var log_box: RichTextLabel
var hint_lbl: Label
var pause_panel: Panel
var settings_panel: Control
var level_panel: Panel
var cards_row: HBoxContainer
var folio_panel: Panel
var folio_tell: Label
var folio_pity: Label
var book_draw: Control
var recap_panel: Panel
var recap_body: Label
var desk_box: VBoxContainer
var pause_open := false
var book_open_t := 0.0
var slam_t := 0.0
var folio_verb := ""


func _ready() -> void:
	UiKit.ensure_input()
	DisplayServer.window_set_title("Bookish Potato: The First Edition")
	AudioMgr.play_music()
	_build_world()
	_build_hud()
	Game.frame_done.connect(_refresh)
	Game.levelup_opened.connect(_on_levelup)
	Game.levelup_closed.connect(_on_levelup_closed)
	Game.folio_opened.connect(_on_folio)
	Game.folio_closed.connect(_on_folio_closed)
	Game.recap_ready.connect(_on_recap)
	if not Game.run_active:
		Game.new_run()
	_refresh()


func _process(dt: float) -> void:
	if Game.player.is_empty() or camera == null:
		return
	camera.position = Game.player.pos
	if book_open_t > 0.0:
		book_open_t = maxf(0.0, book_open_t - dt)
		if book_draw:
			book_draw.queue_redraw()
		if book_open_t <= 0.0 and folio_verb != "":
			if folio_verb == "collate":
				Game.folio_collate()
			else:
				Game.folio_crack()
			folio_verb = ""
	if slam_t > 0.0:
		slam_t = maxf(0.0, slam_t - dt)
	if Game.phase == Game.Phase.RUN:
		_refresh()


func _build_world() -> void:
	var world := Node2D.new()
	world.name = "World"
	add_child(world)
	view = preload("res://scripts/view/arena_view.gd").new()
	view.name = "ArenaView"
	world.add_child(view)
	camera = Camera2D.new()
	camera.enabled = true
	camera.zoom = Vector2(0.46, 0.46)
	world.add_child(camera)
	RenderingServer.set_default_clear_color(Color(0.03, 0.02, 0.02))


func _build_hud() -> void:
	hud = CanvasLayer.new()
	add_child(hud)
	var root := Control.new()
	UiKit.fill(root)
	UiKit.apply_theme(root)
	hud.add_child(root)

	var top := Panel.new()
	top.set_anchors_preset(Control.PRESET_TOP_WIDE)
	top.offset_bottom = 78
	root.add_child(top)
	var topv := VBoxContainer.new()
	UiKit.fill(topv)
	topv.offset_left = 12
	topv.offset_right = -12
	topv.offset_top = 6
	topv.offset_bottom = -6
	top.add_child(topv)
	hud_stats = UiKit.lbl("", 15, UiKit.PAPER)
	topv.add_child(hud_stats)
	hp_bar = ProgressBar.new()
	hp_bar.max_value = 100
	hp_bar.show_percentage = false
	hp_bar.custom_minimum_size = Vector2(0, 10)
	topv.add_child(hp_bar)
	xp_bar = ProgressBar.new()
	xp_bar.max_value = 10
	xp_bar.show_percentage = false
	xp_bar.custom_minimum_size = Vector2(0, 6)
	topv.add_child(xp_bar)
	tome_lbl = UiKit.lbl("", 12, UiKit.DIM)
	topv.add_child(tome_lbl)

	hint_lbl = UiKit.lbl("", 13, UiKit.DIM)
	hint_lbl.set_anchors_preset(Control.PRESET_TOP_RIGHT)
	hint_lbl.offset_left = -420
	hint_lbl.offset_top = 84
	hint_lbl.offset_right = -16
	hint_lbl.offset_bottom = 130
	root.add_child(hint_lbl)

	var log_panel := Panel.new()
	log_panel.set_anchors_preset(Control.PRESET_BOTTOM_WIDE)
	log_panel.offset_top = -78
	root.add_child(log_panel)
	log_box = RichTextLabel.new()
	UiKit.fill(log_box)
	log_box.offset_left = 10
	log_box.offset_right = -10
	log_box.offset_top = 6
	log_box.offset_bottom = -6
	log_box.scroll_following = true
	log_box.bbcode_enabled = true
	log_panel.add_child(log_box)

	_build_pause(root)
	_build_levelup(root)
	_build_folio(root)
	_build_recap(root)


func _build_pause(root: Control) -> void:
	pause_panel = Panel.new()
	pause_panel.visible = false
	pause_panel.set_anchors_preset(Control.PRESET_CENTER)
	pause_panel.offset_left = -200
	pause_panel.offset_top = -220
	pause_panel.offset_right = 200
	pause_panel.offset_bottom = 220
	root.add_child(pause_panel)
	var v := VBoxContainer.new()
	UiKit.fill(v)
	v.offset_left = 20
	v.offset_right = -20
	v.offset_top = 16
	v.offset_bottom = -16
	v.add_theme_constant_override("separation", 8)
	pause_panel.add_child(v)
	v.add_child(UiKit.lbl("Paused", 26, UiKit.GOLD))
	var r := UiKit.btn("Resume")
	r.pressed.connect(func() -> void: _set_pause(false))
	v.add_child(r)
	var ab := UiKit.btn("Abandon Run")
	ab.pressed.connect(func() -> void:
		_set_pause(false)
		Game.abandon_run()
	)
	v.add_child(ab)
	var st := UiKit.btn("Settings")
	st.pressed.connect(func() -> void:
		settings_panel.visible = not settings_panel.visible
	)
	v.add_child(st)
	var q := UiKit.btn("Quit to Menu")
	q.pressed.connect(func() -> void:
		Game.abandon_run()
		get_tree().change_scene_to_file("res://scenes/main_menu.tscn")
	)
	v.add_child(q)

	settings_panel = Panel.new()
	settings_panel.visible = false
	settings_panel.set_anchors_preset(Control.PRESET_CENTER)
	settings_panel.offset_left = 220
	settings_panel.offset_top = -200
	settings_panel.offset_right = 560
	settings_panel.offset_bottom = 200
	root.add_child(settings_panel)
	var sv := VBoxContainer.new()
	UiKit.fill(sv)
	sv.offset_left = 12
	sv.offset_right = -12
	sv.offset_top = 12
	sv.offset_bottom = -12
	settings_panel.add_child(sv)
	sv.add_child(UiKit.lbl("Settings", 18, UiKit.GOLD))
	var fs := CheckBox.new()
	fs.text = "Fullscreen"
	fs.button_pressed = Persist.fullscreen
	fs.toggled.connect(func(on: bool) -> void:
		Persist.fullscreen = on
		Persist.apply()
		Persist.save_settings()
	)
	sv.add_child(fs)
	var hints := CheckBox.new()
	hints.text = "Key hints"
	hints.button_pressed = Persist.key_hints
	hints.toggled.connect(func(on: bool) -> void:
		Persist.key_hints = on
		Persist.save_settings()
		_refresh()
	)
	sv.add_child(hints)
	sv.add_child(_vol("Master", Persist.master_vol, func(val: float) -> void:
		Persist.master_vol = val
		Persist.apply()
		Persist.save_settings()
	))
	sv.add_child(_vol("SFX", Persist.sfx_vol, func(val: float) -> void:
		Persist.sfx_vol = val
		Persist.apply()
		Persist.save_settings()
	))
	sv.add_child(_vol("Music", Persist.music_vol, func(val: float) -> void:
		Persist.music_vol = val
		Persist.apply()
		Persist.save_settings()
	))


func _vol(label: String, initial: float, cb: Callable) -> Control:
	var h := HBoxContainer.new()
	var l := UiKit.lbl(label, 14)
	l.custom_minimum_size = Vector2(70, 0)
	h.add_child(l)
	var s := HSlider.new()
	s.min_value = 0
	s.max_value = 1
	s.step = 0.01
	s.value = initial
	s.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	s.value_changed.connect(cb)
	h.add_child(s)
	return h


func _build_levelup(root: Control) -> void:
	level_panel = Panel.new()
	level_panel.visible = false
	level_panel.set_anchors_preset(Control.PRESET_CENTER)
	level_panel.offset_left = -340
	level_panel.offset_top = -150
	level_panel.offset_right = 340
	level_panel.offset_bottom = 150
	root.add_child(level_panel)
	var v := VBoxContainer.new()
	UiKit.fill(v)
	v.offset_left = 16
	v.offset_right = -16
	v.offset_top = 12
	v.offset_bottom = -12
	v.add_theme_constant_override("separation", 8)
	level_panel.add_child(v)
	v.add_child(UiKit.lbl("A new edition.", 20, UiKit.GOLD))
	v.add_child(UiKit.lbl("One click.  1 / 2 / 3", 12, UiKit.DIM))
	cards_row = HBoxContainer.new()
	cards_row.alignment = BoxContainer.ALIGNMENT_CENTER
	cards_row.add_theme_constant_override("separation", 12)
	cards_row.size_flags_vertical = Control.SIZE_EXPAND_FILL
	v.add_child(cards_row)


func _rebuild_cards() -> void:
	for c in cards_row.get_children():
		c.queue_free()
	for i in Game.catalogue_slips.size():
		var slip: Dictionary = Game.catalogue_slips[i]
		cards_row.add_child(_make_card(i, slip))


func _make_card(index: int, slip: Dictionary) -> Control:
	var card := Panel.new()
	card.custom_minimum_size = Vector2(190, 200)
	card.mouse_filter = Control.MOUSE_FILTER_STOP
	var v := VBoxContainer.new()
	UiKit.fill(v)
	v.offset_left = 8
	v.offset_right = -8
	v.offset_top = 6
	v.offset_bottom = -6
	v.add_theme_constant_override("separation", 4)
	card.add_child(v)
	var lock := Button.new()
	lock.text = "lock" if not bool(slip.locked) else "locked"
	lock.toggle_mode = true
	lock.button_pressed = bool(slip.locked)
	lock.tooltip_text = "Keep this card."
	lock.custom_minimum_size = Vector2(70, 24)
	lock.mouse_filter = Control.MOUSE_FILTER_STOP
	lock.pressed.connect(func() -> void:
		Game.catalogue_toggle_lock(index)
		var now: Dictionary = Game.catalogue_slips[index]
		lock.text = "locked" if bool(now.locked) else "lock"
		lock.button_pressed = bool(now.locked)
	)
	v.add_child(lock)
	v.add_child(UiKit.lbl(str(slip.title), 16, UiKit.GOLD))
	var art := ColorRect.new()
	art.custom_minimum_size = Vector2(0, 64)
	art.color = _shelf_color(str(slip.get("pattern", "")))
	art.mouse_filter = Control.MOUSE_FILTER_IGNORE
	v.add_child(art)
	v.add_child(UiKit.lbl(str(slip.note), 12, UiKit.PAPER))
	card.gui_input.connect(func(ev: InputEvent) -> void:
		if ev is InputEventMouseButton and ev.pressed and ev.button_index == MOUSE_BUTTON_LEFT:
			if lock.get_global_rect().has_point(ev.global_position):
				return
			slam_t = 0.2
			Game.catalogue_take(index)
	)
	return card


func _shelf_color(pattern: String) -> Color:
	match pattern:
		"cookbook":
			return Color(0.55, 0.22, 0.14)
		"atlas":
			return Color(0.22, 0.4, 0.26)
		"dictionary":
			return Color(0.22, 0.28, 0.48)
		"gazette":
			return Color(0.45, 0.34, 0.12)
		"hymnal":
			return Color(0.42, 0.32, 0.52)
		"primer":
			return Color(0.62, 0.52, 0.32)
		_:
			return Color(0.32, 0.24, 0.18)


func _build_folio(root: Control) -> void:
	folio_panel = Panel.new()
	folio_panel.visible = false
	folio_panel.set_anchors_preset(Control.PRESET_CENTER)
	folio_panel.offset_left = -280
	folio_panel.offset_top = -230
	folio_panel.offset_right = 280
	folio_panel.offset_bottom = 230
	root.add_child(folio_panel)
	var v := VBoxContainer.new()
	UiKit.fill(v)
	v.offset_left = 18
	v.offset_right = -18
	v.offset_top = 12
	v.offset_bottom = -12
	v.add_theme_constant_override("separation", 8)
	folio_panel.add_child(v)
	v.add_child(UiKit.lbl("A folio on the floor.", 20, UiKit.GOLD))
	folio_tell = UiKit.lbl("", 15, UiKit.PAPER)
	v.add_child(folio_tell)
	book_draw = Control.new()
	book_draw.custom_minimum_size = Vector2(0, 140)
	book_draw.draw.connect(_draw_book)
	v.add_child(book_draw)
	folio_pity = UiKit.lbl("", 13, UiKit.DIM)
	v.add_child(folio_pity)
	var row := HBoxContainer.new()
	row.alignment = BoxContainer.ALIGNMENT_CENTER
	row.add_theme_constant_override("separation", 12)
	v.add_child(row)
	var colb := UiKit.btn("Collate", 180)
	colb.pressed.connect(func() -> void:
		if folio_verb != "":
			return
		folio_verb = "collate"
		book_open_t = 0.4
		if book_draw:
			book_draw.queue_redraw()
	)
	row.add_child(colb)
	var cr := UiKit.btn("Crack", 180)
	cr.pressed.connect(func() -> void:
		if folio_verb != "":
			return
		folio_verb = "crack"
		book_open_t = 0.4
		if book_draw:
			book_draw.queue_redraw()
	)
	row.add_child(cr)


func _draw_book() -> void:
	if book_draw == null:
		return
	var sz := book_draw.size
	var cx := sz.x * 0.5
	var cy := sz.y * 0.55
	var open := 0.0
	if book_open_t > 0.0:
		open = clampf(1.0 - book_open_t / 0.4, 0.0, 1.0)
	elif folio_verb == "" and Game.phase != Game.Phase.FOLIO:
		open = 1.0
	var cover := Color(0.45, 0.18, 0.14)
	var page := Color(0.93, 0.88, 0.76)
	if open < 0.08:
		book_draw.draw_rect(Rect2(cx - 48, cy - 58, 96, 110), cover)
		book_draw.draw_rect(Rect2(cx - 40, cy - 50, 80, 94), Color(0.35, 0.12, 0.1))
		book_draw.draw_rect(Rect2(cx - 2, cy - 58, 4, 110), Color(0.72, 0.52, 0.18))
	else:
		var spread := 40.0 + 50.0 * open
		book_draw.draw_rect(Rect2(cx - spread - 8, cy - 58, spread, 110), cover)
		book_draw.draw_rect(Rect2(cx + 8, cy - 58, spread, 110), cover.darkened(0.15))
		book_draw.draw_rect(Rect2(cx - spread, cy - 50, spread - 6, 94), page)
		book_draw.draw_rect(Rect2(cx + 10, cy - 50, spread - 6, 94), page)
		for i in 5:
			var y := cy - 36 + i * 14
			var wobble := sin(Time.get_ticks_msec() * 0.02 + i) * 3.0 * open
			book_draw.draw_line(Vector2(cx - spread + 10, y + wobble), Vector2(cx - 14, y), Color(0.28, 0.2, 0.16, 0.55), 1.0)
			book_draw.draw_line(Vector2(cx + 14, y), Vector2(cx + spread - 10, y - wobble), Color(0.28, 0.2, 0.16, 0.55), 1.0)


func _build_recap(root: Control) -> void:
	recap_panel = Panel.new()
	recap_panel.visible = false
	recap_panel.set_anchors_preset(Control.PRESET_CENTER)
	recap_panel.offset_left = -360
	recap_panel.offset_top = -280
	recap_panel.offset_right = 360
	recap_panel.offset_bottom = 300
	root.add_child(recap_panel)
	var v := VBoxContainer.new()
	UiKit.fill(v)
	v.offset_left = 18
	v.offset_right = -18
	v.offset_top = 12
	v.offset_bottom = -12
	recap_panel.add_child(v)
	v.add_child(UiKit.lbl("Closed Stack", 24, UiKit.GOLD))
	recap_body = UiKit.lbl("", 15, UiKit.PAPER)
	v.add_child(recap_body)
	v.add_child(UiKit.lbl("Returns Desk  ·  acquire unidentified folios for the next run. Stamp with pages. Nothing is for sale.", 13, UiKit.DIM))
	desk_box = VBoxContainer.new()
	v.add_child(desk_box)
	var b := UiKit.btn("Return to Menu")
	b.pressed.connect(func() -> void:
		get_tree().change_scene_to_file("res://scenes/main_menu.tscn")
	)
	v.add_child(b)


func _rebuild_desk() -> void:
	for c in desk_box.get_children():
		c.queue_free()
	var n := Persist.next_folios.size()
	desk_box.add_child(UiKit.lbl("Pages: %d" % Persist.bank_pages, 14, UiKit.PAPER))
	for i in Catalog.NEXT_FOLIO_CAP:
		if i < n:
			desk_box.add_child(UiKit.lbl("Stamped folio %d  ·  \"%s\"" % [i + 1, Persist.next_folios[i].get("tell", "")], 13, UiKit.DIM))
		else:
			desk_box.add_child(UiKit.lbl("Empty stamp %d" % (i + 1), 13, UiKit.DIM))
	var buy := UiKit.btn("Acquire / stamp  ·  %d pages" % Catalog.FOLIO_COST, 320)
	buy.disabled = Persist.bank_pages < Catalog.FOLIO_COST or n >= Catalog.NEXT_FOLIO_CAP
	buy.pressed.connect(func() -> void:
		Game.stamp_next_folio()
		_rebuild_desk()
	)
	desk_box.add_child(buy)


func _on_levelup() -> void:
	level_panel.visible = true
	_rebuild_cards()
	_refresh()


func _on_levelup_closed() -> void:
	level_panel.visible = false
	_refresh()


func _on_folio() -> void:
	folio_panel.visible = true
	book_open_t = 0.0
	folio_verb = ""
	var f: Dictionary = Game.pending_folio
	folio_tell.text = "Tell: \"%s\"" % str(f.get("tell", ""))
	folio_pity.text = Catalog.librarian_pity_line(Game.curse_streak)
	if book_draw:
		book_draw.queue_redraw()
	_refresh()


func _on_folio_closed() -> void:
	book_open_t = 0.35
	folio_panel.visible = false
	_refresh()


func _on_recap() -> void:
	pause_open = false
	pause_panel.visible = false
	level_panel.visible = false
	folio_panel.visible = false
	var e: Dictionary = Game.recap()
	var title := "You closed the hour." if Game.won else "You were overdue."
	recap_body.text = "%s\n\n%s\nTime survived: %s\nLevel: %s\nKills: %s\nPages this run: %s\nTomes: %s\nBest folio: %s\n\nLocal graveyard only." % [
		title, e.cause, e.time, e.level, e.kills, e.pages, e.tomes, e.biggest_find
	]
	_rebuild_desk()
	recap_panel.visible = true
	_refresh()


func _set_pause(on: bool) -> void:
	if Game.phase == Game.Phase.RECAP or Game.phase == Game.Phase.LEVELUP or Game.phase == Game.Phase.FOLIO:
		return
	pause_open = on
	pause_panel.visible = on
	if on:
		Game.phase = Game.Phase.PAUSED
	else:
		Game.phase = Game.Phase.RUN
		settings_panel.visible = false


func _unhandled_input(event: InputEvent) -> void:
	if recap_panel.visible:
		return
	if Game.phase == Game.Phase.LEVELUP and event is InputEventKey and event.pressed and not event.echo:
		match event.physical_keycode:
			KEY_1:
				Game.catalogue_take(0)
				get_viewport().set_input_as_handled()
				return
			KEY_2:
				Game.catalogue_take(1)
				get_viewport().set_input_as_handled()
				return
			KEY_3:
				Game.catalogue_take(2)
				get_viewport().set_input_as_handled()
				return
	if event.is_action_pressed("pause"):
		if Game.phase == Game.Phase.LEVELUP or Game.phase == Game.Phase.FOLIO:
			return
		_set_pause(not pause_open)
		get_viewport().set_input_as_handled()


func _refresh() -> void:
	if Game.player.is_empty():
		return
	hud_stats.text = Game.hud_line()
	hp_bar.max_value = float(Game.player.hp_max)
	hp_bar.value = float(Game.player.hp)
	xp_bar.max_value = maxi(1, Game.xp_next)
	xp_bar.value = Game.xp
	tome_lbl.text = Game.tome_line()
	var lines := Game.last_messages(4)
	var bb := ""
	for i in lines.size():
		var col := "#e8dcc4" if i == lines.size() - 1 else "#9a8c7a"
		bb += "[color=%s]%s[/color]\n" % [col, lines[i]]
	log_box.text = bb
	if Persist.key_hints:
		hint_lbl.text = "WASD/arrows move  ·  tomes fire themselves  ·  Esc pause"
	else:
		hint_lbl.text = ""
