# babel-plugin-evaluate

A babel plugin to evaluate code at build-time.

## Why?

I wanted to evaluate some functions and calculations in build process, to remove the modules themselves from the bundle to make the bundle size smaller.

[babel-plugin-preval](https://github.com/kentcdodds/babel-plugin-preval) and [babel-plugin-codegen](https://github.com/kentcdodds/babel-plugin-codegen) only supports CommonJS not ES Modules, and handles limited syntaxes.

[babel-plugin-polished](https://github.com/styled-components/babel-plugin-polished) only supports [polishd](https://github.com/styled-components/polished) and handles limited syntaxes.

## Setup

```sh
npm install babel-plugin-evaluate
```

## Usage

### Evaluate modules in node_modules

```ts
// babel.config.js
module.exports = {
  plugins: [["babel-plugin-evaluate", { name: "polished" }]],
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
  plugins: [["babel-plugin-evaluate", { name: /\/constants\// }]],
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
If you find a problem, feel free to create an [issue](https://github.com/inokawa/babel-plugin-evaluate/issues) or a [PR](https://github.com/inokawa/babel-plugin-evaluate/pulls).

### Making a Pull Request

1. Clone this repo.
2. Run `npm install`.
3. Commit your fix.
4. Add tests to cover your fix.
5. Make a PR and confirm all the CI checks passed.
