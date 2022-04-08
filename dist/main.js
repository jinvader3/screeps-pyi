const { PyInterp, prog } = require('./pyinterp');

const Memory = {};

module.exports.loop = function () {
  let pri; 

  if (Memory.booted === true) {
    pyi = new PyInterp(null);
    pyi.deserialize(Memory);
  } else {
    pyi = new PyInterp(JSON.parse(JSON.stringify(prog)));
  }

  pyi.execute_all();
  //}

  pyi.clear_next_tick();
  
  const save = pyi.serialize();

  for (let k in save) {
    Memory[k] = save[k];
  }

  Memory.booted = true;
};

for (let x = 0; x < 1000; ++x) {
  console.log('LOOP');
  module.exports.loop();
}

console.log('done');
