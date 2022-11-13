import * as vm from "vm";
import { dirname, join } from "path";

export const sandboxedRequire = (
  entryFilename: string,
  require: (file: string) => string
) => {
  const code = require(join(__dirname, entryFilename));

  const vmRequire = (filename: string) => {
    const code = require(join(dirname(entryFilename), filename));
    const module = { exports: {} };
    const context = vm.createContext({
      module: module,
      exports: module.exports,
      require: vmRequire,
    });
    vm.runInContext(`(function (exports) { ${code}\n})(exports);`, context);
    return module.exports;
  };

  const module = { exports: {} };
  const context = vm.createContext({
    module: module,
    exports: module.exports,
    require: vmRequire,
  });
  vm.runInContext(`(function (exports) { ${code}\n})(exports);`, context);
  return module.exports;
};
