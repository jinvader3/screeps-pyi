#!/bin/sh
echo translating python module into JSON-like bytecode
python3 ./dist/pydis.py ./dist/pytest.py ./dist/pytest.js
echo executing the JSON-like bytecode
nodejs ./dist/pyinterp.js

