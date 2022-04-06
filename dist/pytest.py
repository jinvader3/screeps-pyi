import os

def apple():
  def bad():
    os.debug('called bad')
    return False
  while True:
    bad()
    grape()
    os.next_tick()
    os.debug('apple loop')

def grape():
  while True:
    os.next_tick()
    os.debug('grape loop')

def main():
  os.spawn_thread(apple)
  os.spawn_thread(grape)

main()
