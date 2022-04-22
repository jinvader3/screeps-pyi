class AvrState {
  constructor (pc, sp, reg, sreg) {
    this.pc = pc;
    this.sp = sp;
    this.reg = reg;     // Uint8Array(32)
    this.sreg = sreg;

    if (this.reg.length != 32) {
      throw new Error('The registers must be 32 entries long.');
    }
  }
}

class AvrInterp {
  constructor (code, data, state) {
    this.code = code;
    this.data = data;
    this.state = state;
    this.stdout = [];
    this.io_write_handler = {};
    this.io_read_handler = {};

    this.om = [
      // code, mask, handler
      [0x920F, 0xFE0F, this.op_push.bind(this)],
      [0x900f, 0xfe0f, this.op_pop.bind(this)],
      [0xB000, 0xF800, this.op_in.bind(this)],
      [0xE000, 0xF000, this.op_ldi.bind(this)],     // T
      [0xD000, 0xF000, this.op_rcall.bind(this)],
      [0x2400, 0xFC00, this.op_eor.bind(this)],
      [0x5000, 0xF000, this.op_subi.bind(this)],    // T
      [0xB800, 0xF800, this.op_out.bind(this)],     // T
      [0x8008, 0xFE0F, this.op_lddy_1.bind(this)],
      [0x9009, 0xFE0F, this.op_lddy_2.bind(this)],
      [0x900a, 0xFE0F, this.op_lddy_3.bind(this)],
      [0x8008, 0xD208, this.op_lddy_4.bind(this)],
      [0x900c, 0xfe0f, this.op_lddx_1.bind(this)],
      [0x900d, 0xfe0f, this.op_lddx_2.bind(this)],
      [0x900e, 0xfe0f, this.op_lddx_3.bind(this)],
      [0x1400, 0xFC00, this.op_cp.bind(this)],      // T
      [0x0400, 0xFC00, this.op_cpc.bind(this)],
      [0xf400, 0xfc07, this.op_brcc.bind(this)],
      [0x0c00, 0xfc00, this.op_add.bind(this)],     // T
      [0x1c00, 0xfc00, this.op_adc.bind(this)], 
      [0x2c00, 0xfc00, this.op_mov.bind(this)],     // T
      [0x8208, 0xFE0F, this.op_sty_1.bind(this)],
      [0x9209, 0xFE0F, this.op_sty_2.bind(this)],
      [0x920a, 0xFE0F, this.op_sty_3.bind(this)],
      [0x8208, 0xD208, this.op_sty_4.bind(this)],
      [0x8200, 0xfe0f, this.op_stz_1.bind(this)],
      [0x9201, 0xfe0f, this.op_stz_2.bind(this)],   // T
      [0x9202, 0xfe0f, this.op_stz_3.bind(this)],
      [0x8200, 0xd208, this.op_stz_4.bind(this)],
      [0x9600, 0xff00, this.op_adiw.bind(this)],    // T
      [0xc000, 0xf000, this.op_rjmp.bind(this)],    // T
      [0x9406, 0xfc0f, this.op_lsr.bind(this)],     // T
      [0x9407, 0xfe07, this.op_ror.bind(this)],     // T
      [0x9402, 0xfe0f, this.op_swap.bind(this)],
      [0x7000, 0xf000, this.op_andi.bind(this)],    // T
      [0x4000, 0xf000, this.op_sbci.bind(this)],
      [0x0000, 0xffff, this.op_nop.bind(this)],     // T
      [0x9508, 0xffff, this.op_ret.bind(this)],
      [0x9700, 0xff00, this.op_sbiw.bind(this)],    // T
      [0x8000, 0xfe0f, this.op_lddz_1.bind(this)],
      [0x9001, 0xfe0f, this.op_lddz_2.bind(this)],  // T
      [0x9002, 0xfe0f, this.op_lddz_3.bind(this)],
      [0x8000, 0xd208, this.op_lddz_4.bind(this)],
      [0x2000, 0xfc00, this.op_and.bind(this)],     // T
      [0xf001, 0xfc07, this.op_breq.bind(this)],    // T
      [0xf401, 0xfc07, this.op_brne.bind(this)],    // T
      [0x940e, 0xfe0e, this.op_call.bind(this)],
      [0x3000, 0xf000, this.op_cpi.bind(this)],     // T
      [0xf000, 0xfc07, this.op_brcs.bind(this)],    // T
      [0x9405, 0xfe0f, this.op_asr.bind(this)],
      [0x0800, 0xfc00, this.op_sbc.bind(this)],
    ];
  }

  ilog () {
    console.log.apply(console, arguments);
  }

  op_sbc (opcode) {
    const r = (opcode[0] & 0xf) | (opcode[0] >> 5 & 0x10);
    const d = opcode[0] >> 4 & 0x1f;
    const dv = this.state.reg[d];
    const rv = this.state.reg[r];
    const c = this.state.sreg & 1;
    const nv = (dv - rv - c) & 0xff;
    this.ilog(`sbc r${d}<${dv}> - r${r}<${rv} - c<${c}> = ${nv}`);
    this.state.sreg &= 0xff - (4 + 2 + 1);
    this.state.sreg |= (nv & 0x80) ? 4 : 0;
    this.state.sreg |= (nv === 0) ? 2 : 0;
    this.state.sreg |= ((this.abs_8(rv) + c) > this.abs_8(dv)) ? 1 : 0;
    this.state.reg[d] = nv;
    this.state.pc += 2;
  }

  op_asr (opcode) {
    const d = opcode[0] >> 4 & 0x1f;
    const v = this.state.reg[d];
    const nv = ((v & 0x7f) >> 1) | (v & 0x80);
    this.state.sreg &= 0xff - (1 + 2 + 4 + 8 + 16);
    this.state.sreg |= v & 1;
    this.state.sreg |= (nv === 0) ? 2 : 0;
    this.state.sreg |= (nv & 0x80) ? 4 : 0;
    this.ilog(`asr ${v} >> 1 = ${nv}`);
    this.state.pc += 2;
  }

  op_brcs (opcode) {
    const k = this.signed_7(opcode[0] >> 3 & 0x7f);
    this.ilog('brcs', k);
    if ((this.state.sreg & 1) === 1) {
      this.ilog('branching');
      this.state.pc += k * 2 + 2;
    } else {
      this.ilog('not branching');
      this.state.pc += 2;
    }
  }

  op_cpi (opcode) {
    const k = (opcode[0] & 0xf) | (opcode[0] >> 4 & 0xf0);
    const d = (opcode[0] >> 4 & 0xf) + 16;
    const v = this.state.reg[d];
    const nv = this.state.reg[d] - k
    this.state.sreg = 0;
    this.state.sreg |= (0x80 & nv) ? 4 : 0;
    this.state.sreg |= (nv === 0) ? 2 : 0;
    this.state.sreg |= this.abs_8(k) > this.abs_8(v) ? 1 : 0;
    this.ilog('cpi', k, d, v, nv, this.state.sreg);
    this.state.pc += 2;
  }

  op_call (opcode) {
    const k = opcode[1];
    const spc = this.state.pc + 4;
    this.ilog('call', k, spc);
    this.data[this.state.sp--] = (spc >> 8) & 0xff;
    this.data[this.state.sp--] = spc & 0xff;
    this.state.pc = k * 2;
  }

  op_brne (opcode) {
    const k = this.signed_7(opcode[0] >> 3 & 0x7f);
    this.ilog('brne', k);
    if ((this.state.sreg & 0x2) === 0) {
      this.ilog('branching');
      this.state.pc += k * 2 + 2;
    } else {
      this.ilog('not branching');
      this.state.pc += 2;
    }
  }

  op_breq (opcode) {
    const k = this.signed_7(opcode[0] >> 3 & 0x7f);
    this.ilog('breq', k, this.state.sreg);
    if ((this.state.sreg & 0x2) === 0x2) {
      this.ilog('branching');
      this.state.pc += k * 2 + 2;
    } else {
      this.ilog('not branching');
      this.state.pc += 2;
    }
  }

  op_and (opcode) {
    const d = opcode[0] >> 4 & 0x1f;
    const r = (opcode[0] & 0xf) | (opcode[0] >> 5 & 0x10);
    const v = this.state.reg[d];
    const nv = v & this.state.reg[r];
    this.ilog('and', d, r, v, nv);
    this.state.reg[d] = nv;
    this.state.sreg &= 0xff - (2 + 4);
    this.state.sreg |= (nv === 0) ? 2 : 0;
    this.state.sreg |= nv & 0x80 ? 4 : 0;
    this.ilog('sreg', this.state.sreg);
    this.state.pc += 2;
  }

  op_lddx_1 (opcode) {
    const d = opcode[0] >> 4 & 0x1f;
    const z = this.read_x();
    this.ilog(`lddx_1 d=${d} x=${z} data=${this.data[z]}`);
    this.state.reg[d] = this.data[z];
    this.state.pc += 2;
  }

  op_lddx_2 (opcode) {
    const d = opcode[0] >> 4 & 0x1f;
    const z = this.read_x();
    this.ilog(`lddx_2 d=${d} x=${z} data=${this.data[z]}`);
    this.state.reg[d] = this.data[z];
    this.write_z(z + 1);
    this.state.pc += 2;
  }

  op_lddx_3 (opcode) {
    const d = opcode[0] >> 4 & 0x1f;
    const z = this.read_x();
    this.ilog(`lddx_3 d=${d} x=${z}`);
    this.state.reg[d] = this.data[z - 1];
    this.write_z(z - 1);
    this.state.pc += 2;
  }

  op_lddz_1 (opcode) {
    const d = opcode[0] >> 4 & 0x1f;
    const z = this.read_z();
    this.ilog(`lddz_1 d=${d} z=${z}`);
    this.state.reg[d] = this.data[z];
    this.state.pc += 2;
  }

  op_lddz_2 (opcode) {
    const d = opcode[0] >> 4 & 0x1f;
    const z = this.read_z();
    this.ilog(`lddz_2 d=${d} z=${z} data=${this.data[z]}`);
    this.state.reg[d] = this.data[z];
    this.write_z(z + 1);
    this.state.pc += 2;
  }

  op_lddz_3 (opcode) {
    const d = opcode[0] >> 4 & 0x1f;
    const z = this.read_z();
    this.ilog(`lddz_3 d=${d} z=${z}`);
    this.state.reg[d] = this.data[z - 1];
    this.write_z(z - 1);
    this.state.pc += 2;
  }

  op_lddz_4 (opcode) {
    const d = opcode[0] >> 4 & 0x1f;
    const q = this.signed_8(
      (opcode[0] & 0x7) | (opcode[0] >> 7 & 0x18) | (opcode[0] >> 8 & 0x20) 
    );
    const z = this.read_z();
    this.ilog(`lddz_4 d=${d} q=${q} z=${z}`);
    this.state.reg[d] = this.data[z + q];
    this.state.pc += 2;
  }

  op_sbiw (opcode) {
    const k = (opcode[0] & 0xf) | (opcode[0] >> 2 & 0x30);
    const d = opcode[0] >> 4 & 0x3;
    const base = 24 + d * 2;
    const low = this.state.reg[base+0];
    const high = this.state.reg[base+1];
    const v = (high << 8) | low;
    const nv = v - k;
    this.ilog('sbiw', k, d, base, low, high, v, nv);
    this.state.reg[base+0] = nv & 0xff;
    this.state.reg[base+1] = (nv >> 8) & 0xff;
    this.state.sreg &= 255 - (1 + 2 + 4);
    this.state.sreg |= k > this.abs_16(v) ? 1 : 0;
    this.state.sreg |= nv === 0 ? 2 : 0;
    this.state.sreg |= nv & 0x80 ? 4 : 0;
    this.state.pc += 2;
  }

  op_ret (opcode) {
    const pc_low = this.data[++this.state.sp];
    const pc_high = this.data[++this.state.sp];
    this.ilog('ret', pc_low, pc_high);
    this.state.pc = (pc_high << 8) | pc_low; 
  }

  op_nop (opcode) {
    this.ilog('nop');
    this.state.pc += 2;
  }

  op_sbci (opcode) {
    const k = (opcode[0] >> 4 & 0xf0) | (opcode[0] & 0xf);
    const d = opcode[0] >> 4 & 0xf;
    const v = this.state.reg[d];
    const c = this.state.sreg & 1;
    const nv = v - k - c;
    this.ilog('sbci', k, d, v, c, nv);
    this.state.reg[d] = nv;
    const old_sreg = this.state.sreg;
    this.state.sreg = 0;
    this.state.sreg |= nv & 0x80 ? 4 : 0;
    this.state.sreg |= nv === 0 ? old_sreg & 2 : 0;
    this.state.sreg |= this.abs_8(k + c) > this.abs_8(v) ? 1 : 0;
    this.state.pc += 2;
  }

  op_andi (opcode) {
    const d = (opcode[0] >> 4 & 0xf) + 16;
    const k = (opcode[0] >> 4 & 0xf0) | (opcode[0] & 0xf);
    const v = this.state.reg[d];
    const nv = v & k;
    this.ilog('andi', d, k, v, nv);
    this.state.sreg &= 0xff - (2 + 4);
    this.state.sreg |= nv === 0 ? 2 : 0;
    this.state.sreg |= nv & 0x80 ? 4 : 0;
    this.state.reg[d] = nv;
    this.state.pc += 2;
  }

  op_swap (opcode) {
    const d = opcode[0] >> 4 & 0x1f;
    this.ilog('swap', d);
    const v = this.state.reg[d];
    const h = (v >> 4) & 0xf;
    const l = v & 0xf;
    const nv = (l << 4) | h;
    this.state.reg[d] = nv;
    this.state.pc += 2;
  }

  op_ror (opcode) {
    const d = opcode[0] >> 4 & 0x1f;
    const v = this.state.reg[d];
    const c = this.state.sreg & 1;
    const nv = c === 1 ? 0x80 | (v >> 1) : v >> 1;
    this.ilog('ror', d, v, c, nv);
    this.state.sreg &= 0xff - (4 + 2 + 1);
    this.state.sreg |= (nv & 0x80) ? 4 : 0;
    this.state.sreg |= (nv === 0) ? 2 : 0;
    this.state.sreg |= (v & 1) ? 1 : 0;
    this.state.reg[d] = nv;
    this.state.pc += 2;
  }

  op_lsr (opcode) {
    const d = opcode[0] >> 4 & 0x1f;
    const v = this.state.reg[d];
    const nv = v >> 1;
    this.state.sreg &= 0xff - (1 + 2 + 4);
    this.state.sreg |= (nv === 0) ? 2 : 0;
    this.state.sreg |= (v & 1) ? 1 : 0;
    this.state.reg[d] = nv;
    this.state.pc += 2;
  }

  op_rjmp (opcode) {
    const k = opcode[0] & 0xfff;
    this.ilog('rjmp', k, this.signed_12(k));
    this.state.pc += this.signed_12(k) * 2 + 2;
  }

  op_adiw (opcode) {
    const k = (opcode[0] & 0xf) | (opcode[0] >> 2 & 0x30);
    const d = opcode[0] >> 4 & 0x3;
    const base = 24 + d * 2;
    const v = (this.state.reg[base+1] << 8) | this.state.reg[base];
    const r = v + k;
    this.ilog(`adiw r${base+1}:r${base}<${v}> + k<${k}> = ${r}`);
    this.state.sreg &= 0xff - (1 + 2 + 4);
    this.state.sreg |= (r & 0x80) ? 4 : 0;
    this.state.sreg |= (r === 0) ? 2 : 0;
    this.state.sreg |= ((v + k) > 0xff) ? 1 : 0;
    this.state.reg[base+0] = r & 0xff;
    this.state.reg[base+1] = (r >> 8) & 0xff;
    this.state.pc += 2;
  }

  op_stz_1 (opcode) {
    const r = opcode[0] >> 4 & 0x1f;
    const z = this.read_z();
    this.ilog(`stz_1 r=${r}<${this.state.reg[r]}> z=${z}`);
    this.data[z] = this.state.reg[r];
    this.state.pc += 2;
  }

  op_stz_2 (opcode) {
    const r = opcode[0] >> 4 & 0x1f;
    const z = this.read_z();
    this.ilog('st_2', r, z);
    this.ilog(`st_2 r=${r}<${this.state.reg[r]}> z=${z}`);
    this.data[z] = this.state.reg[r];
    this.write_z(z + 1);
    this.state.pc += 2;
  }

  op_stz_3 (opcode) {
    const r = opcode[0] >> 4 & 0x1f;
    const z = this.read_z();
    this.ilog('st_3', r, z);
    this.data[z - 1] = this.state.reg[r];
    this.write_z(z - 1);
    this.state.pc += 2;
  }

  op_stz_4 (opcode) {
    const r = opcode[0] >> 4 & 0x1f;
    const q = (opcode[0] & 7) | (opcode[0] >> 7 & 0x18) | (opcode[0] >> 8 & 0x20);
    const z = this.read_z();
    this.ilog('st_4', r, z, q);
    this.data[z + this.signed_8(q)] = this.state.reg[r];
    this.state.pc += 2;
  }

  op_mov (opcode) {
    const r = (opcode[0] >> 5 & 0x10) | (opcode[0] & 0xf);
    const d = opcode[0] >> 4 & 0x1f;
    this.ilog('mov', r, d);
    this.state.reg[d] = this.state.reg[r];
    this.state.pc += 2;
  }

  handle_sreg (v, carry) {
    // carry
    this.state.sreg = this.state.sreg & (0xff - 1);
    this.state.sreg |= carry;
    // negative
    this.state.sreg = this.state.sreg & (0xff - 4);
    this.state.sreg |= v & 0x80 == 0x80 ? 4 : 0;
    // zero
    this.state.sreg = this.state.sreg & (0xff - 2);
    this.state.sreg |= v == 0 ? 2 : 0;
  }

  op_adc (opcode) {
    const r = (opcode[0] >> 5 & 0x10) | (opcode[0] & 0xf);
    const c = this.state.sreg & 1;
    const d = opcode[0] >> 4 & 0x1f;
    const v = this.state.reg[d] + this.state.reg[r] + c;
    this.ilog(`adc r${r}/${this.state.reg[r]} + r${d}/${this.state.reg[d]} + ${c} = ${v}`);
    this.handle_sreg(v, v > 0xff);
    this.state.reg[d] = v;
    this.state.pc += 2;
  }

  op_add (opcode) {
    const r = (opcode[0] >> 5 & 0x10) | (opcode[0] & 0xf);
    const d = opcode[0] >> 4 & 0x1f;
    const v = this.state.reg[d] + this.state.reg[r];
    this.ilog(`add r${r}/${this.state.reg[r]} + r${d}/${this.state.reg[d]} = ${v}`);
    this.handle_sreg(v, v > 0xff);
    this.state.reg[d] = v;
    this.state.pc += 2;
  }

  op_brcc (opcode) {
    const k = opcode[0] >> 3 & 0x3f;
    this.ilog('brcc', this.state.sreg & 1, k);
    if ((this.state.sreg & 1) === 0) {
      this.ilog('branching');
      this.state.pc += k * 2 + 2;
    } else {
      this.ilog('not branching');
      this.state.pc += 2;
    }
  }

  op_cpc (opcode) {
    const d = opcode[0] >> 4 & 0x1f;
    const r = (opcode[0] & 0xf) | (opcode[0] >> 5 & 0x10);
    const c = this.state.sreg & 1;
    const v = (this.state.reg[d] - this.state.reg[r] - c) & 0xff;
    this.ilog(`cpc ${this.state.reg[d]} - ${this.state.reg[r]} - ${c} = ${v}`);
    this.state.sreg = 0;
    // TODO: H=set if there was a borrow from bit 3; cleared otherwise
    // TODO: S=for signed tests
    // TODO: V=two's complement overflow
    // negative
    this.state.sreg |= (v & 0x80) ? 4 : 0;
    // zero
    this.state.sreg |= (v === 0) ? 2 : 0;
    // carry
    this.state.sreg |= this.abs_8(this.state.reg[r] + c) > this.abs_8(this.state.reg[d]) ? 1 : 0;
    this.state.pc += 2; 
  }

  op_cp (opcode) {
    const d = opcode[0] >> 4 & 0x1f;
    const r = (opcode[0] & 0xf) | (opcode[0] >> 5 & 0x10);
    const v = (this.state.reg[d] - this.state.reg[r]) & 0xff;
    this.state.sreg = 0;
    // TODO: H=set if there was a borrow from bit 3; cleared otherwise
    // TODO: S=for signed tests
    // TODO: V=two's complement overflow
    // negative
    this.state.sreg |= (v & 0x80) ? 4 : 0;
    // zero
    this.state.sreg |= (v === 0) ? 0x2 : 0x0;
    // carry
    this.state.sreg |= this.abs_8(this.state.reg[r]) > this.abs_8(this.state.reg[d]) ? 1 : 0;
    this.state.pc += 2;
  }

  read_x () {
    return (this.state.reg[27] << 8) | this.state.reg[26];
  }

  read_z () {
    return (this.state.reg[31] << 8) | this.state.reg[30];
  }

  read_y () {
    return (this.state.reg[29] << 8) | this.state.reg[28];
  }

  write_x (v) {
    this.state.reg[27] = v >> 8;
    this.state.reg[26] = v & 0xff;
  }

  write_z (v) {
    this.state.reg[31] = v >> 8;
    this.state.reg[30] = v & 0xff;
  }

  write_y (v) {
    this.state.reg[29] = v >> 8;
    this.state.reg[28] = v & 0xff;
  }

  op_lddy_1 (opcode) {
    const d = opcode[0] >> 4 & 0x1f;
    const y = this.read_y();
    this.ilog(`lddy_1 d=${d} y=${y}`);
    this.state.reg[d] = this.data[y];
    this.state.pc += 2;
  }

  op_lddy_2 (opcode) {
    const d = opcode[0] >> 4 & 0x1f;
    const y = this.read_y();    
    this.ilog(`lddy_2 d=${d} y=${y}`);
    this.state.reg[d] = this.data[y];
    this.write_y(y + 1);
    this.state.pc += 2;
  }

  op_lddy_3 (opcode) {
    const d = opcode[0] >> 4 & 0x1f;
    const y = this.read_y();    
    this.ilog(`lddy_3 d=${d} y=${y}`);
    this.state.reg[d] = this.data[y - 1];
    this.write_y(y - 1);
    this.state.pc += 2;
  }

  op_lddy_4 (opcode) {
    const d = opcode[0] >> 4 & 0x1f;
    const q = this.signed_8(
      (opcode[0] & 0x7) | (opcode[0] >> 7 & 0x18) | (opcode[0] >> 8 & 0x20) 
    );
    const y = this.read_y();
    this.ilog(`lddy_4 r${d}<${this.state.reg[d]}> = data[y<${y}> + q<${q}>]<${this.data[y+q]}>`);
    this.state.reg[d] = this.data[y + q];
    this.state.pc += 2;
  }

  op_sty_1 (opcode) {
    const r = opcode[0] >> 4 & 0x1f;
    const y = this.read_y();
    this.ilog(`std_1 r=${r} y=${y}`);
    this.data[y] = this.state.reg[r];
  }

  op_sty_2 (opcode) {
    const r = opcode[0] >> 4 & 0x1f;
    const y = this.read_y();
    this.ilog(`std_2 r=${r} y=${y}++`);
    this.data[y] = this.state.reg[r];
    this.write_y(y + 1);
  }

  op_sty_3 (opcode) {
    const r = opcode[0] >> 4 & 0x1f;
    const y = this.read_y();
    this.ilog(`std_3 r=${r} y=--${y}`);
    this.data[y - 1] = this.state.reg[r];
    this.write_y(y - 1);
  }

  abs_8 (v) {
    if (v > 0x7f) {
      return (~v & 0xff) + 1;
    }
    return v;
  }

  abs_16 (v) {
    if (v > 0x7fff) {
      return (~v & 0xffff) + 1;
    }
    return v; 
  }

  signed_8 (v) {
    if (v > 0x7f) {
      return -((~v & 0xff) + 1);
    }
    return v;
  }

  signed_16 (v) {
    if (v > 0x7fff) {
      return -((~v & 0xffff) + 1);
    }
    return v;
  }

  signed_7 (v) {
    if (v > 0x3f) {
      return -((~v & 0x7f) + 1);
    }
    return v;
  }

  signed_12 (v) {
    if (v > 0x7ff) {
      return -((~v & 0xfff) + 1);
    }
    return v;
  }

  op_sty_4 (opcode) {
    const r = opcode[0] >> 4 & 0x1f;
    const q = this.signed_8(
      (opcode[0] & 0x7) | (opcode[0] >> 7 & 0x18) | (opcode[0] >> 8 & 0x20) 
    );
    const y = this.read_y();
    this.ilog(`std_4 data[y<${y}> + q<${q}>] = r${r}<${this.state.reg[r]}>`);
    this.data[y + q] = this.state.reg[r];
    this.state.pc += 2;
  }

  ip_read32 () { 
    const v0 = this.code[this.state.pc+0] | (this.code[this.state.pc+1] << 8);
    const v1 = this.code[this.state.pc+2] | (this.code[this.state.pc+3] << 8);
    return [v0, v1];
  }

  io_read (a) {
    if (this.io_read_handler[a] !== undefined) {
      return this.io_read_handler[a]();
    }

    switch (a) {
      case 0x3f:
        // status register
        return this.state.sreg;
      case 0x3e:
        // high stack pointer
        this.ilog('read high stack pointer', (this.state.sp >> 8) & 0xff);
        return (this.state.sp >> 8) & 0xff;
      case 0x3d:
        // low stack pointer
        this.ilog('read low stack pointer', this.state.sp & 0xff);
        return this.state.sp & 0xff;
    }
    throw new Error();
  }

  stdout_write (v) {
    if (v === 10) {
      const line = this.stdout.join('');
      this.stdout = [];
      console.log(`STDOUT: \x1b[4;30;42m ${line} \x1b[0m`);
    } else {
      this.stdout.push(String.fromCharCode(v));
      console.log(`CHAR: \x1b[6;30;42m ${v} \x1b[0m`);
    }
  }

  register_io_read (port, cb) {
    this.io_read_handler[port] = cb;
  }

  register_io_write (port, cb) {
    this.io_write_handler[port] = cb;
  }

  io_write (a, v) {
    if (this.io_write_handler[a] !== undefined) {
      this.io_write_handler[a](v);
      return;
    }

    switch (a) {
      case 0x00:
        this.stdout_write(v);
        return;
      case 0x01:
        console.log(`PORT: ${v}`);
        return;
      case 0x3f:
        this.state.sreg = v;
        return;
      case 0x3e:
        this.state.sp = (v << 8) | (this.state.sp & 0xff);
        this.ilog(`write stack high with ${v} to be ${this.state.sp.toString(16)}`);
        return;
      case 0x3d:
        this.state.sp = (this.state.sp & 0xff00) | v;
        this.ilog(`write stack low with ${v} to be ${this.state.sp.toString(16)}`);
        return;
    }
    throw new Error();
  }

  op_subi (opcode) {
    const k = (opcode[0] >> 4 & 0xf0) | (opcode[0] & 0xf);
    const d = (opcode[0] >> 4 & 0xf) + 16;
    const v = this.state.reg[d];
    const nv = (this.state.reg[d] - k) & 0xff;
    this.ilog(`subi r${d}<${v}> - k<${k}> = ${nv}`);
    this.state.sreg &= 0xff - (4 + 2 + 1);
    this.state.sreg |= (nv & 0x80) ? 4 : 0;
    this.state.sreg |= (nv === 0) ? 2 : 0;
    this.state.sreg |= (this.abs_8(k) > this.abs_8(v)) ? 1 : 0;
    this.state.reg[d] = nv;
    this.state.pc += 2;
  }

  op_rcall (opcode) {
    let k = opcode[0] & 0x7ff;
    const spc = this.state.pc + 2;
    this.ilog('rcall', k, spc);
    this.data[this.state.sp--] = spc >> 8;
    this.data[this.state.sp--] = spc & 0xff;
    if (k & 0x800 == 0x800) {
      k = (~k & 0xfff) + 1;
    }
    this.state.pc += (k * 2) + 2;
  }
  
  op_ldi (opcode) {
    const k = (opcode[0] >> 4 & 0xf0) | (opcode[0] & 0xf);
    const d = (opcode[0] >> 4 & 0xf) + 16;
    this.ilog(`ldi r${d} = ${k}`);
    this.state.reg[d] = k;
    this.state.pc += 2;
  }

  op_out (opcode) {
    const a = (opcode[0] >> 5 & 0x30) | (opcode[0] & 0xf);
    const r = opcode[0] >> 4 & 0x1f;
    this.ilog(`out address=${a} r${r}=${this.state.reg[r]}`);
    this.io_write(a, this.state.reg[r]);
    this.state.pc += 2;
  }

  op_in (opcode) {
    const d = opcode[0] >> 4 & 0x1f;
    const a = (opcode[0] >> 9 & 0x3) << 4 | (opcode[0] & 0xf);
    this.ilog('in', d, a);
    this.state.reg[d] = this.io_read(a);
    this.state.pc += 2;
  }

  op_eor (opcode) {
    const d = (opcode[0] >> 4) & 0x1f;
    const r = ((opcode[0] >> 5) & 0x10) | (opcode[0] & 0xf);
    this.ilog('eor', d, r);
    this.state.reg[d] = (this.state.reg[d] ^ this.state.reg[r]) & 0xff;
    this.state.pc += 2;
  }

  op_push (opcode) {
    const d = opcode[0] >> 4 & 0x1f;
    this.ilog('push', this.state.sp, d);
    this.data[this.state.sp--] = this.state.reg[d];
    this.state.pc += 2;
  }

  op_pop (opcode) {
    const d = opcode[0] >> 4 & 0x1f;
    this.ilog('pop', d);
    this.state.reg[d] = this.data[++this.state.sp];
    this.state.pc += 2;
  }

  print_stack_line () {
    const sp = this.state.sp;
    const line = [];

    for (let x = 0; (x < 10) && (sp + x + 1 < this.data.length); ++x) {
      const ch = this.data[sp + x + 1].toString(16);
      line.push(ch.length == 2 ? ch : '0' + ch);
    }

    this.ilog(`STACK[${sp}]: ${line.join('')}`);
  }

  execute_single () {
    const opcode = this.ip_read32();
    
    this.ilog(`[${this.state.pc.toString(16)}] opcode`, opcode);

    for (let entry of this.om) {
      if ((opcode[0] & entry[1]) === entry[0]) {
        entry[2](opcode);
        this.print_stack_line();
        this.ilog('SREG', this.state.sreg);
        return;
      }
    }

    throw new Error();
  }
}

module.exports.AvrInterp = AvrInterp;
module.exports.AvrState = AvrState;
