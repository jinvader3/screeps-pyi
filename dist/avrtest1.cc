typedef unsigned char uint8_t;
typedef unsigned short uint16_t;
typedef unsigned long uint32_t;

#define HEAPSIZE  1024
#define HEAPSEGSZ 8

uint8_t g_heap_bm[HEAPSIZE / HEAPSEGSZ];
uint8_t g_heap[HEAPSIZE];

void print_utf8_hex (uint8_t v);
void print_eol ();
void print_string (const char *s);
void malloc_init ();

class Okay {
  public:
  Okay();
  ~Okay();
};


int main () {
  //print_string("hello");
  //print_eol();
  print_utf8_hex(0x2a);
  print_eol();
  //print_utf8_hex(0x34);
  //print_eol();
  //print_utf8_hex(0x56);
  //print_eol();
  //malloc_init();

  //Okay *a = new Okay();
  //delete a;

  for (;;);
  return 0;
}

Okay::Okay() {
}

Okay::~Okay() {
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

void* operator new (unsigned int sz) {
  uint16_t cnt = (sz / HEAPSEGSZ) + 1;
  uint16_t x = 0;
  while (x < sizeof(g_heap_bm)) {
    uint16_t y = 0;
    uint16_t z = x;
    while (g_heap_bm[x++] == 0) {
      y++;
      if (y == cnt) {
        return (void*)&g_heap[z * HEAPSEGSZ]; 
      }
    }
  }

  return (void*)0;
}

void operator delete (void *ptr) {
}


