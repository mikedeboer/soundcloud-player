/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

const Sandbox = require("./sandbox");

function check(expr, defines) {
  try {
    return Sandbox.eval(expr, defines);
  } catch(ex) {
    if (ex.message == expr + " is not defined")
      return false;
    throw new Error("Error parsing ifdef: " + expr + " - " + ex.message);
  }
}

exports.parse = function(content, defines, path, devMode) {
  path = path || "<internal file>"
  let line, m, j, l, res;
  let output       = [];
  let blockdefdata = [];
  let nowrite      = -1;
  let level        = 0;
  let ifMatched    = false;
  let blockdef     = "";
  let lines        = content.split(/[\n\r]+/g);

  for (j = 0, l = lines.length; j < l; j++) {
    line = lines[j];
    m = line.match(/^(.*)\s*\%(\w+)\s*(.*)/);
    if (m)
      line = m[1];

    if (nowrite == -1) {
      if (blockdef)
        blockdefdata.push(line);
      else
        output.push(line);
    }

    if (!m)
      continue;

    switch (m[2]) {
      case "begindef":
        if (blockdef)
          throw new Error(path + "(" + (j + 1) + ") - Fatal: Cannot nest #begindef");

        blockdefdata = [];
        blockdef = m[3].trim();
        break;
      case "enddef":
        if (!blockdef)
          throw new Error(path + "(" + (j + 1) + ") - Fatal: #enddef without #begindef");

        // Let's store our blockdef
        let blockdefd = blockdefdata.join("\n");
        
        if (devMode) {
          if (defines[blockdef] !== blockdefd)
            console.log(path + "(" + (j + 1) + ") - WARNING differently defining Block `" + blockdef + "`");
          else
            console.log(path + "(" + (j + 1) + ") - Defining Block: `" + blockdef + "`");
        }

        defines[blockdef] = blockdefd;
        blockdef = "";
        break;
      case "ifdef":
      case "ifndef":
        level++; // elseif is similar case to ifdef/ ifndef
      case "elseif":
        res = check(m[3], defines);
        if ((m[2] == "ifndef" ? res : !res)) {
          nowrite = level;
          if (devMode)
            console.log(path + "(" + (j + 1) + ") - Ignoring code by `" + m[2] + "` `" + m[3] + "`");
        } else {
          if (level == nowrite)
            nowrite = -1;
          ifMatched = true;
        }
        break;
      case "endif":
        if (level == nowrite)
          nowrite = -1;
        level--; // inside or outside??
        ifMatched = false;

        if (level < 0)
          throw new Error(path + "(" + (j + 1) + ") - Fatal: #endif missing #ifdef/ifndef " + level);
        break;
      case "define":
        if (nowrite == -1) {
          let def = m[3].split(" ");
          let name = def[0].trim();
          if (!defines[name]) {
            let val = def.slice(1).join(" ")
            if (devMode)
              console.log(path + "(" + (j + 1) + ") - Defining `" + name + "` as `" + val + "`");
            defines[name] = val;
          }
        }
        break;
      case "undef":
        if (nowrite == -1) {
          let name = name.trim();
          if (devMode)
            console.log(path + "(" + (j + 1) + ") - Undefining `" + name + "`");
          delete defines[name];
        }
        break;
      case "else":
        if (nowrite == -1)
          nowrite = level;
        else if (level == nowrite && !ifMatched)
          nowrite = -1;
        break;
    }
  }

  if (blockdef)
    throw new Error(path + "(" + (j + 1) + ") - Fatal: #begindef without #enddef");

  if (level > 0)
    throw new Error(path + "(" + (j + 1) + ") - Fatal: #ifdef/#ifndef without #endif " + level);

  return output.join("\n");
};
