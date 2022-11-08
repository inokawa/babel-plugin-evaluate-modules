import type { PluginObj, PluginPass, NodePath } from "@babel/core";
import type BabelCore from "@babel/core";

type Types = typeof BabelCore.types;

interface VisitorState extends PluginPass {
  opts: { name?: string };
}

const evaluateFunction = (
  t: Types,
  args: NodePath<BabelCore.types.Node>[],
  fn: (...args: any[]) => any
): BabelCore.types.Expression | null => {
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

export default ({ types: t }: { types: Types }): PluginObj<VisitorState> => {
  return {
    name: "babel-plugin-prebuild",
    visitor: {
      ImportDeclaration(path, state) {
        if (!state.opts.name) {
          throw path.buildCodeFrameError("name is not given from options");
        }
        const name = state.opts.name;
        const sourceValue = path.get("source").node.value;

        if (sourceValue.indexOf(name) !== 0) return;

        const importedModule = require(sourceValue);

        const invalidatedSpecifiers = path
          .get("specifiers")
          .filter((specifier) => {
            let importedValue = importedModule;

            if (specifier.isImportSpecifier()) {
              const imported = specifier.get("imported");
              if (imported.isIdentifier()) {
                const importedName = imported.node.name;
                const value = importedValue[importedName];
                if (!value) {
                  throw imported.buildCodeFrameError(
                    `Method does not exist: ${importedName}`
                  );
                }
                importedValue = value;
              } else {
                throw imported.buildCodeFrameError("Not implemented yet");
              }
            }

            const local = specifier.get("local");
            const binding = local.scope.getBinding(local.node.name);
            if (!binding) {
              throw local.buildCodeFrameError("Module not found");
            }

            const invalidatedRefs = binding.referencePaths.filter((ref) => {
              let matchedMethod = importedValue;

              const callExpression: NodePath<BabelCore.types.CallExpression> | null =
                ref.findParent((parent) => {
                  if (parent.isCallExpression()) {
                    return true;
                  } else if (parent.isMemberExpression()) {
                    const property = parent.get("property");
                    if ("name" in property.node) {
                      const methodName = property.node.name;
                      const method = matchedMethod[methodName];

                      if (!method) {
                        throw property.buildCodeFrameError(
                          `Method does not exist: ${methodName}`
                        );
                      }

                      matchedMethod = method;
                      return false;
                    } else {
                      throw property.buildCodeFrameError("Not implemented yet");
                    }
                  } else {
                    throw parent.buildCodeFrameError(
                      `Unexpected node type: ${parent.type}`
                    );
                  }
                }) as any; // FIXME

              if (!callExpression) {
                throw ref.buildCodeFrameError("Module is not called");
              }

              const args = callExpression.get("arguments");
              const resultAst = evaluateFunction(t, args, matchedMethod);
              if (!resultAst) return true;

              callExpression.replaceWith(resultAst);
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
