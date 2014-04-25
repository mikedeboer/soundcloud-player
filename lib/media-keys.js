/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
"use strict";

const Prefs = require("sdk/simple-prefs");
const Player = require("./player");
const AppleRemote = require("./apple-remote").createInstance();
const OSXMediaKeys = require("./osx-media-keys").createInstance();
const {increaseVolume, decreaseVolume} = require("./osx-system-volume");

const Switches = {
  AppleRemote: {
    listen: function() {
      if (!AppleRemote)
        return;

      // Listening to the Apple Remote means that the up / down buttons are
      // disabled, too, so they don't control the system volume anymore.
      // But we still want them to do that, so we reimplement it here.
      AppleRemote.on("buttonpress", function(e) {
        if (e.button == e.kRemoteButtonPlus)
          increaseVolume();
        else if (e.button == e.kRemoteButtonMinus)
          decreaseVolume();
      });

      AppleRemote.on("buttondown", e => {
        if (!Prefs.prefs.useRemoteControl || Player.getPlayState() == Player.STATE_DISABLED)
          return;

        if (e.button == e.kRemoteButtonPlay)
          Player.onPlayCommand(e);
        else if (e.button == e.kRemoteButtonRight)
          Player.onNextCommand(e)
        else if (e.button == e.kRemoteButtonLeft)
          Player.onPreviousCommand(e);
      });
    },
    start: function() {
      if (!AppleRemote)
        return;

      AppleRemote.startListening();
    },
    stop: function() {
      if (!AppleRemote)
        return;

      AppleRemote.stopListening();
    }
  },
  OSXMediaKeys: {
    listen: function() {
      if (!OSXMediaKeys)
        return;

      OSXMediaKeys.on("keydown", e => {
        if (!Prefs.prefs.useMediaKeys || Player.getPlayState() == Player.STATE_DISABLED)
          return;

        if (e.keyCode == e.kMediaKeyPlay)
          Player.onPlayCommand(e);
        else if (e.keyCode == e.kMediaKeyFast)
          Player.onNextCommand(e)
        else if (e.keyCode == e.kMediaKeyRewind)
          Player.onPreviousCommand(e);
      });
    },
    start: function() {
      if (!OSXMediaKeys)
        return;

      OSXMediaKeys.startListening();
    },
    stop: function() {
      if (!OSXMediaKeys)
        return;

      OSXMediaKeys.stopListening();
    }
  }
};

require("sdk/system/unload").when(() => {
  if (AppleRemote)
    AppleRemote.shutdown();
  if (OSXMediaKeys)
    OSXMediaKeys.shutdown();
});

exports.startListening = function() {
  Switches.AppleRemote.listen();
  Switches.AppleRemote.start();
  Switches.OSXMediaKeys.listen();
  Switches.OSXMediaKeys.start();

  Prefs.on("useRemoteControl", () => {
    Switches.AppleRemote[Prefs.prefs.useRemoteControl ? "start" : "stop"]();
  });
  Prefs.on("useMediaKeys", () => {
    Switches.OSXMediaKeys[Prefs.prefs.useMediaKeys ? "start" : "stop"]();
  });
};
