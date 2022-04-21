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
    'avr-g++',
    '-nostdlib', '-Wall', '-Werror', '-mmcu=avr3', '-fno-builtin',
    '-std=c++11', '-fvisibility=hidden', '-e', entry,
    '-flto', '-I', args.bsdir, '-I', os.path.join(args.progdir, progname),
    '-o', os.path.join(args.progdir, progname, 'bin.elf'),
    '-T', './src/linker.script2', '-Os'
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
  # Read the output files and put into a JSON compatible format.
  code_b64 = binary_to_b64(code_bin)
  rodata_b64 = binary_to_b64(rodata_bin)
  
  if os.path.exists(os.path.join(args.pkgdir, 'package.json')):
    with open(os.path.join(args.pkgdir, 'package.json'), 'r') as fd:
      pkg = json.loads(fd.read())
  else:
      pkg = {
        'code': {}
      }

  hasher = hashlib.sha1()
  hasher.update(code_b64)
  hasher.update(rodata_b64)
  cid = hasher.hexdigest()

  pkg['code'][cid] = {
    'program': args.program,
    'code': code_b64.decode('utf8'),
    'rodata': rodata_b64.decode('utf8'),
  }

  with open(os.path.join(args.pkgdir, 'package.json'), 'w') as fd:
    fd.write(json.dumps(pkg))

  print('.. package.json built... rebuilding package.js...')
  with open(os.path.join(args.pkgdir, 'package.js'), 'w') as fd:
    fd.write('module.exports = ')
    fd.write(json.dumps(pkg))
    fd.write(';')


def binary_to_b64(path):
  if not os.path.exists(path):
    return base64.b64encode(b'')
  with open(path, 'rb') as fd:
    data = fd.read()
    return base64.b64encode(data)   

ap = argparse.ArgumentParser()
ap.add_argument('--program', type=str, required=True)
ap.add_argument('--progdir', type=str, default='./progs', required=False)
ap.add_argument('--bsdir', type=str, default='./bsdir', required=False)
ap.add_argument('--pkgdir', type=str, default='./dist', required=False)
main(ap.parse_args())

