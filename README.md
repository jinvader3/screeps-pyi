# Pretty Yummy Interpretation

This is my pretty yummy interpretation project. It is a WIP of writing an interpreter for the game Screeps (https://screeps.com) so that I can write synchronous style code to operate my game. The usual method of writing code for Screeps depends on the language but it usually involves callbacks or a state machine style of code writing. Instead, by using an interpreter, I can simulate a threaded model and have persistent threads that execute across ticks. I get a persistence by serializing the thread to memory.

I originally started with Python 3 bytecode but I found that I was going to run into difficulty simulating a Python3 dictionary in JavaScript. This is because I would have needed, AFAIK, to emulate hashable types and so forth. So, I abandoned that idea and interpreter in favor of an AVR interpreter.

The AVR interpreter reads AVR machine code and executes it. You could write AVR assembly but I prefer to use C++. Both, produce AVR machine code. Now, the fun part of how this all works is detailed below.

## How To Use It

There is only one ready to use way. Simply type:

```
  make test
```

That will execute the local testing framework. This emulates the Screep's server API enough to boot one or more pre-written programs and test them for correct execution locally. I hope to, in the future, have this package ready to be uploaded to the Screeps server.

The following command and compile and package a program:
```
  python3 pp.py --program creep@simplecreep
```

That last command will modify `./dist/package.json` and `./dist/package.js`. The `./dist/package.js` is loaded by `./dist/main.js` and used to load and execute the simple creep program.

## Problems

  - Not all of the AVR3 instructions are implemented!
  - Not all of the Screeps API is implemented!

## Design

There are a few parts to the design. There is the (1) interface between JS and the AVR code, (2) the way programs are compiled and uploaded to the Screep's server, and (3) how these programs are loaded, interpreted, serialized, and deserialized across ticks.

### Interface Between JS and AVR

The interface between JS and AVR is done with emulated AVR I/O ports. The machine code output is optimized for size by not transferring the 96-bit MongoDB identifiers through the I/O ports. For example, to do I/O with 12-bytes on the AVR3 it requires a total of 12-instructions one-way. This bloats the AVR machine code. Instead, a 16-bit identifier is marshalled into and out of the AVR virtual machine and mapped onto not only 96-bit MongoDB identifiers but any needed identifier, including room names, and player names.

### AVR Program Compilation and Storage for Upload

The AVR programs are compiled, by default as C++, then the .TEXT and .RODATA sections are extracted. The extracted
sections are packed into `package.js` for uploaded to the Screep's server. The binary sections are encoded using
32-bit unsigned integer in a JSON array. These are decoded server side and interpreted.

### AVR Program Loading and Execution

The class AvrContainer and AvrInterp are used to deserialize, decode, execute, encode, and serialize between ticks.
