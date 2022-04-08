const prog = require('./pytest');

class PyInterp {
  constructor (prog) {
    this.prog = prog;
    this.code_objs = [];
    // SHARED BETWEEN THREADS
    this.globals = {};
    this.objects = {};
    // SINGLE THREAD STATES
    this.threads = {};
    this.last_thread_id = 0;
    this.last_object_id = 0;
    if (prog !== null) {
      this.remap_code_objects();
      this.new_thread(this.prog.data, this.globals);
    }
  }

  new_thread (code, scope) {
    const nt = {
      frame: null,
      frames: [],
    };
    const id = `TID-${this.last_thread_id}`;
    this.last_thread_id++;
    this.threads[id] = nt;
    this.new_frame(id, code, scope);
    return id;
  }

  new_object_id () {
    const oid = `OID-${this.last_object_id}`;
    this.last_object_id++;
    return oid;
  }

  new_object (obj) {
    if (typeof obj !== 'object') {
      throw new Error('obj must be an object');
    }
    if (obj.__id !== undefined) {
      return obj;
    }
    const id = this.new_object_id();
    obj.__id = id;
    return obj;
  }

  // Transverse all code objects above root and linearize them then
  // replace their positions with a unique identifier. This will reduce
  // the size of each code object as it gets duplicated around. It 
  // basically de-nests them and in turn uses an identifier as a reference.
  remap_code_objects (cur) {
    cur = cur || this.prog.data;
    for (let cnst of cur.co_consts) {
      if (cnst.type === 'code') {
        const code = cnst.code;
        this.code_objs.push(code);
        cnst.code = this.code_objs.length - 1;
        console.log('remapped code', cnst.code);
        this.remap_code_objects(code);
      }
    }
  }

  get_code_object_by_id (id) {
    const out = this.code_objs[id];
    if (out === undefined) {
      throw new Error('get_code_object_by_id failed');
    }
    return out;
  }

  new_frame (thread_ndx, code, scope) {
    const tstate = this.threads[thread_ndx];
    if (tstate.frame) {
      // SAVE THE OLD FRAME
      tstate.frames.push(tstate.frame);
    }
    // CREATE THE NEW FRAME
    tstate.frame = {
      code:         code,
      ip:           0,
      stack:        [],
      locals:  scope,
      next_tick:    false,
    };
  }

  thread_active (thread_id) {
    if (this.threads[thread_id].next_tick) {
      return false;
    }

    const v = this.threads[thread_id].frame;
    return v !== undefined && v !== null;
  }

  clear_next_tick () {
    for (let tid in this.threads) {
      const state = this.threads[tid];
      state.next_tick = false;
    }
  }

  pop_frame (thread_ndx, retval) {
    const tstate = this.threads[thread_ndx];
    tstate.frame = tstate.frames.pop();

    if (tstate.frame) {
      tstate.frame.stack.push(retval); 
      return false;
    }

    return true;
  } 

  load_module (name, fromlist, level) {
    if (name === 'os') {
      return { type: 'internal-module', val: 'os' };
    }
    
    throw new Error('not implemented');
  }

  internal_module_load_method (mod_name, method_name) {
    return { 
      type: 'internal-method', 
      module: mod_name,
      method: method_name,
    };
  }

  internal_method_call (thread_id, args, cobj, base, frame) {
    const state = this.threads[thread_id];

    switch (cobj.module) {
      case 'builtins':
        switch (cobj.method.val) {
          case '__build_class__':
            throw new Error('__build_class__');
          default:
            throw new Error('not implemented');
        }
        break;
      case 'os':
        switch (cobj.method.val) {
          case 'spawn_thread':
            const qname = args[0].val[0];
            const code = this.get_code_object_by_id(args[0].val[1].code);
            const ntid = this.new_thread(code, {});
            for (let x = 0; x < this.threads[ntid].frame.code.co_argcount; ++x) {
              let argname = this.threads[ntid].frame.code.co_varnames[x];
              console.log('loading spawn_thread function argument', argname, args[x+1]);
              this.threads[ntid].frame.locals[argname.val] = args[x+1];
            }
            break;
          case 'debug':
            console.log('DEBUG', args[0].val);
            break;
          case 'next_tick':
            state.next_tick = true;
            break;
          case 'get_creep_ids':
            {
              const out = [];
              for (let cname in Game.creeps) {
                out.push(this.new_object({
                  type: 'str', val: cname,
                }));
              }
              return this.new_object({ type: 'list', data: out });
            }
            break;
          case 'creep_get_room_id':
            return this.new_object({
              type: 'str', val: 'W1N2'
            });
          case 'get_source_ids':
            {
              const srcs = Game.rooms[args[0].val].find(FIND_SOURCES);
              const out = [];
              for (let src of srcs) {
                out.push(this.new_object({ type: 'str', val: src.id }));
              }
              return this.new_object({ type: 'list', data: out })
            }
          case 'get_controller_id':
            {
              const cid = Game.rooms[args[0].val].controller.id;
              return this.new_object({ 
                type: 'str', val: cid,
              });
            }
          case 'creep_energy_used_cap':
            {
              console.log('.....', args);
              const cap = Game.creeps[args[0].val].store.getUsedCapacity(RESOURCE_ENERGY);
              return this.new_object({
                type: 'int', val: cap,
              });
            }
          case 'creep_energy_free_cap':
            {
              const cap = Game.creeps[args[0].val].store.getFreeCapacity(RESOURCE_ENERGY);
              return this.new_object({
                type: 'int', val: cap,
              });
            }
          case 'creep_memory_write_key':
            {
              const creep = Game.creeps[args[0].val];
              creep.memory[args[1].val] = args[2];
            }
            break;
          case 'creep_memory_read_key':
            {
              const creep = Game.creeps[args[0].val];
              let data = creep.memory[args[1].val];
              if (data === undefined) {
                data = { type: 'none' }
              }
              data.__id = undefined;
              return this.new_object(data);
            }
          case 'creep_harvest':
            {
              const creep = Game.creeps[args[0].val];
              const tid = args[1].val;
              const res = creep.harvest(Game.getObjectById(tid));
              return this.new_object({
                type: 'bool', val: res === OK,
              });
            }
          case 'creep_upgrade':
            {
              const creep = Game.creeps[args[0].val];
              const tid = args[1].val;
              const res = creep.upgradeController(Game.getObjectById(tid));
              return this.new_object({
                type: 'bool', val: res === OK,
              });
            }
          case 'creep_move_to':
            {
              const creep = Game.creeps[args[0].val];
              const tid = args[1].val;
              const res = creep.moveTo(Game.getObjectById(tid));
              console.log('res', res);
              return this.new_object({
                type: 'bool', val: res === OK,
              });
            }
          default:
            console.log(frame.code.opcodes[frame.ip + 1]);
            throw new Error('not implemented');
        }
        break;
      default:
        throw new Error('not implemented');
    }

    return { type: 'none' }
  }

  execute_all () {
    let some_alive = false;

    for (let tid in this.threads) {
      if (this.thread_active(tid)) {
        this.execute_single(tid);
        some_alive = true;
      }
    }

    return some_alive;
  }

  assert (cond) {
    if (!cond) {
      throw new Error('ASSERTION FAILURE');
    }
  }

  serialize () {
    const objects = {};
    const self = this;

    function dedup_objects(stack) {
      for (let ndx in stack) {
        let item = stack[ndx];
        self.assert(item.__id !== undefined);
        if (objects[item.__id] === undefined) {
          objects[item.__id] = item;
          if (item.type === 'iter') {
            // For iterators also package the object it references.
            let sobj = item.obj;
            if (objects[sobj.__id] === undefined) {
              objects[sobj.__id] = sobj;
            }
            item.obj = sobj.__id;
          }
        }
        stack[ndx] = item.__id;
      }
    }

    // Go through and wipe the stacks by deduplicating objects.
    for (let tid in this.threads) {
      let state = this.threads[tid];
      for (let frame of state.frames) {
        dedup_objects(frame.stack);
        dedup_objects(frame.locals);
      }
      dedup_objects(state.frame.stack); 
      dedup_objects(state.frame.locals);
    }
    
    // On serialization, globals is locals on thread 0, therefore,
    // it was already serialized. We just need to remember to relink
    // it on deserialization.
    //dedup_objects(this.globals);

    return {
      objects: objects,
      threads: this.threads,
      globals: null,
      code_objs: this.code_objs,
      last_thread_id: this.last_thread_id,
      last_object_id: this.last_object_id,
    };
  }

  deserialize (data) {
    const save = data;
    const objects = save.objects;

    this.threads = save.threads;
    this.globals = save.globals;
    this.code_objs = save.code_objs;
    this.last_thread_id = save.last_thread_id;
    this.last_object_id = save.last_object_id;

    const self = this;

    function dup_objects(stack) {
      for (let ndx in stack) {
        const oid = stack[ndx];
        const obj = objects[oid];
        self.assert(obj.__id !== undefined);
        stack[ndx] = obj;
        if (obj.type === 'iter') {
          obj.obj = objects[obj.obj];
        }
      }
    }

    for (let tid in this.threads) {
      const state = this.threads[tid];
      for (let frame of state.frames) {
        dup_objects(frame.stack);
        dup_objects(frame.locals);
      }
      dup_objects(state.frame.stack);
      dup_objects(state.frame.locals);
    }

    const state = this.threads['TID-0'];
    if (state.frames.length === 0) {
      this.globals = state.frame.locals;
    } else {
      this.globals = state.frames[0].locals;
    }
  }

  get_var (frame, name) {
    if (frame.locals[name] === undefined) {
      return this.globals[name];
    }

    return frame.locals[name];
  }

  opcode_load_const(arg, thread_id, frame) {
    // This is the equivalent to allocating some memory and
    // writing to that memory the object itself. We return
    // the equivalent of a memory address.
    return this.new_object(frame.code.co_consts[arg]);
  }

  opcode_build_map (arg, thread_id, frame) {
    const args = [];

    const obj = {
      type: 'map',
      data: [],
    }

    for (let x = 0; x < arg; ++x) {
      const value = frame.stack.pop();
      const key = frame.stack.pop();
      obj.data.push([key, value])
    }

    frame.stack.push(this.new_object(obj));
  }

  opcode_for_iter (arg, thread_id, frame) {
    const tos = frame.stack[frame.stack.length - 1];
    
    if (tos.type !== 'iter') {
      console.log('tos', tos);
      throw new Error('not implemented');
    }

    if (tos.iterndx === tos.obj.data.length) {
      frame.stack.pop();
      frame.ip += arg / 2;
      return;
    }

    const entry = tos.obj.data[tos.iterndx++];
    
    switch (tos.obj.type) {
      case 'map':
        frame.stack.push(entry[1]);
        break;
      case 'list':
        frame.stack.push(entry);
        break;
      default: throw new Error('not implemented');
    }
  }

  opcode_get_iter (arg, thread_id, frame) {
    console.log('GET_ITER', frame.stack);
    const tos = frame.stack.pop();
    const obj = this.new_object({ type: 'iter', obj: tos });
    switch (tos.type) {
      case 'map':
      case 'list':
        obj.iterndx = 0;
        frame.stack.push(obj);
        break;
      default:
        throw new Error('not implemented');
    }
  }

  opcode_load_fast (arg, thread_id, frame) {
    const name = frame.code.co_varnames[arg].val;
    console.log(`..name=${name}`);
    frame.stack.push(this.new_object(frame.locals[name]));
  }

  opcode_store_fast (arg, thread_id, frame) {
    const name = frame.code.co_varnames[arg].val;
    frame.locals[name] = frame.stack.pop(); 
    console.log(frame.locals);
  }

  opcode_binary_subscr (arg, thread_id, frame) {
    const tos = frame.stack.pop();
    const tos1 = frame.stack.pop();

    switch (tos1.type) {
      case 'list':
        switch (tos.type) {
          case 'int':
            frame.stack.push(this.new_object(tos1.data[tos.val]));
            break;
          default: throw new Error('not implemented');
        }
        break;
      default:
        throw new Error(`not implemented ${tos1.type}`);
    } 
  }

  opcode_load_global (arg, thread_id, frame) {
    const name = frame.code.co_names[arg].val;
    console.log(`  name=${name}`);
    if (this.globals[name] === undefined) {
      throw new Error(`load_global failed because ${name} does not exist as local or global`);
    }
    frame.stack.push(this.globals[name]);
  }

  opcode_contains_op (arg, thread_id, frame) {
    const tos = frame.stack.pop();
    const tos1 = frame.stack.pop();
 
    switch (tos.type) {
      case 'map':
        if (this.map_contains_key(tos, tos1)) {
          frame.stack.push(this.new_object({
            type: 'bool', val: arg === 1 ? false : true
          }));
        } else {
          frame.stack.push(this.new_object({
            type: 'bool', val: arg === 1 ? true : false
          }));
        }
        return;
      default: throw new Error('not implemented');
    }
  }

  objs_equal (a, b) {
    if (a.type !== b.type) {
      return false;
    }

    if (a.val !== b.val) {
      return false;
    }

    return true;
  }

  map_contains_key (map, key) {
    return this.map_index_of_key(map, key) === null ? false : true;
  }

  map_index_of_key (map, key) {
    for (let ndx in map.data) {
      let _key = map.data[ndx][0];
      if (this.objs_equal(_key, key)) {
        return ndx;
      }
    }
    return null;
  }

  map_set (map, key, val) {
    let ndx = this.map_index_of_key(map, key);
    if (ndx === null) {
      map.data.push([key, val]);
      return;
    }
    map.data[ndx] = val;
  }

  opcode_compare_op (arg, thread_id, frame) {
    // <
    // <=
    // ==
    // !=
    // >
    // >=
  
    const fm = {
      2: this.objs_equal, 
    };
    
    if (fm[arg] === undefined) {
      throw new Error('not implemented');
    }

    const a = frame.stack.pop();
    const b = frame.stack.pop();

    if (fm[arg](a, b)) {
      frame.stack.push(this.new_object({
        type: 'bool', val: true
      }));
    } else {
      frame.stack.push(this.new_object({
        type: 'bool', val: false
      }));
    }
  }

  opcode_is_op (arg, thread_id, frame) {
    const invert = arg === 1;
    const tos = frame.stack.pop();
    const tos1 = frame.stack.pop();
    
    if (tos.type !== 'bool' || tos1.type !== 'bool') {
      throw new Error(`not implemented [${tos.type} with ${tos1.type}]`);
    }

    if (tos.val === tos1.val) {
      frame.stack.push(this.new_object({
        type: 'bool', val: true,
      }));
    } else {
      frame.stack.push(this.new_object({
        type: 'bool', val: false,
      }));
    }
  }

  opcode_store_subscr (arg, thread_id, frame) {
    const tos = frame.stack.pop();
    const tos1 = frame.stack.pop();
    const tos2 = frame.stack.pop();
    switch (tos1.type) {
      case 'map':
        this.map_set(tos1, tos, tos2);
        break;
      default: throw new Error(`not implemented for ${tos1.type}`);
    }
  }

  opcode_pop_jump_if_true (arg, thread_id, frame) {
    const tos = frame.stack.pop();
    
    switch (tos.type) {
      case 'bool':
        if (tos.val === true) {
          frame.ip = (arg / 2) - 1;
          return;
        }
        return;
      default: throw new Error('not implemented');
    }
  }

  
  opcode_pop_jump_if_false (arg, thread_id, frame) {
    const tos = frame.stack.pop();
    
    switch (tos.type) {
      case 'bool':
        if (tos.val === false) {
          frame.ip = (arg / 2) - 1;
          return;
        }
        return;
      default: throw new Error('not implemented');
    }
  }

  opcode_jump_forward (arg, thread_id, frame) {
    frame.ip += (arg / 2) - 1;
  }

  opcode_call_function (arg, thread_id, frame) {
    let args = [];

    console.log('arg', arg);

    for (let x = 0; x < arg; ++x) {
      args.unshift(frame.stack.pop());
    }

    let cobj = frame.stack.pop();

    switch (cobj.type) {
      case 'str':
        cobj = this.get_var(frame, cobj.val)
        const _code = this.get_code_object_by_id(cobj.val[1].code);
        this.new_frame(thread_id, _code, {});
        break;
      case 'locref':
        const local = frame.locals[cobj.val]
        console.log(`val: ${cobj.val}`, local);
        if (local.type === 'func') {
          const __code = this.get_code_object_by_id(local.val[1].code);
          this.new_frame(thread_id, __code, {});
        } else {
          throw new Error('not implemented');
        }
        break;
      case 'func':
        const ___code = this.get_code_object_by_id(cobj.val[1].code);
        this.new_frame(thread_id, ___code, {});
        break;
      case 'internal-function':
        frame.stack.push(this.new_object(this.internal_method_call(thread_id, args, cobj, null, frame)))
        break;
      default:
        console.log('cobj', cobj);
        throw new Error(`not implemented ${cobj.type}`);
    }
  }

  execute_single (thread_ndx) {
    const tstate = this.threads[thread_ndx];

    if (tstate === undefined) {
      return true;
    }


    const frame = tstate.frame;
    const code = frame.code;
    const op = code.opcodes[frame.ip];
    const co_consts = code.co_consts;
    const co_names = code.co_names;
    const locals = frame.locals;
    const opcode = op.opcode;
    const stack = frame.stack;
    const arg = op.arg;

    let pad = [];

    for (let x = 0; x < tstate.frames.length; ++x) {
      pad.push('  ');
    }
    
    console.log(`${thread_ndx}: ${pad.join('')}${opcode}`);

    switch (opcode) {
      case 'LOAD_CONST':
        stack.push(this.opcode_load_const(arg, thread_ndx, frame));
        break;
      case 'IMPORT_NAME':
        const fromlist = stack.pop();
        const level = stack.pop();
        console.log('import_name', 'name', co_names[arg], 'fromlist', fromlist, 'level', level)
        stack.push(this.new_object(this.load_module(
          co_names[arg].val, fromlist, level
        )));
        break;
      case 'STORE_NAME':
        console.log(co_names[arg].val);
        locals[co_names[arg].val] = stack.pop();
        break;
      case 'MAKE_FUNCTION':
        if (arg !== 0) {
          throw new Error('implement me');
        }
        const qname = stack.pop();
        const code = stack.pop();
        stack.push(this.new_object({ type: 'func', val: [qname, code] }));
        break;
      case 'LOAD_NAME':
        console.log(co_names[arg].val);
        stack.push(this.new_object(locals[co_names[arg].val]));
        console.log(stack);
        break;
      case 'CALL_FUNCTION':
        this.opcode_call_function(arg, thread_ndx, frame);
        break;
      case 'LOAD_METHOD':
        let obj = stack.pop()
        if (obj.type === 'internal-module') {
          stack.push(this.new_object({ type: 'none' }))
          stack.push(this.new_object(this.internal_module_load_method(obj.val, co_names[arg])));
        } else {
          throw new Error('not implemented');
        }
        break;
      case 'LOAD_GLOBAL':
        this.opcode_load_global(arg, thread_ndx, frame);
        break;
      case 'POP_TOP':
        stack.pop();
        break;
      case 'RETURN_VALUE':
        if (this.pop_frame(thread_ndx, stack.pop())) {
          return true;
        }
        break;
      case 'CALL_METHOD':
        console.log('#', arg);
        let args2 = [];
        for (let x = 0; x < arg; ++x) {
          args2.unshift(stack.pop());
        }
        let cobj2 = stack.pop();
        let base = stack.pop();
        if (cobj2.type === 'str') {
          cobj2 = get_var(cobj.val)
          this.new_frame(thread_ndx, cobj2.val[1].code, {});
        } else if (cobj2.type === 'internal-method') {
          stack.push(this.new_object(this.internal_method_call(thread_ndx, args2, cobj2, base, frame)));
        } else {
          throw new Error(`not implemented ${cobj2.type}`);
        }
        break;
      case 'CONTAINS_OP':
        this.opcode_contains_op(arg, thread_ndx, frame);
        break;
      case 'STORE_FAST':
        this.opcode_store_fast(arg, thread_ndx, frame);
        break;
      case 'LOAD_FAST':
        this.opcode_load_fast(arg, thread_ndx, frame);
        break;
      case 'POP_JUMP_IF_FALSE':
        this.opcode_pop_jump_if_false(arg, thread_ndx, frame);
        break;
      case 'POP_JUMP_IF_TRUE':
        this.opcode_pop_jump_if_true(arg, thread_ndx, frame);
        break;
      case 'STORE_SUBSCR':
        this.opcode_store_subscr(arg, thread_ndx, frame);
        break;
      case 'JUMP_ABSOLUTE':
        console.log('jump_absolute', arg);
        frame.ip = (arg / 2) - 1;
        break;
      case 'LOAD_BUILD_CLASS':
        stack.push({
          type: 'internal-function',
          module: 'builtins',
          method: { val: '__build_class__' },
        });
        break;
      case 'BUILD_MAP':
        this.opcode_build_map(arg, thread_ndx, frame);
        break;
      case 'GET_ITER':
        this.opcode_get_iter(arg, thread_ndx, frame);
        break;
      case 'FOR_ITER':
        this.opcode_for_iter(arg, thread_ndx, frame);
        break;
      case 'COMPARE_OP':
        this.opcode_compare_op(arg, thread_ndx, frame);
        break;
      case 'BINARY_SUBSCR':
        this.opcode_binary_subscr(arg, thread_ndx, frame);
        break;
      case 'IS_OP':
        this.opcode_is_op(arg, thread_ndx, frame);
        break;
      case 'JUMP_FORWARD':
        this.opcode_jump_forward(arg, thread_ndx, frame);
        break;
      default:
        throw new Error(`unknown opcode ${opcode}`);
    }
        
    console.log('globals', this.globals);

    for (let item of stack) {
      if (item === undefined) {
        throw new Error('undefined found on the stack');
      }
      if (item.__id === undefined) {
        throw new Error('item without __id found on the stack');
      }
      console.log(`${thread_ndx}: ${pad.join('')}STACK: ${JSON.stringify(item)}`);
    }

    frame.ip++;
    return false;
  }
}
/*
pyi = new PyInterp(prog);

while (true) {
  while (pyi.execute_all()) {
  }

  console.log('LAST');

  pyi.deserialize(pyi.serialize());
}
*/
module.exports.PyInterp = PyInterp;
module.exports.prog = prog;
