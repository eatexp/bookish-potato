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
	UiKit.ensure_input()
	UiKit.apply_theme(self)
	UiKit.fill(self)
	DisplayServer.window_set_title("Bookish Potato: The First Edition")
	var bg := ColorRect.new()
	bg.color = Color(0.09, 0.07, 0.05)
	UiKit.fill(bg)
	add_child(bg)
	var title := UiKit.lbl("How to play", 28, UiKit.GOLD)
	title.position = Vector2(56, 28)
	title.size = Vector2(1100, 40)
	add_child(title)
	var scroll := ScrollContainer.new()
	scroll.position = Vector2(56, 80)
	scroll.size = Vector2(1168, 540)
	add_child(scroll)
	var body := Label.new()
	body.text = TEXT
	body.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	body.custom_minimum_size = Vector2(1140, 0)
	body.add_theme_font_size_override("font_size", 16)
	body.add_theme_color_override("font_color", UiKit.PAPER)
	scroll.add_child(body)
	var back := UiKit.btn("Back", 200)
	back.position = Vector2(56, 640)
	back.pressed.connect(func() -> void:
		get_tree().change_scene_to_file("res://scenes/main_menu.tscn")
	)
	add_child(back)
