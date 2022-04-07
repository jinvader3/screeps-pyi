const prog = require('./pytest');

class PyInterp {
  constructor (prog) {
    this.prog = prog;
    this.code_objs = [];
    this.remap_code_objects();
    // SHARED BETWEEN THREADS
    this.globals = {};
    this.objects = {};
    // SINGLE THREAD STATES
    this.threads = {};
    this.last_thread_id = 0;
    this.last_object_id = 0;
    this.new_thread(this.prog.data, this.globals);
  }

  new_thread (code, scope) {
    const nt = {
      frame: null,
      frames: [],
    };
    const id = this.last_thread_id++;
    this.threads[id] = nt;
    this.new_frame(id, code, scope);
    return id;
  }

  new_object_id () {
    return this.last_object_id++;
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
    for (let state of this.threads) {
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

    console.log('INTERNAL_METHOD_CALL')
    console.log('args', args);
    console.log('cobj', cobj);
    console.log('base', base);

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
              this.threads[ntid].frame.locals[argname.val] = args[x];
            }
            break;
          case 'debug':
            console.log('DEBUG', args[0].val);
            break;
          case 'next_tick':
            state.next_tick = true;
            break;
          case 'get_creep_ids':
            return this.new_object({ type: 'list', data: [
              { type: 'str', val: '3f12e2k' },
              //{ type: 'str', val: 'pq2n1m2' },
              //{ type: 'str', val: 'uey2i23' },
              //{ type: 'str', val: '238nb2n' },
              //{ type: 'str', val: '192wi2u' },
              //{ type: 'str', val: 'hfdb982' },
            ]});
            break;
          case 'creep_get_room_id':
            return this.new_object({
              type: 'str', val: 'W34S23'
            });
          case 'get_source_ids':
            return this.new_object({ type: 'list', data: [
              { type: 'str', val: 'src8392' },
              { type: 'str', val: 'src0020' },
            ]})
          case 'get_controller_id':
            return this.new_object({ 
              type: 'str', val: 'ctrl3922'
            });
          case 'creep_energy_used_cap':
            return this.new_object({
              type: 'int', val: 0,
            });
          case 'creep_energy_free_cap':
            return this.new_object({
              type: 'int', val: 0,
            });          
          case 'creep_memory_write_key':
            break;
          case 'creep_memory_read_key':
            break;
          default:
            console.log(frame.code.opcodes[frame.ip + 1]);
            throw new Error('not implemented');
        }
        break;
      default:
        throw new Error('not implemented');
    }

    if (cobj.module === 'os' && cobj.method.val === 'debug') {
      if (args.length > 0) {
        console.log('DEBUG', args[0].val);
      }
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

  serialize () {
    const objects = {};

    function dedup_objects(stack) {
      for (let ndx in stack) {
        let item = stack[ndx];
        if (objects[item.__id] === undefined) {
          objects[item.__id] = item;
        }
        stack[ndx] = item.__id;
      }
     }

    // Go through and wipe the stacks by deduplicating objects.
    for (let tid in this.threads) {
      let state = this.threads[tid];
      console.log('THREAD');
      for (let frame of state.frames) {
        console.log('frame-stack');
        dedup_objects(frame.stack);
      }
      console.log('current-frame-stack');
      dedup_objects(state.frame.stack);
    }

    console.log(JSON.stringify({
      objects: objects,
      threads: this.threads,
      globals: this.globals,
      code_objs: this.code_objs,
      last_thread_id: this.last_thread_id,
    }).length);

    throw new Error('WIP');
  }

  deserialize (data) {
    const save = JSON.parse(data);
    this.objects = save.objects;
    this.threads = save.threads;
    this.globals = save.globals;
    this.code_objs = save.code_objs;
    this.last_thread_id = save.last_thread_id;
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

    const res = tos.iter.next()

    if (res.done) {
      frame.stack.pop();
      // Subtract one because it will get incremented by 
      // one when we exit this method and return to our caller.
      frame.ip += (arg / 2)
      return
    }

    frame.stack.push(res.value);
  }

  opcode_get_iter (arg, thread_id, frame) {
    console.log('GET_ITER', frame.stack);
    const tos = frame.stack.pop();
    const obj = this.new_object({ type: 'iter', obj: tos });
    switch (tos.type) {
      case 'map':
      case 'list':
        tos[Symbol.iterator] = function *() {
          for (let x of this.data) {
            yield x;
          }
        };
        obj.iter = tos[Symbol.iterator]()
        frame.stack.push(obj);
        break;
      default:
        throw new Error('not implemented');
    }
  }

  opcode_load_fast (arg, thread_id, frame) {
    const name = frame.code.co_varnames[arg].val;
    console.log(`   name=${name}`);
    frame.stack.push(this.new_object(frame.locals[name]));
  }

  opcode_store_fast (arg, thread_id, frame) {
    const name = frame.code.co_varnames[arg].val;
    console.log('store_fast', name, frame.stack);
    frame.locals[name] = frame.stack.pop(); 
    console.log(frame.locals);
  }

  opcode_load_global (arg, thread_id, frame) {
    const name = frame.code.co_names[arg].val;
    console.log(`  name=${name}`);
    if (frame.locals[name] !== undefined) {
      frame.stack.push(this.new_object(frame.locals[name]));
      return;
    }
    if (this.globals[name] === undefined) {
      throw new Error(`load_global failed because ${name} does not exist as local or global`);
    }
    frame.stack.push(this.globals[name]);
  }

  opcode_contains_op (arg, thread_id, frame) {
    if (arg !== 1) { 
    } else {
    }

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
      let _key = map.data[ndx];
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

  opcode_store_subscr (arg, thread_id, frame) {
    const tos = frame.stack.pop();
    const tos1 = frame.stack.pop();
    const tos2 = frame.stack.pop();
    console.log('tos', tos);
    console.log('tos1', tos1);
    console.log('tos2', tos2);
    console.log('stack', frame.stack);
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
          console.log('WAS FALSE');
          frame.ip = (arg / 2) - 1;
          return;
        }
        return;
      default: throw new Error('not implemented');
    }
  }

  opcode_call_function (arg, thread_id, frame) {
    let args = [];

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
        throw new Error('not implemented');
    }
  }

  execute_single (thread_ndx) {
    const tstate = this.threads[thread_ndx];

    if (tstate === undefined) {
      return true;
    }


    const frame = tstate.frame;
    console.log('ip', thread_ndx, frame.ip);
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
        locals[co_names[arg].val] = stack[stack.length - 1];
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
        stack.push(co_names[arg]);
        break;
      case 'CALL_FUNCTION':
        this.opcode_call_function(arg, thread_ndx, frame);
        break;
      case 'LOAD_METHOD':
        console.log('stack', stack);
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
        console.log('stack', frame.stack); 
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
        this.serialize();
        throw new Error('TESTING SERIALIZATION');
      default:
        throw new Error(`unknown opcode ${opcode}`);
    }

    for (let item of stack) {
      if (item === undefined) {
        throw new Error('undefined found on the stack');
      }
    }

    frame.ip++;
    return false;
  }
}

pyi = new PyInterp(prog);

while (pyi.execute_all()) {
}

console.log('LAST');

module.exports.PyInterp = PyInterp;
module.exports.prog = prog;
