const prog = require('./pytest');

class PyInterp {
  constructor (prog) {
    this.prog = prog;
    this.code_objs = [];
    this.remap_code_objects();
    // SHARED BETWEEN THREADS
    this.globals = {};
    // SINGLE THREAD STATES
    this.threads = {};
    this.last_thread_id = 0
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
    return this.code_objs[id];
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
      co_varnames:  scope,
    };
  }

  thread_active (thread_ndx) {
    const v = this.threads[thread_ndx].frame;
    return v !== undefined && v !== null;
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

  internal_method_call (args, cobj, base) {
    console.log('INTERNAL_METHOD_CALL')
    console.log('args', args);
    console.log('cobj', cobj);
    console.log('base', base);

    if (cobj.module === 'os' && cobj.method.val === 'spawn_thread') {
      if (args.length > 0 && args[0].type === 'func') {
        const qname = args[0].val[0];
        const code = this.get_code_object_by_id(args[0].val[1].code);
        this.new_thread(code, {});
        console.log('NEW THREAD CREATED');
        console.log(code);
      }
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
    const co_varnames = frame.co_varnames;
    const opcode = op.opcode;
    const stack = frame.stack;
    const arg = op.arg;

    let pad = [];

    for (let x = 0; x < tstate.frames.length; ++x) {
      pad.push('  ');
    }
    console.log(`${thread_ndx}: ${pad.join('')}${opcode}`);

    let get_var = (name) => {
      if (co_varnames[name] === undefined) {
        return this.globals[name];
      }
  
      return co_varnames[name];
    };

    switch (opcode) {
      case 'LOAD_CONST':
        stack.push(co_consts[arg]);
        break;
      case 'IMPORT_NAME':
        const fromlist = stack.pop();
        const level = stack.pop();
        console.log('import_name', 'name', co_names[arg], 'fromlist', fromlist, 'level', level)
        stack.push(this.load_module(
          co_names[arg].val, fromlist, level
        ));
        break;
      case 'STORE_NAME':
        co_varnames[co_names[arg].val] = stack[stack.length - 1];
        break;
      case 'MAKE_FUNCTION':
        if (arg !== 0) {
          throw new Error('implement me');
        }
        const qname = stack.pop();
        const code = stack.pop();
        stack.push({ type: 'func', val: [qname, code] });
        break;
      case 'LOAD_NAME':
        stack.push(co_names[arg]);
        break;
      case 'CALL_FUNCTION':
        let args = [];
        for (let x = 0; x < arg; ++x) {
          args.unshift(stack.pop());
        }
        let cobj = stack.pop();
        if (cobj.type === 'str') {
          cobj = get_var(cobj.val)
          const _code = this.get_code_object_by_id(cobj.val[1].code);
          this.new_frame(thread_ndx, _code, {});
        } else if (cobj.type === 'locref') {
          const local = frame.co_varnames[cobj.val];
          console.log(`val: ${cobj.val}`, local);
          if (local.type === 'func') {
            const __code = this.get_code_object_by_id(local.val[1].code);
            this.new_frame(thread_ndx, __code, {});
          } else {
            throw new Error('not implemented');
          }
        } else if (cobj.type === 'func') {
          const ___code = this.get_code_object_by_id(cobj.val[1].code);
          this.new_frame(thread_ndx, ___code, {});
        } else {
          console.log('cobj', cobj);
          throw new Error('not implemented');
        }
        break;
      case 'LOAD_METHOD':
        let obj = stack.pop()
        if (obj.type === 'internal-module') {
          stack.push({ type: 'none' })
          stack.push(this.internal_module_load_method(obj.val, co_names[arg]));
        } else {
          throw new Error('not implemented');
        }
        break;
      case 'LOAD_GLOBAL':
        stack.push(this.globals[co_names[arg].val]);
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
          stack.push(this.internal_method_call(args2, cobj2, base))
        } else {
          throw new Error('not implemented');
        }
        break;
      case 'STORE_FAST':
        frame.co_varnames[arg] = stack.pop(); 
        break;
      case 'LOAD_FAST':
        stack.push({ type: 'locref', val: arg })
        break;
      case 'JUMP_ABSOLUTE':
        console.log('jump_absolute', arg);
        frame.ip = arg - 1;
        break;
      default:
        throw new Error(`unknown opcode ${opcode}`);
    }

    frame.ip++;
    return false;
  }
}

pyi = new PyInterp(prog);

while (pyi.execute_all()) {
}

console.log('globals', pyi.globals.apple);

module.exports.PyInterp = PyInterp;
module.exports.prog = prog;
