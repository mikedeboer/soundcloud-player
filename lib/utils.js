/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
"use strict";

exports.Iterator = function Iterator(obj) {
  for (let key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key))
      yield [key, obj[key]];
  }
};

exports.escapeRegExp = function(str) {
  return str.replace(/([.*+?\^${}()|\[\]\/\\])/g, "\\$1");
};
