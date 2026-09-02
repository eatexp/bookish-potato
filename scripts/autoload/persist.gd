extends Node

const SETTINGS_PATH := "user://settings.cfg"
const GRAVE_PATH := "user://graveyard.json"

var fullscreen := false
var master_vol := 0.85
var sfx_vol := 0.9
var music_vol := 0.4
var key_hints := true

var graveyard: Array = []


func _ready() -> void:
	load_settings()
	load_graveyard()
	apply()


func apply() -> void:
	if fullscreen:
		DisplayServer.window_set_mode(DisplayServer.WINDOW_MODE_FULLSCREEN)
	else:
		DisplayServer.window_set_mode(DisplayServer.WINDOW_MODE_WINDOWED)
	_bus("Master", master_vol)
	_bus("SFX", sfx_vol)
	_bus("Music", music_vol)


func _bus(bus_name: String, linear: float) -> void:
	var idx := AudioServer.get_bus_index(bus_name)
	if idx < 0:
		return
	var v := clampf(linear, 0.0, 1.0)
	if v <= 0.001:
		AudioServer.set_bus_volume_db(idx, -80.0)
	else:
		AudioServer.set_bus_volume_db(idx, linear_to_db(v))


func load_settings() -> void:
	var cfg := ConfigFile.new()
	if cfg.load(SETTINGS_PATH) != OK:
		return
	fullscreen = bool(cfg.get_value("video", "fullscreen", false))
	master_vol = float(cfg.get_value("audio", "master", 0.85))
	sfx_vol = float(cfg.get_value("audio", "sfx", 0.9))
	music_vol = float(cfg.get_value("audio", "music", 0.4))
	key_hints = bool(cfg.get_value("ui", "key_hints", true))


func save_settings() -> void:
	var cfg := ConfigFile.new()
	cfg.set_value("video", "fullscreen", fullscreen)
	cfg.set_value("audio", "master", master_vol)
	cfg.set_value("audio", "sfx", sfx_vol)
	cfg.set_value("audio", "music", music_vol)
	cfg.set_value("ui", "key_hints", key_hints)
	cfg.save(SETTINGS_PATH)


func load_graveyard() -> void:
	if not FileAccess.file_exists(GRAVE_PATH):
		graveyard = []
		return
	var f := FileAccess.open(GRAVE_PATH, FileAccess.READ)
	if f == null:
		graveyard = []
		return
	var parsed: Variant = JSON.parse_string(f.get_as_text())
	if parsed is Array:
		graveyard = parsed
	else:
		graveyard = []


func save_graveyard() -> void:
	var f := FileAccess.open(GRAVE_PATH, FileAccess.WRITE)
	if f == null:
		return
	f.store_string(JSON.stringify(graveyard, "\t"))


func add_entry(entry: Dictionary) -> void:
	graveyard.push_front(entry)
	if graveyard.size() > 40:
		graveyard.resize(40)
	save_graveyard()
