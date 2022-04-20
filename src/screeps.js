function register_module (pyi) {
  pyi.register_module('game');

  pyi.register_module_method('game', 'debug', (tid, args, cobj, base, frame) => {
    console.log('DEBUG', args[0].val);
    return pyi.new_object({ type: 'none' });
  });

  pyi.register_module_method('game', 'get_creep_ids', (tid, args, cobj, base, frame) => {
    const out = [];
    for (let cname in Game.creeps) {
      out.push(pyi.new_object({
        type: 'str', val: cname,
      }));
    }
    return pyi.new_object({ type: 'list', data: out });
  });

  pyi.register_module_method('game', 'creep_get_room_id', (tid, args, cobj, base, frame) => {
    const creep = Game.creeps[args[0].val];
    if (creep === undefined) {
      return pyi.new_object({ type: 'none' });
    }
    
    return pyi.new_object({ type: 'str', val: creep.pos.roomName });
  });

  pyi.register_module_method('game', 'get_source_ids', (tid, args, cobj, base, frame) => {
    const srcs = Game.rooms[args[0].val].find(FIND_SOURCES);
    const out = [];
    for (let src of srcs) {
      out.push(pyi.new_object({ type: 'str', val: src.id }));
    }
    return pyi.new_object({ type: 'list', data: out });
  });

  pyi.register_module_method('game', 'get_controller_id', (tid, args, cobj, base, frame) => {
    return pyi.new_object({ type: 'str', val: Game.rooms[args[0].val].controller.id }); 
  });

  pyi.register_module_method('game', 'creep_energy_used_cap', (tid, args, cobj, base, frame) => {
    const cap = Game.creeps[args[0].val].store.getUsedCapacity(RESOURCE_ENERGY);
    return pyi.new_object({
      type: 'int', val: cap,
    });
  });

  pyi.register_module_method('game', 'creep_energy_free_cap', (tid, args, cobj, base, frame) => {
    const cap = Game.creeps[args[0].val].store.getFreeCapacity(RESOURCE_ENERGY);
    return pyi.new_object({
      type: 'int', val: cap,
    });
  });

  pyi.register_module_method('game', 'creep_memory_write_key', (tid, args, cobj, base, frame) => {
    const creep = Game.creeps[args[0].val];
    creep.memory[args[1].val] = args[2];
    return pyi.new_object({ type: 'none' });
  });

  pyi.register_module_method('game', 'creep_memory_read_key', (tid, args, cobj, base, frame) => {
    const creep = Game.creeps[args[0].val];
    let data = creep.memory[args[1].val];
    if (data === undefined) {
      data = { type: 'none' }
    } else {
      data = { type: 'str', val: new String(data) };
    }
    data.__id = undefined;
    return pyi.new_object(data);
  });

  pyi.register_module_method('game', 'creep_harvest', (tid, args, cobj, base, frame) => {
    const creep = Game.creeps[args[0].val];
    const trgt_id = args[1].val;
    const res = creep.harvest(Game.getObjectById(trgt_id));
    return pyi.new_object({
      type: 'bool', val: res === OK,
    });
  });

  pyi.register_module_method('game', 'creep_upgrade', (tid, args, cobj, base, frame) => {
    const creep = Game.creeps[args[0].val];
    const trgt_id = args[1].val;
    const res = creep.upgradeController(Game.getObjectById(trgt_id));
    return pyi.new_object({
      type: 'bool', val: res === OK,
    });
  });

  pyi.register_module_method('game', 'get_move_to', (tid, args, cobj, base, frame) => {
    const creep = Game.creeps[args[0].val];
    const trgt_id = args[1].val;
    const res = creep.moveTo(Game.getObjectById(trgt_id));
    console.log('res', res);
    return pyi.new_object({
      type: 'bool', val: res === OK,
    });
  });
}

module.exports.register_module = register_module;
