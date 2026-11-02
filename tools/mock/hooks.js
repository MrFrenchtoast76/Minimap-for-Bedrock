// Node module hooks: redirect @minecraft/* imports to local mocks for tests.
const MOCKS = {
  "@minecraft/server": new URL("./server.js", import.meta.url).href,
  "@minecraft/server-ui": new URL("./server-ui.js", import.meta.url).href,
};
export async function resolve(specifier, context, next) {
  if (MOCKS[specifier]) return { url: MOCKS[specifier], shortCircuit: true };
  return next(specifier, context);
}
