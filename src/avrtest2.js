const { AvrInterp, AvrState } = require('./avrinterp');
const fs = require('fs');
const code = fs.readFileSync('./dist/avrtest2_code');
const data = new Uint8Array(0xffff);
const i = new AvrInterp(code, data, new AvrState());

let test_passed = true;

i.register_io_write(4, v => {
  if (test_passed === false) {
    throw new Error('Previous Test Not Passed');
  }
  test_passed = false;
}); 

i.register_io_write(5, v => {
  test_passed = true;
});

i.register_io_write(6, v => {
  throw new Error('Test Failed');
});

i.register_io_write(7, v => {
  throw new Error('Done');
});

while (true) {
  i.execute_single();
}

