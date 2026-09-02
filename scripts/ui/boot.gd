extends Control

## First scene: input map, settings, then the library doors.


func _ready() -> void:
	UiKit.ensure_input()
	DisplayServer.window_set_title("Bookish Potato: The First Edition")
	Persist.apply()
	AudioMgr.play_music()
	get_tree().change_scene_to_file.call_deferred("res://scenes/main_menu.tscn")
