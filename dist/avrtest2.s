# >TEST_MOV1
# Test if LDI, MOV, CP, and BREQ work.
out 4, 0
ldi r16, 0xff
mov r2, r16
cp r2, r16
breq test_mov1
out 6, 0
test_mov1:
cpi r16, 0xff
breq test_mov2
out 6, 0
test_mov2:

ldi r16, 10
ldi r17, 12
cp r16, r17
breq failure

rjmp terminate
failure:
out 6, 0
terminate:
out 7, 0
