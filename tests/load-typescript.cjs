const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");

// Load the actual server handlers without starting Next.js or changing application data.
function typescriptLoader(overrides = {}) {
  const cache = new Map();
  function load(file) {
    const absolute = path.resolve(file);
    if (cache.has(absolute)) return cache.get(absolute).exports;
    const module = { exports: {} };
    cache.set(absolute, module);
    const compiled = ts.transpileModule(fs.readFileSync(absolute, "utf8"), {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2017,
        esModuleInterop: true,
      },
    }).outputText;
    const resolve = (name) => {
      if (Object.hasOwn(overrides, name)) return overrides[name];
      if (name === "server-only") return {};
      if (name.startsWith("@/")) {
        const target = path.resolve(name.slice(2));
        return target.endsWith(".cjs") ? require(target) : load(`${target}.ts`);
      }
      return require(name);
    };
    new Function("require", "module", "exports", compiled)(
      resolve,
      module,
      module.exports,
    );
    return module.exports;
  }
  return load;
}
module.exports = { typescriptLoader };
