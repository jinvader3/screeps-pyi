import os

def apple():
  def bad():
    return False
  while True:
    bad()
    grape()
    os.next_tick()

def grape():
  while True:
    os.next_tick()

def main():
  os.spawn_thread(apple)
  #os.spawn_thread(grape)

main()
