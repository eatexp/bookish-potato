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
var slots_result: Label
var reels_lbl: Label
var blurb_panel: Panel
var recap_panel: Panel
var recap_body: Label
var inv_open := false
var pause_open := false
var blurb_target_id := -1
var stake_pages := 2
var slot_stake_gold := 5
var slot_stake_pages := 2
var using_page_bet := false


func _ready() -> void:
	UiKit.ensure_input()
	DisplayServer.window_set_title("Bookish Potatoe")
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
	_build_blurb(root)
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
	v.add_child(UiKit.lbl("↑↓ select   E equip   U use   D drop   R carefully read   G gamble-read", 12, UiKit.DIM))
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
	var br := UiKit.btn("Carefully Read", 160)
	br.pressed.connect(_inv_read)
	row2.add_child(br)
	var bg := UiKit.btn("Gamble-Read", 160)
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
	stack_panel.offset_left = -340
	stack_panel.offset_top = -260
	stack_panel.offset_right = 340
	stack_panel.offset_bottom = 260
	root.add_child(stack_panel)
	var v := VBoxContainer.new()
	UiKit.fill(v)
	v.offset_left = 16
	v.offset_right = -16
	v.offset_top = 12
	v.offset_bottom = -12
	v.add_theme_constant_override("separation", 8)
	stack_panel.add_child(v)
	v.add_child(UiKit.lbl("The Stack  ·  house rules, calfskin racing form", 20, UiKit.GOLD))
	v.add_child(UiKit.lbl("Buy folios, sell books, or feed Chapter Slots. Blurb Odds are placed in the dungeon (B next to a foe), not forced here.", 13, UiKit.DIM))
	var shop_row := HBoxContainer.new()
	shop_row.name = "ShopRow"
	v.add_child(shop_row)
	reels_lbl = UiKit.lbl("TITLE  ·  CHAPTER  ·  FOOTNOTE", 22, UiKit.GOLD)
	reels_lbl.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	v.add_child(reels_lbl)
	slots_result = UiKit.lbl("The reels wait.", 14, UiKit.PAPER)
	v.add_child(slots_result)
	var bet := HBoxContainer.new()
	v.add_child(bet)
	var b5 := UiKit.btn("Spin 5 gold", 150)
	b5.pressed.connect(func() -> void:
		using_page_bet = false
		var r: Dictionary = Game.play_slots(false, 5)
		_show_spin(r)
	)
	bet.add_child(b5)
	var b2 := UiKit.btn("Spin 2 pages", 150)
	b2.pressed.connect(func() -> void:
		using_page_bet = true
		var r: Dictionary = Game.play_slots(true, 2)
		_show_spin(r)
	)
	bet.add_child(b2)
	var leave := UiKit.btn("Leave the Stack", 200)
	leave.pressed.connect(func() -> void:
		Game.continue_from_stack()
	)
	v.add_child(leave)


func _show_spin(r: Dictionary) -> void:
	if r.is_empty():
		slots_result.text = "The bookie does not spin on credit."
		_refresh()
		return
	reels_lbl.text = "%s   ·   %s   ·   %s" % [r.title, r.chapter, r.note]
	slots_result.text = str(r.flavor)
	_rebuild_shop()
	_refresh()


func _rebuild_shop() -> void:
	var row := stack_panel.find_child("ShopRow", true, false) as HBoxContainer
	if row == null:
		return
	for c in row.get_children():
		c.queue_free()
	var buy := VBoxContainer.new()
	buy.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	row.add_child(buy)
	buy.add_child(UiKit.lbl("For sale", 16, UiKit.GOLD))
	for i in Game.shop_stock.size():
		var it: Dictionary = Game.shop_stock[i]
		var b := UiKit.btn("%s  (%dg)" % [it.name, int(it.get("price", 0))], 240)
		var idx := i
		b.pressed.connect(func() -> void:
			Game.shop_buy(idx)
			_rebuild_shop()
			_refresh()
		)
		buy.add_child(b)
	var sell := VBoxContainer.new()
	sell.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	row.add_child(sell)
	sell.add_child(UiKit.lbl("Sell from satchel", 16, UiKit.GOLD))
	for i in Game.inventory.size():
		var it: Dictionary = Game.inventory[i]
		var b := UiKit.btn("Sell %s" % it.name, 240)
		var idx := i
		b.pressed.connect(func() -> void:
			Game.shop_sell(idx)
			_rebuild_shop()
			_refresh()
		)
		sell.add_child(b)


func _build_blurb(root: Control) -> void:
	blurb_panel = Panel.new()
	blurb_panel.visible = false
	blurb_panel.set_anchors_preset(Control.PRESET_CENTER)
	blurb_panel.offset_left = -280
	blurb_panel.offset_top = -160
	blurb_panel.offset_right = 280
	blurb_panel.offset_bottom = 160
	root.add_child(blurb_panel)
	var v := VBoxContainer.new()
	v.name = "BlurbV"
	UiKit.fill(v)
	v.offset_left = 16
	v.offset_right = -16
	v.offset_top = 12
	v.offset_bottom = -12
	blurb_panel.add_child(v)


func _open_blurb() -> void:
	var foes: Array = Game.adjacent_enemies()
	if foes.is_empty():
		Game.log_msg("No adjacent foe. Stand next to something with a blurb.")
		_refresh()
		return
	var v := blurb_panel.get_node("BlurbV") as VBoxContainer
	for c in v.get_children():
		c.queue_free()
	v.add_child(UiKit.lbl("Blurb Odds  ·  optional, never forced", 20, UiKit.GOLD))
	var foe: Dictionary = foes[0]
	blurb_target_id = int(foe.id)
	v.add_child(UiKit.lbl(foe.name, 18, UiKit.PAPER))
	v.add_child(UiKit.lbl("\"%s\"" % foe.blurb, 14, UiKit.DIM))
	v.add_child(UiKit.lbl("House odds  %.1f : 1    (kill them this floor to be paid in pages)" % float(foe.odds), 14, UiKit.GOLD))
	if int(foe.get("bet_stake", 0)) > 0:
		v.add_child(UiKit.lbl("Already staked %d pages." % int(foe.bet_stake), 14, UiKit.PAPER))
	else:
		var row := HBoxContainer.new()
		v.add_child(row)
		for n in [1, 3, 5]:
			var b := UiKit.btn("Stake %d pages" % n, 140)
			var stake := n
			b.pressed.connect(func() -> void:
				Game.place_blurb_bet(blurb_target_id, stake)
				blurb_panel.visible = false
				_refresh()
			)
			row.add_child(b)
	var cancel := UiKit.btn("No bet", 120)
	cancel.pressed.connect(func() -> void:
		blurb_panel.visible = false
	)
	v.add_child(cancel)
	blurb_panel.visible = true


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
	_rebuild_shop()
	_refresh()


func _on_stack_closed() -> void:
	stack_panel.visible = false
	_refresh()


func _on_recap() -> void:
	pause_open = false
	pause_panel.visible = false
	stack_panel.visible = false
	blurb_panel.visible = false
	inv_panel.visible = false
	var e: Dictionary = Game.recap()
	var title := "You escaped the stacks." if Game.won else "You died in the stacks."
	recap_body.text = "%s\n\n%s\nDepth reached: %s\nKills: %s\nGold: %s    Pages: %s\nTurns: %s\nGambles: %s  (wins %s)\nBiggest gamble won: %s\nBiggest gamble lost: %s\n\nThis recap is in the local graveyard." % [
		title, e.cause, e.depth, e.kills, e.gold, e.pages, e.turns, e.gambles, e.gamble_wins,
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
		if blurb_panel.visible:
			blurb_panel.visible = false
			get_viewport().set_input_as_handled()
			return
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
	if event.is_action_pressed("blurb"):
		_open_blurb()
		get_viewport().set_input_as_handled()
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
			extra = "  [unread]"
		elif str(it.kind) == "tome":
			extra = "  ATK %d  %s" % [int(it.atk), it.effect]
		elif str(it.kind) == "binding":
			extra = "  DEF %d" % int(it.def)
		var l := UiKit.lbl("%s %s%s" % [mark, it.name, extra], 14, UiKit.GOLD if i == inv_index else UiKit.PAPER)
		inv_list.add_child(l)


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
		hint_lbl.text = "WASD/arrows/numpad move · . wait · I satchel · B blurb odds · Esc pause · bump stairs/desk"
	else:
		hint_lbl.text = ""
	if not Game.player.is_empty() and view:
		camera.position = view.tile_to_world(int(Game.player.x), int(Game.player.y))
	if inv_open:
		_rebuild_inv()
