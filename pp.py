'''
  This program manages the package repository and generates the `package.js` script
  which is imported by the main program to access code generated.
'''
import argparse
import os
import os.path
import subprocess
import base64
import json
import hashlib

def main(args):
  progtype, progname = args.program.split('@')

  entry_types = {
    'creep': '_Z5start4Room5Creep',
  }

  entry = entry_types[progtype]

  gcc_opts = [
    'avr-g++', '-nostdlib',
    '-Wall', '-Werror', '-mmcu=avr3', #'-fno-builtin',
    '-std=c++11', '-fvisibility=hidden', '-e', entry,
    '-flto', '-I', args.bsdir, '-I', os.path.join(args.progdir, progname),
    '-o', os.path.join(args.progdir, progname, 'bin.elf'),
    '-T', './src/linker.script2', '-O3'
  ]

  bs_files = os.listdir(args.bsdir)
  for bs_file in bs_files:
    if os.path.splitext(bs_file)[1] == '.cc':
      gcc_opts.append(os.path.join(args.bsdir, bs_file))
  
  for src_file in os.listdir(os.path.join(args.progdir, progname)):
    if os.path.splitext(src_file)[1] == '.cc':
      gcc_opts.append(os.path.join(args.progdir, progname, src_file))

  print('compiling and linking AVR program')
  subprocess.call(' '.join(gcc_opts), shell=True)
  print('packaging AVR program')
  # Pull out the .text and .rodata sections.
  code_bin = os.path.join(args.progdir, progname, 'code')
  rodata_bin = os.path.join(args.progdir, progname, 'rodata')

  subprocess.call(' '.join([
    'avr-objcopy', os.path.join(args.progdir, progname, 'bin.elf'),
    '--dump-section', '.text=%s/code' % os.path.join(args.progdir, progname),
  ]), shell=True)
  subprocess.call(' '.join([
    'avr-objcopy', os.path.join(args.progdir, progname, 'bin.elf'),
    '--dump-section', '.rodata=%s/rodata' % os.path.join(args.progdir, progname),
  ]), shell=True)
  
  if os.path.exists(os.path.join(args.pkgdir, 'package.json')):
    with open(os.path.join(args.pkgdir, 'package.json'), 'r') as fd:
      pkg = json.loads(fd.read())
  else:
      pkg = {
        'code': {},
        'code_list': [],
      }

  code_b64 = load_bin(code_bin)
  rodata_b64 = load_bin(rodata_bin)

  hasher = hashlib.sha1()
  hasher.update(code_b64)
  hasher.update(rodata_b64)
  cid = hasher.hexdigest()

  pkg['code'][cid] = {
    'program': args.program,
    'sha1': cid,
    'memsize': 512,
    'code': json_array_encode(code_b64),
    'rodata': json_array_encode(rodata_b64),
  }

  pkg['code_list'].append(cid)

  with open(os.path.join(args.pkgdir, 'package.json'), 'w') as fd:
    fd.write(json.dumps(pkg))

  print('.. package.json built... rebuilding package.js...')
  with open(os.path.join(args.pkgdir, 'package.js'), 'w') as fd:
    fd.write('module.exports = ')
    fd.write(json.dumps(pkg))
    fd.write(';')

def json_array_encode(data):
  out = []

  # Ensure data is a multiple of 4
  # in total size. Pad it out with
  # zeros if needed.
  slack = len(data) & 0x3
  if slack > 0:
    pad = 4 - slack
    data = data + bytes([0] * pad)

  for x in range(0, len(data), 4):
    a = data[x+0]
    b = data[x+1]
    c = data[x+2]
    d = data[x+3]
    e = (a << 24) | (b << 16) | (c << 8) | d
    out.append(e)
  return out

def load_bin(path):
  if not os.path.exists(path):
    return b''
  with open(path, 'rb') as fd:
    data = fd.read()
    return data  

ap = argparse.ArgumentParser()
ap.add_argument('--program', type=str, required=True)
ap.add_argument('--progdir', type=str, default='./progs', required=False)
ap.add_argument('--bsdir', type=str, default='./bsdir', required=False)
ap.add_argument('--pkgdir', type=str, default='./dist', required=False)
main(ap.parse_args())

