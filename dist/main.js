const { AvrInterp, AvrState } = require('./avrinterp');
const data = require('./package');
const _ = require('./lodash-core');

function get_newest_program_sha1 (progname) {
  const code = data.code;
  const code_list = data.code_list;
  for (let x = code_list.length - 1; x > -1; --x) {
    if (code[code_list[x]].program === progname) {
      return code_list[x];
    }
  }
  return null;
}

class AvrContainer {
  constructor (prog) {
    console.log('@prog', prog);
    this.sha1 = prog.sha1;
    this.code = AvrContainer.deserialize_memory(data.code[this.sha1].code);
    this.mem = AvrContainer.deserialize_memory(prog.memory);
    this.state = new AvrState(
      prog.pc, prog.sp,
      new Uint8Array(prog.reg),
      prog.sreg,
    );
    this.tx = prog.tx;
    this.rx = prog.rx;
    this.mm = prog.mm;
    this.mmrefcnt = prog.mmrefcnt;
    this.mmluid = prog.mmluid;
    this.i = new AvrInterp(this.code, this.mem, this.state);
    this.i.register_io_write(0, v => {
      console.log('rx pushing', v);
      this.rx.push(v)
    });
    this.i.register_io_read(0, () => {
      if (this.tx.length === 0) {
        console.log('tx shifted in zeros');
        return 0;
      }
      console.log('tx shifting', this.tx[0]);
      return this.tx.shift();
    });

    this.i.register_io_write(1, this.io_execute.bind(this));

    this.cmap = {
      0:  this.io_room__getcontroller.bind(this),
      1: this.io_creep__harvest.bind(this),
      2:  this.io_room__getsourcebyindex.bind(this),
      3: this.io_creep__upgrade.bind(this),
      4: this.io_creep__moveto.bind(this),
      5: this.io_creep__getusedcapacity.bind(this),
      6: this.io_creep__getfreecapacity.bind(this),
      7:  this.io_game__waitnexttick.bind(this),
      8: this.io_host__inc_ref.bind(this),
      9: this.io_host__dec_ref.bind(this),
    };
  }

  rx8 () {
    return this.rx.shift();
  }

  rx16le () {
    const low = this.rx.shift();
    const high = this.rx.shift();
    return low | (high << 8);
  }

  tx16le (v) {
    const low = v & 0xff;
    const high = (v >> 8) & 0xff;
    this.tx.push(low);
    this.tx.push(high);
  }
  
  io_host__inc_ref () {
    const luid = this.rx16le();
    this.mmrefcnt[luid]++; 
  }

  io_host__dec_ref () {
    const luid = this.rx16le();
    this.mmrefcnt[luid]--;
    if (this.mmrefcnt[luid] <= 0) {
      delete this.mm[this.mm[luid]];
      delete this.mm[luid];
    }
  }

  io_room__getcontroller () {
    const room_luid = this.rx16le();

    if (room_luid === 0) {
      this.tx16le(0);
      return;    
    }

    const room_name = this.mm[room_luid];
    const room = Game.rooms[room_name];

    if (!room || !room.controller) {
      this.tx16le(0);
    } else {
      this.tx16le(this.new_luid(Game.rooms[room_name].controller.id));
    }
  }

  io_creep__harvest () {
    throw new Error();
  }

  io_room__getsourcebyindex () {
    throw new Error();
  }

  io_creep__upgrade () {
    throw new Error();
  }

  io_creep__moveto () {
    throw new Error();
  }

  io_creep__getusedcapacity () {
    throw new Error();
  }

  io_creep__getfreecapacity () {
    throw new Error();
  }

  io_game__waitnexttick () {
    throw new Error();
  }

  io_execute () {
    const cmd = this.rx16le();
    this.cmap[cmd]();
  }

  execute_single () {
    this.i.execute_single();
  }

  serialize () {
    const prog = {
      memory: AvrContainer.serialize_memory(this.mem),
      pc: this.state.pc,
      sp: this.state.sp,
      sreg: this.state.sreg,
      reg: this.state.reg,
      tx: this.tx,
      rx: this.rx,
      mm: this.mm,
      mmrefcnt: this.mmrefcnt,
      mmluid: this.mmluid,
      sha1: this.sha1,
    };

    return prog;
  }

  static _new_luid (prog, euid) {
    if (prog.mm[euid] !== undefined) {
      return prog.mm[euid];
    }

    const nluid = prog.mmluid++;
    prog.mm[euid] = nluid;
    prog.mm[nluid] = euid;
    prog.mmrefcnt[nluid] = 1;
    return nluid;
  }

  new_luid (euid) {
    return AvrContainer._new_luid(this, euid);
  }

  static new_prog_creep (sha1, room, creep) {
    const msz = data.code[sha1].memsize;
    const mem = new Uint8Array(data.code[sha1].memsize);
    const prog = {
      memory: null,
      pc: 0,
      sp: msz - 1 - 4,
      sreg: 0,
      reg: new Uint8Array(32),
      tx: [],
      rx: [],
      mm: {},
      mmrefcnt: {},
      mmluid: 100,
      sha1: sha1,
    };

    const room_luid = AvrContainer._new_luid(prog, room.name);
    const creep_luid = AvrContainer._new_luid(prog, creep.id);

    const a = (msz - 1 - 1);
    const b = (msz - 1 - 3);

    // room name LUID (address of C++ class Room)
    prog.reg[24] = a & 0xff
    prog.reg[25] = (a >> 8) & 0xff;
    // creep ID LUID (address of C++ class Creep)
    prog.reg[30] = b & 0xff;
    prog.reg[31] = (b >> 8) & 0xff;

    // Write the LUIDs into memory as arguments. This
    // is the first field of each class. (Room & Creep)
    mem[a] = room_luid & 0xff;
    mem[a+1] = (room_luid >> 8) & 0xff;
    mem[b] = creep_luid & 0xff;
    mem[b+1] = (creep_luid >> 8) & 0xff;

    prog.memory = AvrContainer.new_serialized_memory(mem, data.code[sha1].rodata);

    console.log('a', a, 'b', b, 'room_luid', room_luid);
    return prog;
  }

  static serialize_memory (mem) {
    const out = [];
    for (let x = 0; x < mem.length; x += 4) {
      const a = mem[x+0];
      const b = mem[x+1];
      const c = mem[x+2];
      const d = mem[x+3];
      const e = (a << 24) | (b << 16) | (c << 8) | d;
      out.push(e);
    }
    return out;
  }

  static new_serialized_memory (data, rodata) {
    data = AvrContainer.serialize_memory(data);

    if (data.length < rodata.length) {
      throw new Error();
    }

    for (let x = 0; x < rodata.length; ++x) {
      data[x] = rodata[x];
    }

    return data;
  }

  static deserialize_memory (data) {
    const out = new Uint8Array(data.length * 4);
    for (let x = 0; x < data.length; ++x) {
      const v = data[x];
      const a = (v >> 24) & 0xff;
      const b = (v >> 16) & 0xff;
      const c = (v >> 8) & 0xff;
      const d = v & 0xff;
      out[x*4+0] = a;
      out[x*4+1] = b;
      out[x*4+2] = c;
      out[x*4+3] = d;
    }
    return out;
  }
}

const Game = {
  rooms: {
    W2N4: {
      controller: {
        id: 'CTRL19203',
      },
    },
  },
};
const Memory = {};

module.exports.loop = function () {
  Memory.avr = Memory.avr || {};
  const m_avr = Memory.avr;
  //////////////////////////////////
  m_avr.progs = m_avr.progs || [];
  const sha1 = get_newest_program_sha1('creep@simplecreep');
  m_avr.progs.push(AvrContainer.new_prog_creep(sha1, 'W2N4', 'CID39382')); 
  const progs = _.map(m_avr.progs, prog => new AvrContainer(prog));

  _.each(progs, prog => {
    for (let x = 0; x < 1000; ++x)
      prog.execute_single();
    //const p = prog.serialize();
    //console.log('#', p);
  });
};


module.exports.loop();
