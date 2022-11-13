import * as vm from "vm";
import { dirname, join } from "path";
import { readFileSync } from "fs";
import { transformSync } from "@babel/core";

const requireESM = (path: string): string => {
  return (
    transformSync(readFileSync(require.resolve(path), "utf8"), {
      plugins: [["@babel/plugin-transform-modules-commonjs"]],
    })?.code ?? ""
  );
};

export const sandboxedRequire = (entryFilename: string): any => {
  const code = requireESM(join(__dirname, entryFilename));

  const vmRequire = (filename: string) => {
    const code = requireESM(join(dirname(entryFilename), filename));
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
