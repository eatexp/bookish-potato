extends Control

const TEXT := """BOOKISH POTATO: THE FIRST EDITION
v0.1 slice. A classic turn-based dungeon crawler. You are a potato who reads. The library is flavor. The crawl is the game.

This game does not contain any real-world currency gambling or microtransactions.

GOAL (this slice)
Five floors. On the last, recover the Notable Folio. A Binding Exit unseals in that floor's first chamber. Walk into it. The true First Edition run is later.

PERMDEATH
Death ends the run. No mid-run save. Recap (depth, kills, gold, pages, cause, biggest catalogue win / worst misfile) goes to a local graveyard.

THE DUNGEON
Procedural rooms, corridors, doors, stairs. Unseen tiles are black. Explored tiles stay as dim memory. Lantern FOV is short.

A burning candle is the anti-stall. Floor 1 is lenient. A dead wick hurts. Mash and tea restore wax. Waiting still spends a turn.

COMBAT
Bump to attack. Your tome is a weapon; your binding is armor.
  Bookworm — melee rusher.
  Inkblot — prefers range.
  Codex Golem — tank. Moves every other turn.
  Page Thief — ambush, steals gold or pages, flees wounded.
  Errata Moth — dusts you so later swings miss.

CURRENCIES
Gold is coin. Pages are an in-run catalogue resource (earned in the dungeon only). Neither can be bought with real money. There is no trading and no cash-out.

UNIDENTIFIED FOLIOS (the hook)
Every book loot is an unknown edition.
  Collate — safe identify. Costs a turn and a little candle.
  Crack the spine — instant, your choice. A strong edition may flare, or a misfile may curse.
A librarian's tell on the unread spine hints quality before you choose (tight stitching vs vinegar glue). Pity: you will not take three misfiles in a row from cracking spines.

RETURNS DESK (between some floors)
They buy unidentified folios for pages. They sell nothing. A real shop comes later.

CATALOGUE A SHELF
You choose a shelf (Cookery, Reference, Maps, Accounts, Restricted). Three slips are laid out. Spend pages to lock a slip or recatalogue an unlocked one, then take one. No reels. Nothing spins.

EQUIPPABLE TOMES
  Charred Cookbook — fire.
  Pocket Dictionary — defines / slows.
  Pocket Atlas — knocks foes back.
  Hymnal of Errata — confuses.
  Ledger of Debts — coin on hit.
Bindings are armor.

CONTROLS
  Move: WASD, arrows, numpad (diagonals 1,3,7,9). Q/E/Z/C also diagonal.
  Wait: period or numpad 5 or X
  Inventory: I     Equip E / Use U / Drop D / Collate R / Crack G
  Stairs: bump, or comma
  Pause: Esc
  Mouse: optional click to step toward a tile
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
