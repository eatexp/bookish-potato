extends Node

## Placeholder for a later GodotSteam (or equivalent) integration.
## The game must boot and save locally when APP_ID is 0 and no plugin is present.

const APP_ID := 0


func _ready() -> void:
	if APP_ID == 0:
		return
	# Future: initialize overlay, achievements, cloud of graveyard/settings only.


func is_available() -> bool:
	return false


func note_achievement(_id: String) -> void:
	pass
