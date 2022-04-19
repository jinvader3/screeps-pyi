typedef unsigned char uint8_t;
typedef unsigned short uint16_t;
typedef unsigned long uint32_t;

#define HEAPSIZE  1024
#define HEAPSEGSZ 8

uint8_t g_heap_bm[HEAPSIZE / HEAPSEGSZ];
uint8_t g_heap[HEAPSIZE];

void print (const char *s);
void malloc_init ();

class Okay {
  public:
  Okay();
  ~Okay();
};


int main () {
  print("h");
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

void print (const char *s) {
  for (uint16_t x = 0; s[x] != 0; ++x) {
    __asm__("out 0, %0" : : "r" (s[x]));
  }
  __asm__("out 0, %0" : : "r" ('\n'));
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


