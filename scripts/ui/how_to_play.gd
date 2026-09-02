extends Control

const TEXT := """Bookish Potato: The First Edition
A 2D bullet heaven on one floor of The Stacks.

You are a potato sprite with a library card. Move with WASD. Primer fires itself from the first second — flying index cards, no extra button. XP from overdue patrons fills the bar. Three identified folio cards. One click. The floor pauses.

Five tomes
• Primer — start. Auto-fire on spawn. Flying index cards with a paper trail.
• Cookbook — close aura. Steam and recipe-page glow.
• Atlas — orbiting open folios with a page-flutter trail.
• Dictionary — slow letter-ripple pulse. Never the first offer.
• Gazette — spread clippings that shove.

The first folio draw is Cookbook or Atlas. Dictionary and passives wait. Errata and Misfile never sit on that row.

Passives (later levels): Bookplate magnet, Colophon pages of HP, Dust jacket armor, Overdue stamp speed.

Floor pickups
Collate — always available. Identified folio. No tax.
Crack — optional. Identified folio plus extra pages, with a small HP sting. The book opens. No reel.

Returns Desk
After the run. Unidentified folios. Pages. Stamp to acquire. No sell, no reroll, no retrieve.

Closing Time brings the Fine Collector. Survive until The Stacks close.

This game does not contain any real-world currency gambling or microtransactions."""

func _ready() -> void:
	var bg := ColorRect.new()
	bg.set_anchors_preset(PRESET_FULL_RECT)
	bg.color = Color(0.09, 0.07, 0.05)
	add_child(bg)
	var panel := PanelContainer.new()
	panel.set_anchors_preset(PRESET_FULL_RECT)
	panel.add_theme_constant_override("margin_left", 56)
	panel.add_theme_constant_override("margin_right", 56)
	panel.add_theme_constant_override("margin_top", 40)
	panel.add_theme_constant_override("margin_bottom", 40)
	add_child(panel)
	var v := VBoxContainer.new()
	v.add_theme_constant_override("separation", 12)
	panel.add_child(v)
	var title := Label.new()
	title.text = "How to play"
	title.add_theme_font_size_override("font_size", 28)
	v.add_child(title)
	var scroll := ScrollContainer.new()
	scroll.size_flags_vertical = Control.SIZE_EXPAND_FILL
	v.add_child(scroll)
	var body := Label.new()
	body.text = TEXT
	body.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	scroll.add_child(body)
	var back := Button.new()
	back.text = "Back"
	back.pressed.connect(func() -> void: get_tree().change_scene_to_file("res://scenes/main_menu.tscn"))
	v.add_child(back)
