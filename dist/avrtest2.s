# >TEST_MOV1
# Test if LDI, MOV, CP, and BREQ work.
test_mov0:
  out 4, 0
  ldi r16, 0xff
  mov r2, r16
  cp r2, r16
  breq test_mov0_1
  out 6, 0
  test_mov0_1:
    cpi r16, 0xff
    breq test_mov0_2
  out 6, 0
  test_mov0_2:

test_cp:
  ldi r16, 10
  ldi r17, 12
  cp r16, r17
  breq test_cp_failure
  brcs test_cp1
  out 6, 0
  test_cp1:
  cp r17, r16
  breq test_cp_failure
  brcs test_cp_failure
  rjmp test_cp_done
  test_cp_failure:
    out 6, 0
  test_cp_done:

test_math0:
  ldi r17, 1
  ldi r16, 0
  subi r16, 1
  brcs test_math0_0
  out 6, 0
  test_math0_0:
  cpi r16, 0xff
  # testing subtraction worked
  brne failure
  add r16, r17
  cpi r16, 0
  # testing addition worked
  brne failure
  ldi r16, 0x01
  ldi r17, 0xff
  add r16, r17
  # testing if C is set
  brcs test_math0_1
  out 6, 0
  test_math0_1:
  ldi r16, 1
  subi r16, 1
  # testing if Z is set
  brne failure
  ldi r24, 0x0
  ldi r25, 0x0
  sbiw r24, 1
  cpi r24, 0xff
  brne failure
  cpi r25, 0xff
  brne failure
  adiw r24, 1
  brcs test_math0_2
  out 6, 0
  test_math0_2:

test_bits:
  ldi r16, 0xff
  ldi r17, 0xff
  and r16, r17
  cpi r16, 0xff
  brne failure
  ldi r16, 0xff
  andi r16, 0xfe
  cpi r16, 0xfe
  brne failure
  ldi r16, 0xff
  lsr r16
  brcc failure
  cpi r16, 0x7f
  brne failure
  ldi r16, 0x1
  ror r16
  ror r16
  cpi r16, 0x80
  brne failure

test_data:
  # Make sure memory is zeroed.
  ldi r30, 0
  ldi r31, 0
  ld r16, z+
  cpi r16, 0
  brne failure
  # Put a new value in memory.
  ldi r30, 0
  ldi r31, 0
  ldi r16, 0xff
  st z+, r16 
  st z+, r16
  st z+, r16
  ldi r30, 0
  ldi r31, 0
  ld r28, z+
  cpi r28, 0xff
  brne failure
  ld r28, z+
  cpi r28, 0xff
  brne failure
  ld r28, z+
  cpi r28, 0xff
  brne failure

rjmp terminate
failure:
out 6, 0
terminate:
out 7, 0
