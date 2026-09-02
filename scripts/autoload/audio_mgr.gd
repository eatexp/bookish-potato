extends Node

var _sfx: Dictionary = {}
var _music: AudioStreamPlayer


func _ready() -> void:
	_music = AudioStreamPlayer.new()
	_music.bus = "Music"
	add_child(_music)
	var theme := load("res://assets/audio/theme.wav")
	if theme is AudioStreamWAV:
		var wav := theme as AudioStreamWAV
		wav.loop_mode = AudioStreamWAV.LOOP_FORWARD
		_music.stream = wav
	elif theme is AudioStream:
		_music.stream = theme
	_music.finished.connect(func() -> void:
		if _music.stream:
			_music.play()
	)
	var names := [
		"hit", "miss", "pickup", "stairs", "death", "page", "slot", "curse",
		"identify", "win", "boom", "potion", "ui", "open"
	]
	for n in names:
		var p := AudioStreamPlayer.new()
		p.bus = "SFX"
		p.stream = load("res://assets/audio/%s.wav" % n)
		p.name = n
		add_child(p)
		_sfx[n] = p


func play(sfx_name: String) -> void:
	if _sfx.has(sfx_name):
		(_sfx[sfx_name] as AudioStreamPlayer).play()


func play_music() -> void:
	if _music.stream and not _music.playing:
		_music.play()


func stop_music() -> void:
	_music.stop()
