class_name UiKit
extends RefCounted

const BG := Color(0.07, 0.05, 0.04, 1)
const PANEL := Color(0.10, 0.07, 0.06, 0.94)
const PANEL_EDGE := Color(0.72, 0.52, 0.18, 0.85)
const BTN := Color(0.16, 0.12, 0.09, 1)
const BTN_HOVER := Color(0.28, 0.20, 0.12, 1)
const GOLD := Color(0.83, 0.63, 0.14, 1)
const PAPER := Color(0.91, 0.86, 0.76, 1)
const DIM := Color(0.62, 0.55, 0.46, 1)
const HP := Color(0.72, 0.24, 0.18, 1)
const FELT := Color(0.12, 0.28, 0.20, 1)

static var _input_ready := false


static func ensure_input() -> void:
	if _input_ready:
		return
	_input_ready = true
	_act("move_n", [KEY_W, KEY_UP, KEY_KP_8])
	_act("move_s", [KEY_S, KEY_DOWN, KEY_KP_2])
	_act("move_w", [KEY_A, KEY_LEFT, KEY_KP_4])
	_act("move_e", [KEY_D, KEY_RIGHT, KEY_KP_6])
	_act("move_nw", [KEY_KP_7, KEY_Q])
	_act("move_ne", [KEY_KP_9, KEY_E])
	_act("move_sw", [KEY_KP_1, KEY_Z])
	_act("move_se", [KEY_KP_3, KEY_C])
	_act("wait", [KEY_PERIOD, KEY_KP_5, KEY_X])
	_act("inventory", [KEY_I])
	_act("blurb", [KEY_B])
	_act("stairs", [KEY_COMMA, KEY_GREATER])
	_act("pause", [KEY_ESCAPE])
	_act("confirm", [KEY_ENTER, KEY_SPACE, KEY_KP_ENTER])


static func _act(action: String, keys: Array) -> void:
	if not InputMap.has_action(action):
		InputMap.add_action(action)
	for k in keys:
		var ev := InputEventKey.new()
		ev.physical_keycode = k
		if not InputMap.action_has_event(action, ev):
			InputMap.action_add_event(action, ev)


static func style_box(bg: Color, border: Color = PANEL_EDGE, bw: int = 2) -> StyleBoxFlat:
	var s := StyleBoxFlat.new()
	s.bg_color = bg
	s.border_color = border
	s.set_border_width_all(bw)
	s.set_corner_radius_all(4)
	s.content_margin_left = 10
	s.content_margin_right = 10
	s.content_margin_top = 6
	s.content_margin_bottom = 6
	return s


static func apply_theme(n: Control) -> void:
	var th := Theme.new()
	th.set_color("font_color", "Label", PAPER)
	th.set_color("font_color", "Button", PAPER)
	th.set_color("font_hover_color", "Button", GOLD)
	th.set_color("font_pressed_color", "Button", GOLD)
	th.set_color("font_color", "CheckBox", PAPER)
	th.set_stylebox("normal", "Button", style_box(BTN, Color(0.45, 0.32, 0.14, 1), 1))
	th.set_stylebox("hover", "Button", style_box(BTN_HOVER, GOLD, 1))
	th.set_stylebox("pressed", "Button", style_box(Color(0.2, 0.14, 0.08), GOLD, 1))
	th.set_stylebox("panel", "Panel", style_box(PANEL, PANEL_EDGE, 2))
	th.set_stylebox("panel", "PanelContainer", style_box(PANEL, PANEL_EDGE, 2))
	n.theme = th


static func btn(text: String, min_w: int = 260) -> Button:
	var b := Button.new()
	b.text = text
	b.custom_minimum_size = Vector2(min_w, 36)
	b.focus_mode = Control.FOCUS_ALL
	return b


static func lbl(text: String, size: int = 16, color: Color = PAPER) -> Label:
	var l := Label.new()
	l.text = text
	l.add_theme_font_size_override("font_size", size)
	l.add_theme_color_override("font_color", color)
	l.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	return l


static func fill(c: Control) -> void:
	c.set_anchors_preset(Control.PRESET_FULL_RECT)
	c.offset_left = 0
	c.offset_top = 0
	c.offset_right = 0
	c.offset_bottom = 0
