#include "game.h"

int ENTRY_ATTRIBUTES start (Room room, Creep creep) {
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
