const fs = require('fs');
const readline = require('readline');
const { AvrInterp, AvrState } = require('./avrinterp');

/*
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});
*/

const code = fs.readFileSync('./dist/avrtest1_code');
const ro_data = fs.readFileSync('./dist/avrtest1_rodata');
const data = new Uint8Array(0xffff);

for (let x = 0; x < ro_data.length; ++x) {
  data[x] = ro_data[x];
}
      
const i = new AvrInterp(code, data, new AvrState());

i.register_io_write(6, v => {
  throw new Error('Debug Point Reached');
});

while (true) {
  i.execute_single();
}
