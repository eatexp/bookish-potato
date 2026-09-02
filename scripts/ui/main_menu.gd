extends Control

var _grave_open := false
var _settings_open := false
var _grave_box: VBoxContainer
var _settings_box: Control


func _ready() -> void:
	UiKit.ensure_input()
	UiKit.apply_theme(self)
	UiKit.fill(self)
	DisplayServer.window_set_title("Bookish Potato: The First Edition")
	AudioMgr.play_music()
	_build()


func _build() -> void:
	var bg := ColorRect.new()
	bg.color = UiKit.BG
	UiKit.fill(bg)
	add_child(bg)

	var glow := ColorRect.new()
	glow.color = Color(0.12, 0.08, 0.05, 0.7)
	glow.set_anchors_preset(Control.PRESET_TOP_WIDE)
	glow.offset_bottom = 170
	add_child(glow)

	var title := UiKit.lbl("BOOKISH POTATO", 40, UiKit.GOLD)
	title.position = Vector2(80, 36)
	title.size = Vector2(1100, 52)
	add_child(title)

	var sub := UiKit.lbl("The First Edition    ·    v0.1    ·    a turn-based dungeon crawler", 18, UiKit.PAPER)
	sub.position = Vector2(80, 90)
	sub.size = Vector2(1000, 28)
	add_child(sub)

	var tag := UiKit.lbl("Grid. Fog of war. Permadeath. Unidentified editions. Collate or crack the spine.", 15, UiKit.DIM)
	tag.position = Vector2(80, 122)
	tag.size = Vector2(1000, 28)
	add_child(tag)

	var col := VBoxContainer.new()
	col.position = Vector2(80, 200)
	col.custom_minimum_size = Vector2(360, 400)
	col.add_theme_constant_override("separation", 10)
	add_child(col)

	var b_new := UiKit.btn("New Run")
	var b_how := UiKit.btn("How to Play")
	var b_set := UiKit.btn("Settings")
	var b_gr := UiKit.btn("Graveyard")
	var b_quit := UiKit.btn("Quit")
	b_new.pressed.connect(func() -> void:
		AudioMgr.play("ui")
		Game.new_run()
		get_tree().change_scene_to_file("res://scenes/game.tscn")
	)
	b_how.pressed.connect(func() -> void:
		AudioMgr.play("ui")
		get_tree().change_scene_to_file("res://scenes/how_to_play.tscn")
	)
	b_set.pressed.connect(func() -> void:
		AudioMgr.play("ui")
		_settings_open = not _settings_open
		_settings_box.visible = _settings_open
		_grave_box.get_parent().visible = false
		_grave_open = false
	)
	b_gr.pressed.connect(func() -> void:
		AudioMgr.play("ui")
		_grave_open = not _grave_open
		_grave_box.get_parent().visible = _grave_open
		_settings_box.visible = false
		_settings_open = false
		_refresh_grave()
	)
	b_quit.pressed.connect(func() -> void:
		get_tree().quit()
	)
	for b in [b_new, b_how, b_set, b_gr, b_quit]:
		col.add_child(b)

	var flavor := UiKit.lbl("Five floors. Recover the Notable Folio and walk the Binding Exit. Unread books carry a librarian's tell — collate safely, or crack the spine. There is no mid-run save.\n\nThis game does not contain any real-world currency gambling or microtransactions.", 15, UiKit.PAPER)
	flavor.position = Vector2(80, 500)
	flavor.size = Vector2(720, 160)
	add_child(flavor)

	_settings_box = _make_settings()
	_settings_box.position = Vector2(480, 200)
	_settings_box.visible = false
	add_child(_settings_box)

	var grave_panel := Panel.new()
	grave_panel.position = Vector2(620, 200)
	grave_panel.size = Vector2(560, 420)
	grave_panel.visible = false
	add_child(grave_panel)
	var gscroll := ScrollContainer.new()
	gscroll.set_anchors_preset(Control.PRESET_FULL_RECT)
	gscroll.offset_left = 12
	gscroll.offset_top = 12
	gscroll.offset_right = -12
	gscroll.offset_bottom = -12
	grave_panel.add_child(gscroll)
	_grave_box = VBoxContainer.new()
	_grave_box.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	gscroll.add_child(_grave_box)


func _make_settings() -> Control:
	var p := Panel.new()
	p.custom_minimum_size = Vector2(560, 360)
	p.size = Vector2(560, 360)
	var v := VBoxContainer.new()
	v.set_anchors_preset(Control.PRESET_FULL_RECT)
	v.offset_left = 16
	v.offset_top = 16
	v.offset_right = -16
	v.offset_bottom = -16
	v.add_theme_constant_override("separation", 8)
	p.add_child(v)
	v.add_child(UiKit.lbl("Settings", 22, UiKit.GOLD))

	var fs := CheckBox.new()
	fs.text = "Fullscreen"
	fs.button_pressed = Persist.fullscreen
	fs.toggled.connect(func(on: bool) -> void:
		Persist.fullscreen = on
		Persist.apply()
		Persist.save_settings()
	)
	v.add_child(fs)

	var hints := CheckBox.new()
	hints.text = "Show key hints on the HUD"
	hints.button_pressed = Persist.key_hints
	hints.toggled.connect(func(on: bool) -> void:
		Persist.key_hints = on
		Persist.save_settings()
	)
	v.add_child(hints)

	v.add_child(_vol_row("Master", Persist.master_vol, func(val: float) -> void:
		Persist.master_vol = val
		Persist.apply()
		Persist.save_settings()
	))
	v.add_child(_vol_row("SFX", Persist.sfx_vol, func(val: float) -> void:
		Persist.sfx_vol = val
		Persist.apply()
		Persist.save_settings()
	))
	v.add_child(_vol_row("Music", Persist.music_vol, func(val: float) -> void:
		Persist.music_vol = val
		Persist.apply()
		Persist.save_settings()
	))

	v.add_child(UiKit.lbl("Keys: WASD / arrows / numpad (diagonals). Wait: . or numpad 5. Inventory: I. Esc: pause. Stairs: , or bump.", 14, UiKit.DIM))
	return p


func _vol_row(label: String, initial: float, on_change: Callable) -> Control:
	var h := HBoxContainer.new()
	var l := UiKit.lbl(label, 15)
	l.custom_minimum_size = Vector2(80, 0)
	h.add_child(l)
	var s := HSlider.new()
	s.min_value = 0
	s.max_value = 1
	s.step = 0.01
	s.value = initial
	s.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	s.value_changed.connect(on_change)
	h.add_child(s)
	return h


func _refresh_grave() -> void:
	for c in _grave_box.get_children():
		c.queue_free()
	_grave_box.add_child(UiKit.lbl("Graveyard  ·  local only (user://)", 20, UiKit.GOLD))
	if Persist.graveyard.is_empty():
		_grave_box.add_child(UiKit.lbl("No closed runs yet.", 15, UiKit.DIM))
		return
	for e in Persist.graveyard:
		var line := "%s  ·  %s at depth %s  ·  kills %s  ·  gold %s  pages %s  ·  %s" % [
			e.get("outcome", "?"), e.get("cause", ""), e.get("depth", "?"),
			e.get("kills", "?"), e.get("gold", "?"), e.get("pages", "?"), e.get("when", "")
		]
		_grave_box.add_child(UiKit.lbl(line, 13, UiKit.PAPER))
