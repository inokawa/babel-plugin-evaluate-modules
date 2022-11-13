import * as vm from "vm";
import { dirname, join } from "path";
import { readFileSync } from "fs";
import { transformSync } from "@babel/core";

const isRelativeImport = (path: string): boolean => {
  return /^[./]/.test(path);
};

const requireESM = (path: string): string => {
  return (
    transformSync(readFileSync(require.resolve(path), "utf8"), {
      plugins: [["@babel/plugin-transform-modules-commonjs"]],
    })?.code ?? ""
  );
};

export const sandboxedRequire = (entryFilename: string): any => {
  const code = requireESM(
    isRelativeImport(entryFilename)
      ? join(__dirname, entryFilename)
      : entryFilename
  );

  const vmRequire = (filename: string) => {
    const code = requireESM(
      isRelativeImport(filename)
        ? join(dirname(entryFilename), filename)
        : filename
    );
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
