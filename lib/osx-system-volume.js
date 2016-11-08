/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
"use strict";

const {OS} = require("sdk/system/runtime");
const {runCommand} = require("./command-runner");

function runAppleScript(script) {
  if (OS != "Darwin")
    return;

  runCommand("osascript" + script.split("\n").map(function (line) {
    return " -e '" + line.replace(/'/g, '\\\'') + "'";
  }).join(""));
}

function changeVolumeBy(delta) {
  runAppleScript(
    'set oldVolume to output volume of (get volume settings)\n' +
    'set volume output volume (oldVolume + ' + delta + ')\n' +
    'set newVolume to output volume of (get volume settings)\n' +
    'if (newVolume is not equal to oldVolume) then\n' +
    '  do shell script "afplay /System/Library/LoginPlugins/BezelServices.loginPlugin/Contents/Resources/volume.aiff > /dev/null 2>&1 &"\n' +
    'end if'
  );
}

exports.increaseVolume = function() {
  changeVolumeBy(100 / 16);
};

exports.decreaseVolume = function() {
  changeVolumeBy(-100 / 16);
};
