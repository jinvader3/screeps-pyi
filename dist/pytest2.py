import os

goo = Goo()

class Test:
  def __init__(self):
    os.debug('hello from __init__')
    self.param1 = True

  def method1(self):
    os.debug('hello from method1')

  os.next_tick()

test = Test()
test.method1()

