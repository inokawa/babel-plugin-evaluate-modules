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
    } else {
      return null;
    }
  }

  const result = fn(...serializedArgs);
  const resultAst = t.valueToNode(result);
  return resultAst;
};

export default ({ types: t }: { types: Types }): PluginObj<VisitorState> => {
  return {
    name: "babel-plugin-prebuild",
    visitor: {
      ImportDeclaration(path, state) {
        if (!state.opts.name) {
          throw new Error("name is not given from options");
        }
        const name = state.opts.name;
        const source = path.get("source");
        const sourceValue = source.node.value;
        const specifiers = path.get("specifiers");

        if (sourceValue.indexOf(name) !== 0) return;

        const importedModule = require(sourceValue);

        const invalidatedSpecifiers = specifiers.filter((specifier) => {
          let importedValue = importedModule;

          if (
            specifier.node.type === "ImportSpecifier" &&
            specifier.node.imported
          ) {
            const imported = specifier.get("imported");
            const importedName = (imported as any).node.name;
            const value = importedValue[importedName];

            if (!value) {
              throw (imported as any).buildCodeFrameError(
                "Method does not exist: " + importedName
              );
            }

            importedValue = value;
          }

          const local = specifier.get("local");
          const binding = local.scope.getBinding(local.node.name);
          if (!binding) {
            throw local.buildCodeFrameError(
              `local does not exist: ${local.node.name}`
            );
          }

          const invalidatedRefs = binding.referencePaths.filter((ref) => {
            let matchedMethod = importedValue;

            const callExpression = ref.findParent((parent) => {
              if (parent.isCallExpression()) {
                return true;
              } else if (parent.isMemberExpression()) {
                const property = parent.get("property");
                const methodName = (property.node as any).name;
                const method = matchedMethod[methodName];

                if (!method) {
                  throw property.buildCodeFrameError(
                    `Method does not exist: ${methodName}`
                  );
                }

                matchedMethod = method;
                return false;
              } else {
                throw parent.buildCodeFrameError(
                  `Unexpected node type: ${parent.type}`
                );
              }
            });

            if (!callExpression) {
              throw ref.buildCodeFrameError("call expression not found");
            }

            const args = callExpression.get("arguments");
            const resultAst = evaluateFunction(
              t,
              Array.isArray(args) ? args : [args],
              matchedMethod
            );
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
