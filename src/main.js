const { PyInterp, prog } = require('./pyinterp');

const Memory = {};

global.RESOURCE_ENERGY = 'energy';
global.OK = 'ok';
global.FIND_SOURCES = 'find_sources';
global.Game = {
  getObjectById: id => {
    return 'something';
  },
  creeps: {
    ci8392: {
      harvest: what => {
        return OK;
      },
      upgrade: what => {
        return OK;
      },
      memory: {},
      id: 'ci8392',
      store: {
        getUsedCapacity: what => {
          return 0;
        },
        getFreeCapacity: what => {
          return 0;
        },
      },
    },
  },
  rooms: {
    W1N2: {
      controller: { id: 'ctrl9275' },
      find: (what) => {
        return [{ id: 'src2128' }]
      },
    },
  },
};

module.exports.loop = function () {
  let pri; 

  if (Memory.booted === true) {
    pyi = new PyInterp(null);
    pyi.deserialize(Memory);
  } else {
    pyi = new PyInterp(JSON.parse(JSON.stringify(prog)));
  }

  while (pyi.execute_all()) {
  }

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




