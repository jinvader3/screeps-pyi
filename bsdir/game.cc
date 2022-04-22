#include "game.h"

#define CMDBUFSZ (2 + 4 + 4 + 4)

union cbuf {
  uint8_t v8[CMDBUFSZ];
  uint16_t v16[CMDBUFSZ / 2];
};

uint16_t g_cbuf_ndx;
volatile cbuf g_cbuf;

uint8_t g_heap_bm[HEAPSIZE / HEAPSEGSZ];
uint8_t g_heap[HEAPSIZE];

void IOReset() {
}

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
  IOReset();
  IOWrite16(0);
  IOWrite16(this->name.id);
  IOExecute();
  IOReset();
  return Controller(move(InteropId::New(IORead16())));
}

GameResult Creep::Harvest(GameObject &gobj) {
  IOReset();
  IOWrite16(1);
  IOWrite16(gobj.id.id);
  IOExecute();
  IOReset();
  return (GameResult)IORead16();
}

Source Room::GetSourceByIndex(uint8_t index) {
  IOReset();
  IOWrite16(2);
  IOWrite16(this->name.id);
  IOWrite16(index);
  IOExecute();
  IOReset();
  return Source(InteropId::New(IORead16()));
}

GameResult Creep::Upgrade(GameObject &gobj) {
  IOReset();
  IOWrite16(3);
  IOWrite16(this->id.id);
  IOWrite16(gobj.id.id);
  IOExecute();
  IOReset();
  return (GameResult)IORead16();
}

GameResult Creep::MoveTo(GameObject &gobj) {
  IOReset();
  IOWrite16(4);
  IOWrite16(this->id.id);
  IOWrite16(gobj.id.id);
  IOExecute();
  IOReset();
  return (GameResult)IORead16();
}

uint16_t Creep::GetUsedCapacity(ResourceType rtype) {
  IOReset();
  __asm__("out 6, 6");
  IOWrite16(5);
  IOWrite16(this->id.id);
  IOWrite16((uint16_t)rtype);
  IOExecute();
  IOReset();
  return IORead16();
}

uint16_t Creep::GetFreeCapacity(ResourceType rtype) {
  IOReset();
  IOWrite16(6);
  IOWrite16(this->id.id);
  IOWrite16((uint16_t)rtype);
  IOExecute();
  IOReset();
  return IORead16();
}

void Game::WaitNextTick() {
  IOReset();
  IOWrite16(7);
  IOExecute();
}

Controller::Controller(InteropId &&id) : GameObject(move(id)) { 
}

Source::Source(InteropId &&id) : GameObject(move(id)) { 
}

GameObject::GameObject(InteropId &&id) : id(move(id)) {
}

InteropId::InteropId(uint16_t id): id(id) {
}

InteropId InteropId::New(uint16_t id) {
  return InteropId(id);
}

InteropId::InteropId(InteropId&& id) {
  // Now, increment the reference host side.
  host_inc_ref(id.id);
  this->id = id.id;
}

InteropId InteropId::Copy() {
  return move(*this);
}

InteropId::~InteropId() {
  host_dec_ref(this->id);
}

void host_inc_ref (uint16_t id) {
  IOReset();
  IOWrite16(8);
  IOWrite16(id);
  IOExecute();  
}

void host_dec_ref (uint16_t id) {
  IOReset();
  IOWrite16(9);
  IOWrite16(id);
  IOExecute();  
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
