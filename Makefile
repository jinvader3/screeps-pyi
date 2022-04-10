test1: ./dist/pytest1.py
	python3 ./dist/pydis.py ./dist/pytest1.py ./dist/pytest1.js
	nodejs ./dist/test1.js
test2: ./dist/pytest2.py
	python3 ./dist/pydis.py ./dist/pytest2.py ./dist/pytest2.js
	nodejs ./dist/test2.js

