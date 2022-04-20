const fs = require('fs');
const readline = require('readline');
const { AvrInterp, AvrState } = require('./avrinterp');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

const code = fs.readFileSync('./dist/avrtest1_code');
const ro_data = fs.readFileSync('./dist/avrtest1_rodata');
const data = new Uint8Array(0xffff);

for (let x = 0; x < ro_data.length; ++x) {
  data[x] = ro_data[x];
}
      
const i = new AvrInterp(code, data, new AvrState());
const e = () => {
  i.execute_single();
};

function ask () {
  rl.question('next?', tmp => {
    if (tmp === '') {
      i.execute_single();
    } else if (tmp === 'r') {
      for (let x = 0; x < 32; x += 4) {
        console.log(`r${x+0}: ${i.state.reg[x+0]} r${x+1}: ${i.state.reg[x+1]} r${x+2}: ${i.state.reg[x+2]} r${x+3}: ${i.state.reg[x+3]}`);
      }
    }
    setTimeout(ask, 0);
  });
};

ask();

