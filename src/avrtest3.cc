#include "game.h"

int __attribute__((visibility("default"))) __attribute__(( section(".main") )) start (Room room, Creep creep) {
  Controller controller = room.GetController();
  Source source = room.GetSourceByIndex(0);

  uint8_t mode = 0;

  while (true) {
    uint16_t eused = creep.GetUsedCapacity(ResourceType::ENERGY);
    uint16_t efree = creep.GetFreeCapacity(ResourceType::ENERGY);
    
    if (eused == 0 && mode == 1) {
      mode = 0;
    } else if (efree == 0 && mode == 0) {
      mode = 1;
    }
    
    if (mode == 0) {
      // harvest
      if (creep.Harvest(source) != GameResult::OK) {
        creep.MoveTo(source);
      }
    } else {
      // upgrade
      if (creep.Upgrade(controller) != GameResult::OK) {
        creep.MoveTo(controller);
      }
    }

    Game::WaitNextTick();
  }
  return 0;
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


