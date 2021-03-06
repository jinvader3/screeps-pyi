typedef unsigned char uint8_t;
typedef unsigned short uint16_t;
typedef unsigned long uint32_t;

#define HEAPSIZE  32
#define HEAPSEGSZ 8

uint8_t g_heap_bm[HEAPSIZE / HEAPSEGSZ];
uint8_t g_heap[HEAPSIZE];

void* malloc (unsigned int sz);
void print_utf16_hex (uint16_t v);
void print_utf8_hex (uint8_t v);
void print_eol ();
void print_string (const char *s);
void malloc_init ();

class Game {
  private:
  Game();
  ~Game();
  public:
  static void test1();
};

int __attribute__(( section(".main") )) main () {
  uint8_t id;

  __asm__("mov %0, r0" : "=r" (id));

  print_utf8_hex(id);

  Game::test1(); 

  for (;;);
  return 0;
}

Game::Game() {
  __asm__("out 6, 0");
}

Game::~Game() {
}

void Game::test1() {
  __asm__("out 6, 0");
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


