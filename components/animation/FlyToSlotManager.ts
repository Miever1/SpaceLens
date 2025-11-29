// FlyToSlotManager.ts
export type SlotRect = { x: number; y: number; width: number; height: number };

class FlyToSlotManager {
  private rectMap: Record<string, SlotRect> = {};

  setSlot(assetId: string, rect: SlotRect) {
    this.rectMap[assetId] = rect;
  }

  getSlot(assetId: string) {
    return this.rectMap[assetId];
  }

  removeSlot(assetId: string) {
    delete this.rectMap[assetId];
  }
}

export default new FlyToSlotManager();