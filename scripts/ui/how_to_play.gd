extends Control

const TEXT := """BOOKISH POTATO: THE FIRST EDITION
v0.1. Real-time survival in one library floor. You are a potato who reads. The stacks are the stage. Tomes fire themselves.

This game does not contain any real-world currency gambling or microtransactions.

THE HOUR
Survive about twelve minutes. Booklice thicken as the clock runs. Closing time is a brood surge. Death ends the run. There is no mid-run save.

MOVE AND FIRE
WASD or arrows. Facing follows movement. Equipped tomes auto-fire. No dodge-roll. No manual aim.

LEAVES
Fallen pages are experience. Walk over them. A Silk Bookmark (if you find one) draws them in.

LEVEL-UP
The world pauses. Three unidentified folio cards. One click shelves a tome. Optional: shelve (keep a card) or stamp (reshelve, 1 page) as icons on the card — not a second screen.

FLOOR FOLIOS
Chests of unread books. Collate (safe, modest) or Crack the spine (swingy). The book opens: cover, crack, page flutter. Collate is always available.

RETURNS DESK
After the run only. Pages buy unidentified folios for the NEXT run. Sells nothing. No shop between waves.

TOMES (six on the lectern at most)
  Margin Notes — paper darts the way you walk.
  Charred Cookbook — grease-fire cone.
  Pocket Dictionary — defining pulse, slows.
  Pocket Atlas — orbiting pages.
  Hymnal of Errata — wide knockback.
  Ledger of Debts — seeking entries.
Courtesies: Silk Bookmark, Cloth Cover, Iron Clasps. Misfile: Cursed Errata.

CONTROLS
  Move: WASD or arrows
  Level-up: click a card, or 1 / 2 / 3
  Pause: Esc
"""


func _ready() -> void:
	UiKit.ensure_input()
	UiKit.apply_theme(self)
	UiKit.fill(self)
	var bg := ColorRect.new()
	bg.color = UiKit.BG
	UiKit.fill(bg)
	add_child(bg)

	var panel := Panel.new()
	panel.set_anchors_preset(Control.PRESET_FULL_RECT)
	panel.offset_left = 48
	panel.offset_top = 36
	panel.offset_right = -48
	panel.offset_bottom = -36
	add_child(panel)

	var v := VBoxContainer.new()
	UiKit.fill(v)
	v.offset_left = 20
	v.offset_top = 16
	v.offset_right = -20
	v.offset_bottom = -16
	panel.add_child(v)

	var top := HBoxContainer.new()
	v.add_child(top)
	top.add_child(UiKit.lbl("How to Play", 28, UiKit.GOLD))
	var spacer := Control.new()
	spacer.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	top.add_child(spacer)
	var back := UiKit.btn("Back", 140)
	back.pressed.connect(func() -> void:
		get_tree().change_scene_to_file("res://scenes/main_menu.tscn")
	)
	top.add_child(back)

	var scroll := ScrollContainer.new()
	scroll.size_flags_vertical = Control.SIZE_EXPAND_FILL
	v.add_child(scroll)
	var body := UiKit.lbl(TEXT, 16, UiKit.PAPER)
	body.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	scroll.add_child(body)
