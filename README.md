# babel-plugin-evaluate-modules

![npm](https://img.shields.io/npm/v/babel-plugin-evaluate-modules) ![check](https://github.com/inokawa/babel-plugin-evaluate-modules/workflows/check/badge.svg)

A babel plugin to evaluate modules at build-time.

## Why?

I wanted to evaluate some functions and calculations in build process that didn't need to run at runtime, to remove the modules themselves from the bundle to reduce its size.

- [babel-plugin-preval](https://github.com/kentcdodds/babel-plugin-preval) and [babel-plugin-codegen](https://github.com/kentcdodds/babel-plugin-codegen) only supports CommonJS not ES Modules, and the evaluation does not run in a sandbox.

- [babel-plugin-polished](https://github.com/styled-components/babel-plugin-polished) only supports [polished](https://github.com/styled-components/polished) and only handles simple syntaxes.

- [babel-plugin-inline-constants](https://github.com/wooorm/babel-plugin-inline-constants) only handles constants inlining.

## Setup

```sh
npm install babel-plugin-evaluate-modules
```

## Usage

### Evaluate modules in node_modules

```ts
// babel.config.js
module.exports = {
  plugins: [["babel-plugin-evaluate-modules", { name: "polished" }]],
};

// App.js
import { rgba } from "polished";

const val = "blue";
const obj = {
  color: "#123456",
  red: "red",
};

const a = rgba(val, 0.5); // const a = "rgba(0,0,255,0.5)";
const b = rgba(obj["color"], 0.5); // const b = "rgba(18,52,86,0.5)";
const c = rgba(obj.red, 0.5); // const c = "rgba(255,0,0,0.5)";
```

### Evaluate local modules

```ts
// babel.config.js
module.exports = {
  plugins: [["babel-plugin-evaluate-modules", { name: /\/constants\// }]],
};

// constants/foo.js
export const foo = 2 * 7;
export const bar = "bar" + "baz";

// App.js
import { foo, bar } from "./constants/foo.js";
const fooVal = foo; // const fooVal = 14;
const barVal = bar; // const barVal = "barbaz";
```

## Contribute

All contributions are welcome.
If you find a problem, feel free to create an [issue](https://github.com/inokawa/babel-plugin-evaluate-modules/issues) or a [PR](https://github.com/inokawa/babel-plugin-evaluate-modules/pulls).

### Making a Pull Request

1. Fork this repo.
2. Run `npm install`.
3. Commit your fix.
4. Add tests to cover your fix.
5. Make a PR and confirm all the CI checks passed.
