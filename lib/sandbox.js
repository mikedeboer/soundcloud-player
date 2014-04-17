/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

// "use strict";

// var global = this;

exports.eval = function(code, defines) {
  /*
  // Setup environment
  for (var name in defines) {
    global[name] = defines[name];
  }
  // Alias eval to let it have global scope.
  // See http://www.disi.unige.it/person/ZuccaE/FOOL2011/paper13.pdf, $4.1, p9.
  var scopedEval = eval;
  var res = eval(code);
  // Cleanup.
  for (var name in defines) {
    delete global[name];
  }
  return res;*/
  with (defines) {
    return eval(code);
  }
};
