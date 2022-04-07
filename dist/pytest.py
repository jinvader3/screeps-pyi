import os

def creep_thread(creep_id):
  room_id = os.creep_get_room_id(creep_id)
  source_ids = os.get_source_ids(room_id)
  controller_id = os.get_controller_id(room_id)

  while True:
    os.debug('creep loop')

    if os.creep_energy_used_cap() == 0:
      os.creep_memory_write_key('mode', 'pull')
    
    if os.creep_energy_free_cap() == 0:
      os.creep_memory_write_key('mode', 'push')

    if os.creep_memory_read_key('mode') == 'push':
      if os.creep_upgrade(controller_id) is False:
        os.creep_move_to(controller_id)
    else:
      if os.creep_harvest(source_ids[0]) is False:
        os.creep_move_to(source_ids[0])

    os.next_tick()

def main():
  spawned = {}  
  while True:
    # Each tick spawn a thread for each newly seen creep.
    creep_ids = os.get_creep_ids()
    for creep_id in creep_ids:
      if creep_id not in spawned:
        spawned[creep_id] = True
        os.spawn_thread(creep_thread, creep_id)
    # Block the thread until the next tick.
    os.next_tick()

main()
