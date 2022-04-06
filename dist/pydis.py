import dis
import os
import sys
import json
import pprint

def compile_module(path, out_path):
  with open(path, 'r') as fd:
    source = fd.read()

  mod = compile(source, path, 'exec')
  jmod = compile_into_instructions(mod)

  pprint.pprint(jmod)

  with open(out_path, 'w') as fd:
    fd.write('module.exports.data = ')
    fd.write(json.dumps(jmod))
    fd.write(';')

def compile_into_instructions(co):
  jmod = {
    'co_names': [],
    'co_varnames': [],
    'co_consts': [],
  }

  def to_list(l):
    out = []
    for n in l:
      if type(n) is str:
        out.append({ 'type': 'str', 'val': n })
      elif type(n) is int:
        out.append({ 'type': 'int', 'val': n })
      elif str(type(n)) == '<class \'NoneType\'>':
        out.append({ 'type': 'none' })
      elif type(n) is tuple:
        out.append({ 'type': 'tuple', 'val': to_list(n) })
      elif type(n) is bool:
        out.append({ 'type': 'bool', 'val': n })
      elif type(n) is float:
        out.append({ 'type': 'float', 'val': n })
      elif str(type(n)) == '<class \'code\'>':
        out.append({
          'type': 'code',
          'code': compile_into_instructions(n),
        })
      else:
        raise Exception('unknown co_? type %s' % type(n))
    return out

  jmod['co_names'] = to_list(co.co_names)
  jmod['co_varnames'] = to_list(co.co_varnames)  
  jmod['co_consts'] = to_list(co.co_consts)

  jmod['opcodes'] = []
  for i in dis.get_instructions(co):
    jmod['opcodes'].append({
      'opcode': i.opname,
      'arg': i.arg,
    })

  return jmod

path = sys.argv[1]
out_path = sys.argv[2]
compile_module(path, out_path)
