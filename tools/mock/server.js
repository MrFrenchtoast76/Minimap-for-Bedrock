// Minimal mock of @minecraft/server, just enough for tools/selftest.js.
const listeners = () => ({ subscribe() {}, unsubscribe() {} });
export const world = {
  afterEvents: new Proxy({}, { get: listeners }),
  beforeEvents: new Proxy({}, { get: listeners }),
  getAllPlayers: () => [],
  getTimeOfDay: () => 6000,
  getDay: () => 3,
  sendMessage() {},
};
export const system = {
  beforeEvents: new Proxy({}, { get: listeners }),
  afterEvents: new Proxy({}, { get: listeners }),
  run: (fn) => fn(),
  runTimeout: (fn) => fn(),
  runInterval: () => 0,
};
export class Player {}
export class ItemStack { constructor(id, n) { this.typeId = id; this.amount = n; } }
export const CommandPermissionLevel = { Any: 0, GameDirectors: 1, Admin: 2 };
export const CustomCommandParamType = { Integer: 1, String: 4 };
export const CustomCommandStatus = { Success: 0, Failure: 1 };
