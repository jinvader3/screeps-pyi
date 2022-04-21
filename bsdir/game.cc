#include "game.h"
uint8_t g_heap_bm[HEAPSIZE / HEAPSEGSZ];
uint8_t g_heap[HEAPSIZE];

void IOWrite8(uint8_t value) {
  __asm__("out 0, %0" : : "r" (value));
}

uint8_t IORead8() {
  uint8_t value;
  __asm__("in %0, 0" : "=r" (value));
  return value;
}

void IOWrite16(uint16_t value) {
  IOWrite8(value & 0xff);
  IOWrite8(value >> 8 & 0xff);
}

void IOExecute() {
  __asm__("out 1, 0");
}

uint16_t IORead16() {
  uint16_t value;
  value = IORead8();
  value |= IORead8() << 8;
  return value;
}

Controller Room::GetController() {
  /*
    out <GetControllerFunctionId>
    out <RoomId>
    in <ControllerIdLowByte>
    in <ControllerIdHighByte>
  */
  IOWrite16(0);
  IOWrite16(this->name.id);
  IOExecute();
  return Controller(IORead16());
}

GameResult Creep::Harvest(GameObject gobj) {
  IOWrite16(1);
  IOWrite16(gobj.id.id);
  IOExecute();
  return (GameResult)IORead16();
}

Source Room::GetSourceByIndex(uint8_t index) {
  IOWrite16(2);
  IOWrite8(index);
  IOExecute();
  return Source(IORead16());
}

GameResult Creep::Upgrade(GameObject gobj) {
  IOWrite16(3);
  IOWrite16(this->id.id);
  IOWrite16(gobj.id.id);
  IOExecute();
  return (GameResult)IORead16();
}

GameResult Creep::MoveTo(GameObject gobj) {
  IOWrite16(4);
  IOWrite16(this->id.id);
  IOWrite16(gobj.id.id);
  IOExecute();
  return (GameResult)IORead16();
}

uint16_t Creep::GetUsedCapacity(ResourceType rtype) {
  IOWrite16(5);
  IOWrite16(this->id.id);
  IOWrite16((uint16_t)rtype);
  IOExecute();
  return IORead16();
}

uint16_t Creep::GetFreeCapacity(ResourceType rtype) {
  IOWrite16(6);
  IOWrite16(this->id.id);
  IOWrite16((uint16_t)rtype);
  IOExecute();
  return IORead16();
}

void Game::WaitNextTick() {
  IOWrite16(5);
  IOExecute();
}

Controller::Controller(uint16_t id) : GameObject(id) { 
}

Source::Source(uint16_t id) : GameObject(id) { 
}

GameObject::GameObject(uint16_t id) : id(id) {
}

ObjectId::ObjectId(uint16_t id) : InteropId(id) {
}

InteropId::InteropId(uint16_t id) {
  this->id = id;
}

void print_char (uint16_t v) {
  __asm__("out 0, %0" : : "r" (v));
}

void print_nibble (uint8_t v) {
  if (v > 9) {
    print_char('A' + (v - 10));
  } else {
    print_char('0' + v);
  }
}

void print_utf8_hex (uint8_t v) {
  print_nibble((v >> 4) & 0xf);
  print_nibble(v & 0xf);
}

void print_utf16_hex (uint16_t v) {
  print_utf8_hex((v >> 8) & 0xff);
  print_utf8_hex(v & 0xff);
}

void print_string (const char *s) {
  for (uint16_t x = 0; s[x] != 0; ++x) {
    print_char(s[x]);
  }
}

void print_eol () {
  print_char('\n');
}

void malloc_init () {
  for (uint16_t x = 0; x < HEAPSIZE / HEAPSEGSZ; ++x) {
    g_heap_bm[x] = 0;
  }
}

void memset (void *ptr, unsigned int sz, unsigned char value) {
  for (unsigned int x = 0; x < sz; ++x) {
    ((uint8_t*)((unsigned int)ptr + x))[0] = value;
  }
}

void* malloc (unsigned int sz) {
  uint16_t cnt = (sz / HEAPSEGSZ) + 1;
  for (uint16_t x = 0; x < sizeof(g_heap_bm); ++x) {
    if (g_heap_bm[x] == 0) {
      for (uint16_t y = 0; 
        (y + x < sizeof(g_heap_bm)) &&
        (g_heap_bm[y + x] == 0); ++y) {
        if (y == cnt - 1) {
          for (uint16_t z = 0; z < y + 1; ++z) {
            g_heap_bm[x + z] = 1;
          }
          return (void*)&g_heap[x * HEAPSEGSZ];
        }
      } 
    }
  }
  
  __asm__("out 6, 0");

  return (void*)0;
}

void* operator new (unsigned int sz) {
  return malloc(sz);
}

void operator delete (void *ptr) {
}
