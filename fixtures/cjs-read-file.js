const fs = require("fs");
const val = fs.readFileSync(__dirname + "/test.md", "utf8");

module.exports = {
  val,
};
