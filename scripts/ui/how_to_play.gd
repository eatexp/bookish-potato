extends Control

const TEXT := """BOOKISH POTATOE
A classic turn-based roguelike. You are a potato who reads. The dungeon is a library that bets.

GOAL
Descend ten floors. On the tenth, recover the First Edition. A Binding Exit then unseals in that floor's first chamber. Walk into it to escape. That is the only win.

PERMDEATH
Death ends the run. There is no mid-run save. You will see a recap (depth, kills, gold, pages, cause, biggest gamble won and lost) stored locally in the graveyard.

THE DUNGEON
Procedural rooms, corridors, doors, stairs. Unseen tiles are black. Explored tiles remain as dim memory. Your lantern FOV is short; do not expect to stall in the dark forever.

Appetite (hunger) ticks as you act. Floor 1 is lenient. Starvation hurts. Jars of Cold Mash and tea restore it. Waiting (period / numpad 5) still spends a turn.

COMBAT
Bump into a foe to attack. Your tome is a weapon; your binding is armor.
  Bookworm — melee rusher.
  Inkblot — prefers to spit from range.
  Codex Golem — tank. Moves every other turn, hits like a due date.
  Page Thief — ambush, steals gold or pages, flees when wounded.
  Errata Moth — dusts you so later swings miss.

DUAL CURRENCIES
Gold buys and scores. Pages (bookmarks, leaves) are the house's chips. Both matter. Both can be lost.

UNIDENTIFIED FOLIOS
Loot includes mute books.
  Carefully Read — safe identify. Costs a turn and a little appetite.
  Gamble-Read — the selling point. Instant. The folio may bloom into a rare tome and scorch nearby foes (and pay pages), or it may curse, explode, and leave you holding errata.
Do not skip this. It is the heart of the game.

THE STACK
A felt-table bookie nook. It can appear as a room on a floor (bump the desk) and also between chapters.
  Shop — buy and sell books and unidentified folios.
  Chapter Slots — bet gold or pages on a three-reel tome: TITLE / CHAPTER / FOOTNOTE. Pays gold, pages, items, or cursed errata.
  Leave — continue the crawl.

BLURB ODDS
Never forced. When you stand next to a monster, press B. The house quotes odds from that monster's blurb. Stake pages. If you kill that foe, you are paid. If you leave the floor or die, the stake is burned.

EQUIPPABLE TOMES
Weapons are books.
  Charred Cookbook — fire.
  Pocket Dictionary — defines / slows.
  Pocket Atlas — knocks foes back.
  Hymnal of Errata — confuses.
  Ledger of Debts — mints gold on hit.
Bindings are armor (cloth, board, iron clasps).

CONTROLS
  Move: WASD, arrows, numpad (diagonals on 1,3,7,9). Q/E/Z/C also diagonal.
  Wait: period or numpad 5 or X
  Inventory: I     Equip / Use / Drop / Read / Gamble-Read from the panel
  Blurb Odds: B
  Stairs: bump them, or comma
  Pause: Esc (resume, abandon run, settings, quit to menu)
  Mouse: optional click to step toward a tile

THE HOUSE
Local high scores live in user:// (graveyard + settings). No Steamworks is required to play. See the README for what remains before a Steam ship.
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
