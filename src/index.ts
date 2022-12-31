import type { PluginObj, PluginPass, NodePath, types } from "@babel/core";
import { sandboxedRequire } from "./vm";

type Types = typeof types;

export type ModuleName = string | RegExp;

interface VisitorState extends PluginPass {
  opts: { name?: ModuleName | ModuleName[] };
}

const getModulePath = (p: NodePath<types.MemberExpression>) => {
  const property = p.get("property");
  if ("name" in property.node) {
    return property.node;
  } else {
    throw property.buildCodeFrameError("Not implemented yet");
  }
};

const getBindingFromIdentifier = (a: NodePath<types.Identifier>) => {
  const binding = a.scope.getBinding(a.node.name);
  if (!binding) return null;
  const path = binding.path;
  if (!path || !path.isVariableDeclarator() || !path.node.init) {
    return null;
  }
  return path.get("init");
};

const resolveLiteral = (p: NodePath<types.Literal>) => {
  return "value" in p.node ? p.node.value : null;
};

const getName = (
  p:
    | NodePath<types.Identifier>
    | NodePath<types.StringLiteral>
    | NodePath<types.NumericLiteral>
): string | number => ("name" in p.node ? p.node.name : p.node.value);

const resolveObjectExpression = (
  obj: NodePath<types.ObjectExpression>,
  props: (
    | NodePath<types.Identifier>
    | NodePath<types.StringLiteral>
    | NodePath<types.NumericLiteral>
  )[]
): NodePath<types.Literal> | null => {
  const targetP = props.pop()!;
  const propertyName = getName(targetP);
  for (const objectP of obj.get("properties")) {
    if (objectP.isObjectProperty()) {
      const rpKey = objectP.get("key");
      if (
        (rpKey.isIdentifier() ||
          rpKey.isStringLiteral() ||
          rpKey.isNumericLiteral()) &&
        getName(rpKey) === propertyName
      ) {
        const v = objectP.get("value");
        if (v.isLiteral()) {
          return v;
        } else if (v.isObjectExpression()) {
          return resolveObjectExpression(v, props);
        } else {
          return null;
        }
      }
    }
  }
  return null;
};

const resolveObjectMember = (
  path: NodePath<types.MemberExpression>,
  props: (
    | NodePath<types.Identifier>
    | NodePath<types.StringLiteral>
    | NodePath<types.NumericLiteral>
  )[]
): NodePath<types.Literal> | null => {
  const o = path.get("object");
  const p = path.get("property");
  if (!p.isIdentifier() && !p.isStringLiteral() && !p.isNumericLiteral()) {
    return null;
  }
  const nextProps = [...props, p];
  if (o.isMemberExpression()) {
    return resolveObjectMember(o, nextProps);
  } else if (o.isIdentifier()) {
    const objectRoot = getBindingFromIdentifier(o);
    if (!objectRoot) return null;
    if (objectRoot.isObjectExpression()) {
      return resolveObjectExpression(objectRoot, nextProps);
    }
  }

  return null;
};

const evaluateFunction = (
  t: typeof types,
  callExp: NodePath<types.CallExpression>,
  fn: (...args: any[]) => any
): types.Expression | null => {
  const args = callExp.get("arguments");
  const serializedArgs: (string | number | boolean | null)[] = [];
  for (const a of args) {
    if (a.isLiteral()) {
      serializedArgs.push(resolveLiteral(a));
    } else if (a.isIdentifier()) {
      const v = getBindingFromIdentifier(a);
      if (!v) return null;
      if (v.isLiteral()) {
        serializedArgs.push(resolveLiteral(v));
        continue;
      }
      return null;
    } else if (a.isMemberExpression()) {
      const v = resolveObjectMember(a, []);
      if (!v) return null;
      if (v.isLiteral()) {
        serializedArgs.push(resolveLiteral(v));
        continue;
      }
      return null;
    } else {
      return null;
    }
  }

  const result = fn(...serializedArgs);
  const parent = callExp.parentPath;
  if (parent.isMemberExpression()) {
    const property = parent.get("property");
    const object = parent.get("object");
    if (property.isIdentifier() && object.isCallExpression()) {
      return t.valueToNode(
        evaluateFunction(t, object, result[property.node.name])
      );
    }
  }
  return t.valueToNode(result);
};

export default ({ types: t }: { types: Types }): PluginObj<VisitorState> => {
  return {
    name: "babel-plugin-evaluate-modules",
    visitor: {
      ImportDeclaration(path, state) {
        if (!state.opts.name) {
          throw path.buildCodeFrameError("name option is not given");
        }
        let name = state.opts.name;
        const sourceValue = path.get("source").node.value;

        if (!Array.isArray(name)) {
          name = [name];
        }
        if (
          !name.some((n) => {
            if (n instanceof RegExp) {
              if (n.test(sourceValue)) {
                return true;
              }
            } else {
              if (sourceValue.indexOf(n) === 0) {
                return true;
              }
            }
            return false;
          })
        ) {
          return;
        }

        let importedModule: any;
        try {
          importedModule = require(sourceValue);
        } catch (e) {
          // maybe esm only module
          // read as cjs
          importedModule = sandboxedRequire(sourceValue);
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
                | NodePath<types.CallExpression>
                | NodePath<types.MemberExpression>
                | NodePath<types.VariableDeclarator>
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
