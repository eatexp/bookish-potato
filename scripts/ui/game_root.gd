extends Node

var view: Node2D
var camera: Camera2D
var hud: CanvasLayer
var hp_bar: ProgressBar
var hud_stats: Label
var log_box: RichTextLabel
var hint_lbl: Label
var inv_panel: Panel
var inv_list: VBoxContainer
var inv_index := 0
var pause_panel: Panel
var settings_panel: Control
var stack_panel: Panel
var returns_box: VBoxContainer
var slips_box: VBoxContainer
var recap_panel: Panel
var recap_body: Label
var inv_open := false
var pause_open := false


func _ready() -> void:
	UiKit.ensure_input()
	DisplayServer.window_set_title("Bookish Potato: The First Edition")
	AudioMgr.play_music()
	_build_world()
	_build_hud()
	Game.turn_done.connect(_refresh)
	Game.stack_opened.connect(_on_stack)
	Game.stack_closed.connect(_on_stack_closed)
	Game.recap_ready.connect(_on_recap)
	Game.floor_changed.connect(_refresh)
	if not Game.run_active:
		Game.new_run()
	_refresh()


func _build_world() -> void:
	var world := Node2D.new()
	world.name = "World"
	add_child(world)
	view = preload("res://scripts/view/dungeon_view.gd").new()
	view.name = "DungeonView"
	world.add_child(view)
	camera = Camera2D.new()
	camera.enabled = true
	camera.zoom = Vector2(1, 1)
	camera.position_smoothing_enabled = false
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
	top.offset_bottom = 72
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
	hp_bar.max_value = 24
	hp_bar.show_percentage = false
	hp_bar.custom_minimum_size = Vector2(0, 10)
	topv.add_child(hp_bar)

	hint_lbl = UiKit.lbl("", 13, UiKit.DIM)
	hint_lbl.set_anchors_preset(Control.PRESET_TOP_RIGHT)
	hint_lbl.offset_left = -420
	hint_lbl.offset_top = 76
	hint_lbl.offset_right = -16
	hint_lbl.offset_bottom = 140
	root.add_child(hint_lbl)

	var log_panel := Panel.new()
	log_panel.set_anchors_preset(Control.PRESET_BOTTOM_WIDE)
	log_panel.offset_top = -118
	root.add_child(log_panel)
	log_box = RichTextLabel.new()
	UiKit.fill(log_box)
	log_box.offset_left = 10
	log_box.offset_right = -10
	log_box.offset_top = 8
	log_box.offset_bottom = -8
	log_box.scroll_following = true
	log_box.fit_content = false
	log_box.bbcode_enabled = true
	log_panel.add_child(log_box)

	_build_inventory(root)
	_build_pause(root)
	_build_stack(root)
	_build_recap(root)


func _build_inventory(root: Control) -> void:
	inv_panel = Panel.new()
	inv_panel.visible = false
	inv_panel.set_anchors_preset(Control.PRESET_RIGHT_WIDE)
	inv_panel.offset_left = -380
	inv_panel.offset_top = 80
	inv_panel.offset_bottom = -126
	root.add_child(inv_panel)
	var v := VBoxContainer.new()
	UiKit.fill(v)
	v.offset_left = 10
	v.offset_right = -10
	v.offset_top = 8
	v.offset_bottom = -8
	inv_panel.add_child(v)
	v.add_child(UiKit.lbl("Satchel  (I close)", 18, UiKit.GOLD))
	v.add_child(UiKit.lbl("↑↓ select   E equip   U use   D drop   R collate   G crack spine", 12, UiKit.DIM))
	var scroll := ScrollContainer.new()
	scroll.size_flags_vertical = Control.SIZE_EXPAND_FILL
	v.add_child(scroll)
	inv_list = VBoxContainer.new()
	inv_list.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	scroll.add_child(inv_list)
	var row := HBoxContainer.new()
	v.add_child(row)
	for pair in [["Equip", "_inv_equip"], ["Use", "_inv_use"], ["Drop", "_inv_drop"]]:
		var b := UiKit.btn(pair[0], 90)
		b.pressed.connect(Callable(self, pair[1]))
		row.add_child(b)
	var row2 := HBoxContainer.new()
	v.add_child(row2)
	var br := UiKit.btn("Collate (safe)", 160)
	br.pressed.connect(_inv_read)
	row2.add_child(br)
	var bg := UiKit.btn("Crack the spine", 160)
	bg.pressed.connect(_inv_gamble)
	row2.add_child(bg)


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


func _build_stack(root: Control) -> void:
	stack_panel = Panel.new()
	stack_panel.visible = false
	stack_panel.set_anchors_preset(Control.PRESET_CENTER)
	stack_panel.offset_left = -380
	stack_panel.offset_top = -280
	stack_panel.offset_right = 380
	stack_panel.offset_bottom = 280
	root.add_child(stack_panel)
	var v := VBoxContainer.new()
	v.name = "DeskV"
	UiKit.fill(v)
	v.offset_left = 16
	v.offset_right = -16
	v.offset_top = 12
	v.offset_bottom = -12
	v.add_theme_constant_override("separation", 8)
	stack_panel.add_child(v)
	v.add_child(UiKit.lbl("Returns Desk", 22, UiKit.GOLD))
	v.add_child(UiKit.lbl("They buy unidentified folios for pages. Nothing is for sale. Catalogue a shelf if you want slips — you choose the shelf, you lock, you recatalogue.", 13, UiKit.DIM))
	returns_box = VBoxContainer.new()
	v.add_child(returns_box)
	v.add_child(UiKit.lbl("Catalogue a shelf", 16, UiKit.GOLD))
	var shelves := HBoxContainer.new()
	v.add_child(shelves)
	for s in CatalogueDraw.shelves():
		var sid := str(s.id)
		var b := UiKit.btn(str(s.name), 120)
		b.tooltip_text = str(s.hint)
		b.pressed.connect(func() -> void:
			Game.catalogue_choose_shelf(sid)
			_rebuild_desk()
			_refresh()
		)
		shelves.add_child(b)
	slips_box = VBoxContainer.new()
	v.add_child(slips_box)
	var leave := UiKit.btn("Continue down", 200)
	leave.pressed.connect(func() -> void:
		Game.continue_from_stack()
	)
	v.add_child(leave)


func _rebuild_desk() -> void:
	if returns_box == null:
		return
	for c in returns_box.get_children():
		c.queue_free()
	returns_box.add_child(UiKit.lbl("Hand in unidentified folios", 16, UiKit.GOLD))
	var idxs: Array = Game.unid_inv_indices()
	if idxs.is_empty():
		returns_box.add_child(UiKit.lbl("None in the satchel.", 13, UiKit.DIM))
	for i in idxs:
		var it: Dictionary = Game.inventory[i]
		var pay := 2
		match str(it.get("quality", "mixed")):
			"promising":
				pay = 3
			"sour":
				pay = 1
		var b := UiKit.btn("Return  ·  \"%s\"  ·  %d pages" % [it.get("tell", ""), pay], 640)
		var idx: int = i
		b.pressed.connect(func() -> void:
			Game.return_folio(idx)
			_rebuild_desk()
			_refresh()
		)
		returns_box.add_child(b)
	if slips_box == null:
		return
	for c in slips_box.get_children():
		c.queue_free()
	if Game.catalogue_shelf == "":
		slips_box.add_child(UiKit.lbl("Pick a shelf. Three slips are laid out together. Nothing moves until you choose.", 13, UiKit.DIM))
		return
	slips_box.add_child(UiKit.lbl("Slips from %s  ·  lock or recatalogue (1 page)  ·  take one" % CatalogueDraw.shelf_name(Game.catalogue_shelf), 14, UiKit.PAPER))
	for i in Game.catalogue_slips.size():
		var slip: Dictionary = Game.catalogue_slips[i]
		var row := HBoxContainer.new()
		slips_box.add_child(row)
		var locked := " [locked]" if bool(slip.get("locked", false)) else ""
		var lab := UiKit.lbl("%s%s  —  %s" % [slip.title, locked, slip.note], 13, UiKit.PAPER)
		lab.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		lab.custom_minimum_size = Vector2(280, 0)
		row.add_child(lab)
		var idx2: int = i
		if not bool(slip.get("locked", false)):
			var lk := UiKit.btn("Lock", 70)
			lk.pressed.connect(func() -> void:
				Game.catalogue_lock(idx2)
				_rebuild_desk()
				_refresh()
			)
			row.add_child(lk)
			var rd := UiKit.btn("Recatalogue", 120)
			rd.pressed.connect(func() -> void:
				Game.catalogue_redraw(idx2)
				_rebuild_desk()
				_refresh()
			)
			row.add_child(rd)
		var tk := UiKit.btn("Take", 70)
		tk.pressed.connect(func() -> void:
			Game.catalogue_take(idx2)
			_rebuild_desk()
			_refresh()
		)
		row.add_child(tk)


func _build_recap(root: Control) -> void:
	recap_panel = Panel.new()
	recap_panel.visible = false
	recap_panel.set_anchors_preset(Control.PRESET_CENTER)
	recap_panel.offset_left = -320
	recap_panel.offset_top = -240
	recap_panel.offset_right = 320
	recap_panel.offset_bottom = 240
	root.add_child(recap_panel)
	var v := VBoxContainer.new()
	UiKit.fill(v)
	v.offset_left = 20
	v.offset_right = -20
	v.offset_top = 16
	v.offset_bottom = -16
	recap_panel.add_child(v)
	v.add_child(UiKit.lbl("Closed Stack", 26, UiKit.GOLD))
	recap_body = UiKit.lbl("", 16, UiKit.PAPER)
	v.add_child(recap_body)
	var b := UiKit.btn("Return to Menu")
	b.pressed.connect(func() -> void:
		get_tree().change_scene_to_file("res://scenes/main_menu.tscn")
	)
	v.add_child(b)


func _on_stack() -> void:
	stack_panel.visible = true
	inv_open = false
	inv_panel.visible = false
	_rebuild_desk()
	_refresh()


func _on_stack_closed() -> void:
	stack_panel.visible = false
	_refresh()


func _on_recap() -> void:
	pause_open = false
	pause_panel.visible = false
	stack_panel.visible = false
	inv_panel.visible = false
	var e: Dictionary = Game.recap()
	var title := "You escaped the stacks." if Game.won else "You died in the stacks."
	recap_body.text = "%s\n\n%s\nDepth reached: %s\nKills: %s\nGold: %s    Pages: %s\nTurns: %s\nSpines cracked: %s  (clean/flare %s)\nBiggest catalogue win: %s\nWorst misfile: %s\n\nLocal graveyard only." % [
		title, e.cause, e.depth, e.kills, e.gold, e.pages, e.turns, e.get("cracks", 0), e.get("crack_wins", 0),
		e.biggest_win, e.biggest_loss
	]
	recap_panel.visible = true
	_refresh()


func _set_pause(on: bool) -> void:
	pause_open = on
	pause_panel.visible = on
	if not on:
		settings_panel.visible = false


func _unhandled_input(event: InputEvent) -> void:
	if recap_panel.visible:
		return
	if event.is_action_pressed("pause"):
		if Game.phase == Game.Phase.STACK:
			Game.continue_from_stack()
			get_viewport().set_input_as_handled()
			return
		if inv_open:
			inv_open = false
			inv_panel.visible = false
			get_viewport().set_input_as_handled()
			return
		_set_pause(not pause_open)
		get_viewport().set_input_as_handled()
		return
	if pause_open or Game.phase == Game.Phase.STACK or Game.phase == Game.Phase.RECAP:
		return
	if event.is_action_pressed("inventory"):
		inv_open = not inv_open
		inv_panel.visible = inv_open
		_rebuild_inv()
		get_viewport().set_input_as_handled()
		return
	if inv_open:
		_inv_input(event)
		return
	if event.is_action_pressed("stairs"):
		Game.use_stairs()
		get_viewport().set_input_as_handled()
		return
	if event.is_action_pressed("wait"):
		Game.wait_turn()
		get_viewport().set_input_as_handled()
		return
	var d := _dir_from_event(event)
	if d != Vector2i.ZERO:
		Game.try_move(d.x, d.y)
		get_viewport().set_input_as_handled()
		return
	if event is InputEventMouseButton and event.pressed and event.button_index == MOUSE_BUTTON_LEFT:
		var world := camera.get_global_mouse_position()
		var tile: Vector2i = view.world_to_tile(world)
		var dx := clampi(tile.x - int(Game.player.x), -1, 1)
		var dy := clampi(tile.y - int(Game.player.y), -1, 1)
		if dx != 0 or dy != 0:
			Game.try_move(dx, dy)
		get_viewport().set_input_as_handled()


func _dir_from_event(event: InputEvent) -> Vector2i:
	if event.is_action_pressed("move_n"):
		return Vector2i(0, -1)
	if event.is_action_pressed("move_s"):
		return Vector2i(0, 1)
	if event.is_action_pressed("move_w"):
		return Vector2i(-1, 0)
	if event.is_action_pressed("move_e"):
		return Vector2i(1, 0)
	if event.is_action_pressed("move_nw"):
		return Vector2i(-1, -1)
	if event.is_action_pressed("move_ne"):
		return Vector2i(1, -1)
	if event.is_action_pressed("move_sw"):
		return Vector2i(-1, 1)
	if event.is_action_pressed("move_se"):
		return Vector2i(1, 1)
	return Vector2i.ZERO


func _inv_input(event: InputEvent) -> void:
	if event.is_action_pressed("move_n"):
		inv_index = maxi(0, inv_index - 1)
		_rebuild_inv()
		get_viewport().set_input_as_handled()
	elif event.is_action_pressed("move_s"):
		inv_index = mini(Game.inventory.size() - 1, inv_index + 1)
		_rebuild_inv()
		get_viewport().set_input_as_handled()
	elif event is InputEventKey and event.pressed and not event.echo:
		match event.physical_keycode:
			KEY_E:
				_inv_equip()
			KEY_U:
				_inv_use()
			KEY_D:
				_inv_drop()
			KEY_R:
				_inv_read()
			KEY_G:
				_inv_gamble()


func _sel() -> int:
	if Game.inventory.is_empty():
		return -1
	return clampi(inv_index, 0, Game.inventory.size() - 1)


func _inv_equip() -> void:
	Game.equip_item(_sel())
	_rebuild_inv()


func _inv_use() -> void:
	Game.use_item(_sel())
	_rebuild_inv()


func _inv_drop() -> void:
	Game.drop_item(_sel())
	_rebuild_inv()


func _inv_read() -> void:
	Game.carefully_read(_sel())
	_rebuild_inv()


func _inv_gamble() -> void:
	Game.gamble_read(_sel())
	_rebuild_inv()


func _rebuild_inv() -> void:
	for c in inv_list.get_children():
		c.queue_free()
	if Game.inventory.is_empty():
		inv_list.add_child(UiKit.lbl("(empty satchel)", 14, UiKit.DIM))
		return
	inv_index = clampi(inv_index, 0, Game.inventory.size() - 1)
	for i in Game.inventory.size():
		var it: Dictionary = Game.inventory[i]
		var mark := ">" if i == inv_index else " "
		var extra := ""
		if str(it.kind) == "unid":
			extra = "  tell: \"%s\"" % it.get("tell", "")
		elif str(it.kind) == "tome":
			extra = "  ATK %d  %s" % [int(it.atk), it.effect]
		elif str(it.kind) == "binding":
			extra = "  DEF %d" % int(it.def)
		var l := UiKit.lbl("%s %s%s" % [mark, it.name, extra], 14, UiKit.GOLD if i == inv_index else UiKit.PAPER)
		inv_list.add_child(l)
	var flash: Dictionary = Game.last_identify
	if not flash.is_empty():
		inv_list.add_child(UiKit.lbl("Last: %s → %s (%s)" % [flash.get("kind", ""), flash.get("name", ""), flash.get("outcome", "")], 13, UiKit.GOLD))
	inv_list.add_child(UiKit.lbl("Crack pity: %d/%d misfiles in a row (third is clean)." % [Game.curse_streak, Catalog.PITY_CURSES], 12, UiKit.DIM))


func _refresh() -> void:
	if Game.player.is_empty():
		return
	hud_stats.text = Game.hud_line()
	hp_bar.max_value = int(Game.player.hp_max)
	hp_bar.value = int(Game.player.hp)
	var lines := Game.last_messages(7)
	var bb := ""
	for i in lines.size():
		var col := "#e8dcc4" if i == lines.size() - 1 else "#9a8c7a"
		bb += "[color=%s]%s[/color]\n" % [col, lines[i]]
	log_box.text = bb
	if Persist.key_hints:
		hint_lbl.text = "WASD/arrows/numpad move · . wait · I satchel · Esc pause · bump stairs"
	else:
		hint_lbl.text = ""
	if not Game.player.is_empty() and view:
		camera.position = view.tile_to_world(int(Game.player.x), int(Game.player.y))
	if inv_open:
		_rebuild_inv()
