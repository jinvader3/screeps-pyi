import os
import game

def creep_thread(creep_id):
  room_id = game.creep_get_room_id(creep_id)
  source_ids = game.get_source_ids(room_id)
  controller_id = game.get_controller_id(room_id)

  while True:
    game.debug('creep loop')

    if game.creep_energy_used_cap(creep_id) == 0:
      game.creep_memory_write_key(creep_id, 'mode', 'pull')
    
    if game.creep_energy_free_cap(creep_id) == 0:
      game.creep_memory_write_key(creep_id, 'mode', 'push')

    if game.creep_memory_read_key(creep_id, 'mode') == 'push':
      if game.creep_upgrade(creep_id, controller_id) is False:
        game.creep_move_to(creep_id, controller_id)
    else:
      if game.creep_harvest(creep_id, source_ids[0]) is False:
        game.creep_move_to(creep_id, source_ids[0])

    os.next_tick()

def main():
  spawned = {}  
  while True:
    # Each tick spawn a thread for each newly seen creep.
    creep_ids = game.get_creep_ids()
    for creep_id in creep_ids:
      if creep_id not in spawned:
        spawned[creep_id] = True
        os.spawn_thread(creep_thread, creep_id)
      # Block the thread until the next tick.
    os.next_tick()

main()
