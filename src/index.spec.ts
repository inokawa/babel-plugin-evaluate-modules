import { it, expect } from "@jest/globals";
import { transform } from "@babel/core";
import plugin from "./";

it("namespace", () => {
  expect(
    transform(
      `
      import * as polished from 'polished';

      let a = polished.clearFix();
      let b = polished.clearFix('parent');
      let c = polished.ellipsis();
      let d = polished.ellipsis('250px');
      `,
      { plugins: [[plugin, { name: "polished" }]] }
    )?.code
  ).toMatchInlineSnapshot(`
    "let a = {
      "&::after": {
        clear: "both",
        content: "\\"\\"",
        display: "table"
      }
    };
    let b = {
      "parent::after": {
        clear: "both",
        content: "\\"\\"",
        display: "table"
      }
    };
    let c = {
      display: "inline-block",
      maxWidth: "100%",
      overflow: "hidden",
      textOverflow: "ellipsis",
      whiteSpace: "nowrap",
      wordWrap: "normal"
    };
    let d = {
      display: "inline-block",
      maxWidth: "250px",
      overflow: "hidden",
      textOverflow: "ellipsis",
      whiteSpace: "nowrap",
      wordWrap: "normal"
    };"
  `);
});

it("nested paths", () => {
  expect(
    transform(
      `
      import clearFix from 'polished/lib/mixins/clearFix';
      import ellipsis from 'polished/lib/mixins/ellipsis';

      let a = clearFix();
      let b = clearFix('parent');
      let c = ellipsis();
      let d = ellipsis('250px');
     `,
      { plugins: [[plugin, { name: "polished" }]] }
    )?.code
  ).toMatchInlineSnapshot(`
"let a = {
  "&::after": {
    clear: "both",
    content: "\\"\\"",
    display: "table"
  }
};
let b = {
  "parent::after": {
    clear: "both",
    content: "\\"\\"",
    display: "table"
  }
};
let c = {
  display: "inline-block",
  maxWidth: "100%",
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
  wordWrap: "normal"
};
let d = {
  display: "inline-block",
  maxWidth: "250px",
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
  wordWrap: "normal"
};"
`);
});

it("specifiers", () => {
  expect(
    transform(
      `
      import {clearFix, ellipsis} from 'polished';
      
      let a = clearFix();
      let b = clearFix('parent');
      let c = ellipsis();
      let d = ellipsis('250px');
     `,
      { plugins: [[plugin, { name: "polished" }]] }
    )?.code
  ).toMatchInlineSnapshot(`
"let a = {
  "&::after": {
    clear: "both",
    content: "\\"\\"",
    display: "table"
  }
};
let b = {
  "parent::after": {
    clear: "both",
    content: "\\"\\"",
    display: "table"
  }
};
let c = {
  display: "inline-block",
  maxWidth: "100%",
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
  wordWrap: "normal"
};
let d = {
  display: "inline-block",
  maxWidth: "250px",
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
  wordWrap: "normal"
};"
`);
});

it("non-literal arg", () => {
  expect(
    transform(
      `
      import * as polished from 'polished';
      
      let parent = 'parent';
      
      let a = polished.clearFix(parent);
      let b = polished.clearFix('parent');
    `,
      { plugins: [[plugin, { name: "polished" }]] }
    )?.code
  ).toMatchInlineSnapshot(`
"let parent = 'parent';
let a = {
  "parent::after": {
    clear: "both",
    content: "\\"\\"",
    display: "table"
  }
};
let b = {
  "parent::after": {
    clear: "both",
    content: "\\"\\"",
    display: "table"
  }
};"
`);
});

it("variables", () => {
  expect(
    transform(
      `
      import {rgba} from 'polished';

      const val = "blue";
      const obj = {
        color: "#123456",
        red: "red"
      };
      
      const a = rgba(val, 0.5);
      const b = rgba(obj.color, 0.5);
      const c = rgba(obj.red, 0.5);
    `,
      { plugins: [[plugin, { name: "polished" }]] }
    )?.code
  ).toMatchInlineSnapshot(`
"import { rgba } from 'polished';
const val = "blue";
const obj = {
  color: "#123456",
  red: "red"
};
const a = "rgba(0,0,255,0.5)";
const b = rgba(obj.color, 0.5);
const c = rgba(obj.red, 0.5);"
`);
});

it("null args", () => {
  expect(
    transform(
      `
      import {position} from 'polished';
      
      let a = position('absolute', '20px', '20px', null, null)
    `,
      { plugins: [[plugin, { name: "polished" }]] }
    )?.code
  ).toMatchInlineSnapshot(`
"let a = {
  top: "20px",
  right: "20px",
  position: "absolute"
};"
`);
});
