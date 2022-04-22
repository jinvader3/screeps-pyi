#ifndef _H_GAME
#define _H_GAME
typedef unsigned char uint8_t;
typedef unsigned short uint16_t;
typedef unsigned long uint32_t;
typedef unsigned int uintptr_t;

#define ENTRY_ATTRIBUTES __attribute__((visibility("default"))) __attribute__((section(".main")))
#define HEAPSIZE  32
#define HEAPSEGSZ 8

void* malloc (unsigned int sz);
void print_utf16_hex (uint16_t v);
void print_utf8_hex (uint8_t v);
void print_eol ();
void print_string (const char *s);
void malloc_init ();
void memset (void *ptr, unsigned int sz, unsigned char value);
void host_inc_ref (uint16_t id);
void host_dec_ref (uint16_t id);

template <class T> struct remove_reference { typedef T type; };
template <class T> struct remove_reference<T&> { typedef T type; };
template <class T> struct remove_reference<T&&> { typedef T type; };

template <typename T> typename remove_reference<T>::type&& move(T&& arg) {
  return static_cast<typename remove_reference<T&>::type&&>(arg);
}

class Game {
  private:
  Game();
  ~Game();
  public:
  const static uint16_t RESOURCE_ENERGY = 100;
  const static uint16_t OK = 101;
  static void WaitNextTick();
};

class RoomId {
  public:
  uint16_t x;
  uint16_t y;
  RoomId(uint16_t x, uint16_t y);
};

class InteropId {
  private:
  InteropId();
  InteropId(uint16_t id);
  public:
  InteropId(InteropId &id) = delete;
  uint16_t id;
  static InteropId New(uint16_t id);
  InteropId Copy();
  InteropId(InteropId &&id);
  ~InteropId();
};

class GameObject {
  public:
  InteropId id;
  GameObject(InteropId&& id);
};

class Controller : public GameObject {
  public:
  Controller(InteropId&& id);
};

class Source : public GameObject {
  public:
  Source(InteropId&& id);
};

class Room {
  public:
  InteropId name;
  Controller GetController();
  uint8_t GetSourceCount();
  Source GetSourceByIndex(uint8_t index);
};

typedef uint16_t GameConstant;

enum class ResourceType: uint16_t {
  ENERGY = Game::RESOURCE_ENERGY,
};

enum class GameResult: uint16_t {
  OK = Game::OK,
};

class Creep : public GameObject {
  public:
  uint16_t GetUsedCapacity(ResourceType rtype);
  uint16_t GetFreeCapacity(ResourceType rtype);
  GameResult Upgrade(GameObject& object);
  GameResult Harvest(GameObject& object);
  GameResult MoveTo(GameObject& object);
};

void IOReset();
void IOWrite8(uint8_t value);
uint8_t IORead8();
void IOWrite16(uint16_t value);
void IOExecute();
uint16_t IORead16();
#endif
