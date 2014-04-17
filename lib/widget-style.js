/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
"use strict";

const {Iterator, escapeRegExp} = require("./utils");
const {parse: parseDefines} = require("./defines");
const {data} = require("sdk/self");
const {loadSheet} = require("sdk/stylesheet/utils");

const kAssets = {
  "toolbarButtonsGlyph": "soundcloud-player.png",
  "toolbarButtonsGlyph2x": "soundcloud-player@2x.png"
};

function getGlobalDefines() {
  let defines = {};
  for (let [name, filename] of Iterator(kAssets))
    defines[name] = data.url("./" + filename);
  return defines;
}

function parseSheet(sheet, buttons, defines) {
  // First, parse all the ifdef-blocks that may remove code we needn't process later.
  sheet = parseDefines(sheet, defines);

  // Replace the button-ids in the stylesheet with the _real_ ones with the unique
  // jid-blah prefixes.
  let buttonIds = {};
  for (let button of buttons)
    buttonIds[button.id] = button.realID;
  let re = "#(" + Object.keys(buttonIds).map(id => escapeRegExp(id)).join("|") + ")";
  sheet = sheet.replace(new RegExp(re, "gim"), function(m, id) {
    return "#" + buttonIds[id];
  });

  // Find & replace the variables used in the stylesheet.
  re = "@(" + Object.keys(defines).map(id => escapeRegExp(id)).join("|") + ")@";
  return sheet.replace(new RegExp(re, "gm"), function(m, name) {
    return defines[name];
  });
}

exports.load = function(document, buttons) {
  let defines = getGlobalDefines();
  let sheet = data.load("./style.css");
  let uri = "data:text/css;charset=utf-8," +
            encodeURIComponent(parseSheet(sheet, buttons, defines));

  loadSheet(document.defaultView, uri);
};
