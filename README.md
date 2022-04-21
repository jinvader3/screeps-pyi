# Pretty Yummy Interpretation

This is my pretty yummy interpretation project. It is a WIP of writing an interpreter for the game Screeps (https://screeps.com) so that I can write synchronous style code to operate my game. The usual method of writing code for Screeps depends on the language but it usually involves callbacks or a state machine style of code writing. Instead, by using an interpreter, I can simulate a threaded model and have persistent threads that execute across ticks. I get a persistence by serializing the thread to memory.

I originally started with Python 3 bytecode but I found that I was going to run into difficulty simulating a Python3 dictionary in JavaScript. This is because I would have needed, AFAIK, to emulate hashable types and so forth. So, I abandoned that idea and interpreter in favor of an AVR interpreter.

The AVR interpreter reads AVR machine code and executes it. You could write AVR assembly but I prefer to use C++. Both, produce AVR machine code. Now, the fun part of how this all works is detailed below.

Using a JSON array in `Memory` (in Screeps), for example `avr`, I create entries. The whole thing looks like this. Keep in mind it is JSON serializable which is a critical requirement.

```json
[
  { code: '<sha-1-hash>', memory: '....', state: '.....', program: '..' },
  { code: '<sha-1-hash>', memory: '....', state: '.....', program: '..' },
  ....
]
```

Each entry has the virtual AVR memory and state serialized. However, the code is simply referenced by its SHA-1 value. The code is stored in the JavaScript source under a dict/map table using the SHA-1 value as the key. So, what happens, when you compile your code and push it to the server is this.

  1. Each of your AVR programs is compiled.
  2. Each is packaged into a special file. `package.js`
  3. The `main.js` and all interpreter support files are uploaded with `package.js`.

Now, `main.js` imports `package.js` and it scans the `avr` table under Screep's `Memory`. If it has trouble finding a matching SHA-1 reference in `package.js` it just terminates the program and attempts to restart it using new code via the `program` identifier. The `program` identifier is just a human readable name you assign to each program you write. 

So, in `package.js`. It looks like this:

```javascript
module.exports = {
  code: {
    '<sha1hash>': '<serialized-avr-machine-code>',
    '<sha1hash>': '<serialized-avr-machine-code>',
    '<sha1hash>': '<serialized-avr-machine-code>',
    '<sha1hash>': '<serialized-avr-machine-code>',
  },
  program: {
    'creepgw': '<sha1hash>',
  },
};
```

Now, over time you get a lot of never used entries in the `module.exports.code` table. These are old versions of the program. Those just have to be removed manually. Or, maybe, they might just be automatically dropped when the program changes and it will just be restarted/terminated server side. I'm not exactly sure yet on how that will work. I just know it will be possible to have an old program stay persistent until you terminate/upgrade it.
