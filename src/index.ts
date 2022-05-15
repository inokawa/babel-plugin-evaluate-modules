import type babelCore from "@babel/core";

type VisitorState = {
  file: {
    opts: babelCore.TransformOptions;
  };
};

export default function plugin(
  babel: typeof babelCore
): babelCore.PluginObj<VisitorState> {
  const { types: t, template, transformFromAst } = babel;
  return {
    name: "babel-plugin-prebuild",
    visitor: {
      Program(path, { file: { opts: fileOpts } }) {
        // TODO
      },
      ImportDeclaration(path, { file: { opts: fileOpts } }) {
        // TODO
      },
      CallExpression(path, { file: { opts: fileOpts } }) {
        // TODO
      },
    },
  };
}
