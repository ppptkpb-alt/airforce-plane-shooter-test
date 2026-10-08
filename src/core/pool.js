// Object pool: ใช้ object ซ้ำแทนการสร้างใหม่ ลดภาระ garbage collector
// object ต้องมี field `alive`; เรียก sweep() หลัง update เพื่อคืน object ที่ตายแล้วเข้า pool
export class Pool {
  constructor(factory, initialSize = 0) {
    this.factory = factory;
    this.free = [];
    this.active = [];
    for (let i = 0; i < initialSize; i++) this.free.push(factory());
  }

  acquire() {
    const obj = this.free.length > 0 ? this.free.pop() : this.factory();
    obj.alive = true;
    this.active.push(obj);
    return obj;
  }

  sweep() {
    const active = this.active;
    for (let i = active.length - 1; i >= 0; i--) {
      const obj = active[i];
      if (!obj.alive) {
        // swap-remove: O(1) ไม่ต้อง shift array
        active[i] = active[active.length - 1];
        active.pop();
        this.free.push(obj);
      }
    }
  }

  clear() {
    for (const obj of this.active) obj.alive = false;
    this.sweep();
  }

  get count() {
    return this.active.length;
  }
}
