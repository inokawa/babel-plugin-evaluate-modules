import type { PluginObj, PluginPass, NodePath } from "@babel/core";
import type BabelCore from "@babel/core";
import { transformSync } from "@babel/core";
import { readFileSync } from "fs";
import { sandboxedRequire } from "./vm";

type Types = typeof BabelCore.types;

interface VisitorState extends PluginPass {
  opts: { name?: string | RegExp };
}

const requireESM = (path: string): string => {
  return (
    transformSync(readFileSync(require.resolve(path), "utf8"), {
      plugins: [["@babel/plugin-transform-modules-commonjs"]],
    })?.code ?? ""
  );
};

const evaluateFunction = (
  t: Types,
  callExp: NodePath<BabelCore.types.CallExpression>,
  fn: (...args: any[]) => any
): BabelCore.types.Expression | null => {
  const args = callExp.get("arguments");
  const serializedArgs: (string | number | boolean | null)[] = [];
  for (const a of args) {
    if (a.isLiteral()) {
      serializedArgs.push("value" in a.node ? a.node.value : null);
    } else if (a.isIdentifier()) {
      const path = a.scope.bindings[a.node.name]?.path;
      if (!path || !path.isVariableDeclarator() || !path.node.init) {
        return null;
      }
      if ("value" in path.node.init) {
        serializedArgs.push(path.node.init.value);
      } else {
        return null;
      }
    } else {
      return null;
    }
  }

  const result = fn(...serializedArgs);
  return t.valueToNode(result);
};

const getModulePath = (p: NodePath<BabelCore.types.MemberExpression>) => {
  const property = p.get("property");
  if ("name" in property.node) {
    return property.node;
  } else {
    throw property.buildCodeFrameError("Not implemented yet");
  }
};

export default ({ types: t }: { types: Types }): PluginObj<VisitorState> => {
  return {
    name: "babel-plugin-prebuild",
    visitor: {
      ImportDeclaration(path, state) {
        if (!state.opts.name) {
          throw path.buildCodeFrameError("name is not given from options");
        }
        const { name } = state.opts;
        const sourceValue = path.get("source").node.value;

        if (name instanceof RegExp) {
          if (!name.test(sourceValue)) return;
        } else {
          if (sourceValue.indexOf(name) !== 0) return;
        }

        let importedModule: any;
        try {
          importedModule = require(sourceValue);
        } catch (e) {
          // maybe esm only module
          // read as cjs
          importedModule = sandboxedRequire(sourceValue, requireESM);
        }

        if (!importedModule) {
          throw path.buildCodeFrameError(`can't resolve ${sourceValue}`);
        }

        const invalidatedSpecifiers = path
          .get("specifiers")
          .filter((specifier) => {
            let importedValue = importedModule;

            if (specifier.isImportSpecifier()) {
              const imported = specifier.get("imported");
              if (!imported.isIdentifier()) {
                throw imported.buildCodeFrameError("not implemented yet");
              }
              const importedName = imported.node.name;
              const value = importedValue[importedName];
              if (!value) {
                throw imported.buildCodeFrameError(
                  `${importedName} does not exported from ${sourceValue}`
                );
              }
              importedValue = value;
            }

            const local = specifier.get("local");
            const binding = local.scope.getBinding(local.node.name);
            if (!binding) {
              throw local.buildCodeFrameError(`${sourceValue} is not used`);
            }

            const invalidatedRefs = binding.referencePaths.filter((ref) => {
              let targetModule = importedValue;

              // for interop of esm and cjs
              if (
                typeof targetModule === "object" &&
                "default" in targetModule
              ) {
                targetModule = targetModule.default;
              }

              const parentExp:
                | NodePath<BabelCore.types.CallExpression>
                | NodePath<BabelCore.types.MemberExpression>
                | NodePath<BabelCore.types.VariableDeclarator>
                | null = ref.findParent((parent) => {
                if (parent.isCallExpression()) {
                  return true;
                } else if (parent.isMemberExpression()) {
                  const methodName = getModulePath(parent).name;
                  const method = targetModule[methodName];
                  if (!method) {
                    throw parent.buildCodeFrameError(
                      `Method does not exist: ${methodName}`
                    );
                  }

                  targetModule = method;

                  if (!parent.parentPath.isCallExpression()) {
                    return true;
                  }

                  return false;
                } else if (parent.isVariableDeclarator()) {
                  return true;
                } else {
                  throw parent.buildCodeFrameError(
                    `Unexpected node type: ${parent.type}`
                  );
                }
              }) as any; // FIXME

              if (!parentExp) {
                throw ref.buildCodeFrameError(`${sourceValue} is not used`);
              }

              if (parentExp.isCallExpression()) {
                const resultAst = evaluateFunction(t, parentExp, targetModule);
                if (!resultAst) return true;
                parentExp.replaceWith(resultAst);
              } else if (parentExp.isMemberExpression()) {
                parentExp.replaceWith(t.valueToNode(targetModule));
              } else {
                ref.replaceWith(t.valueToNode(targetModule));
              }

              return false;
            });

            if (!invalidatedRefs.length) {
              specifier.remove();
              return false;
            } else {
              return true;
            }
          });

        if (!invalidatedSpecifiers.length) {
          path.remove();
        }
      },
    },
  };
};
