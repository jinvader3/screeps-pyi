pytest1: ./dist/pytest1.py
	python3 ./dist/pydis.py ./dist/pytest1.py ./dist/pytest1.js
	nodejs ./dist/test1.js
pytest2: ./dist/pytest2.py
	python3 ./dist/pydis.py ./dist/pytest2.py ./dist/pytest2.js
	nodejs ./dist/test2.js
avrtest1: ./dist/avrtest1.cc
	#avr-g++ ./dist/avrtest1.cc -nostdlib -mmcu=attiny22 -mno-interrupts -o ./dist/avrtest1
	avr-g++ ./dist/avrtest1.cc -T./dist/linker.script -nostdlib -mmcu=avr3 -mno-interrupts -o ./dist/avrtest1
	avr-objcopy ./dist/avrtest1 --dump-section .text=./dist/avrtest1_code
	avr-objcopy ./dist/avrtest1 --dump-section .rodata=./dist/avrtest1_rodata
	nodejs ./dist/avrinterp.js
avrtest2: ./dist/avrtest2.s
	avr-gcc -nostdlib ./dist/avrtest2.s -mmcu=avr3 -o ./dist/avrtest2
	avr-objcopy ./dist/avrtest2 --dump-section .text=./dist/avrtest2_code
	nodejs ./dist/avrtest2.js
