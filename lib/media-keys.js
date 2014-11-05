/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
"use strict";

const Prefs = require("sdk/simple-prefs");
const {OS} = require("sdk/system/runtime");
const {windows: getWindows, isBrowser} = require("sdk/window/utils");
const Player = require("./player");
const AppleRemote = require("./apple-remote").createInstance();
const OSXMediaKeys = require("./osx-media-keys").createInstance();
const {increaseVolume, decreaseVolume} = require("./osx-system-volume");

let Switches = {
  AppleRemote: {
    start: function() {
      if (!AppleRemote)
        return;

      // Listening to the Apple Remote means that the up / down buttons are
      // disabled, too, so they don't control the system volume anymore.
      // But we still want them to do that, so we reimplement it here.
      this._buttonpress = e => {
        if (e.button == e.kRemoteButtonPlus)
          increaseVolume();
        else if (e.button == e.kRemoteButtonMinus)
          decreaseVolume();
      };
      this._buttondown = e => {
        if (!Prefs.prefs.useRemoteControl || Player.getPlayState() == Player.STATE_DISABLED)
          return;

        if (e.button == e.kRemoteButtonPlay)
          Player.onPlayCommand(e);
        else if (e.button == e.kRemoteButtonRight)
          Player.onNextCommand(e)
        else if (e.button == e.kRemoteButtonLeft)
          Player.onPreviousCommand(e);
      }

      AppleRemote.on("buttonpress", this._buttonpress);
      AppleRemote.on("buttondown", this._buttondown);

      AppleRemote.startListening();
    },
    stop: function() {
      if (!AppleRemote)
        return;

      AppleRemote.stopListening();

      if (this._buttonpress) {
        AppleRemote.off(this._buttonpress);
        delete this._buttonpress;
      }
      if (this._buttondown) {
        AppleRemote.off(this._buttondown);
        delete this._buttondown;
      }
    }
  },
  OSXMediaKeys: {
    start: function() {
      if (!OSXMediaKeys)
        return;

      this._listener = e => {
        if (!Prefs.prefs.useMediaKeys || Player.getPlayState() == Player.STATE_DISABLED)
          return;

        if (e.keyCode == e.kMediaKeyPlay)
          Player.onPlayCommand(e);
        else if (e.keyCode == e.kMediaKeyFast)
          Player.onNextCommand(e)
        else if (e.keyCode == e.kMediaKeyRewind)
          Player.onPreviousCommand(e);
      };

      OSXMediaKeys.on("keydown", this._listener);

      OSXMediaKeys.startListening();
    },
    stop: function() {
      if (!OSXMediaKeys)
        return;

      OSXMediaKeys.stopListening();

      if (!this._listener)
        return;

      OSXMediaKeys.off("keydown", this._listener);
      delete this._listener;
    }
  },
  WinMediaKeys: {
    start: function() {
      if (OS != "WINNT")
        return;

      this._listener = e => {
        switch (e.command) {
          case "PlayPause":
            Player.onPlayCommand(e);
            break;
          case "PreviousTrack":
            Player.onPreviousCommand(e);
            break;
          case "NextTrack":
            Player.onNextCommand(e);
            break;
          case "MediaStop":
            Player.onStopCommand(e);
            break;
        }

        e.stopPropagation();
        e.preventDefault();
      };

      for (let window of getWindows()) {
        if (!isBrowser(window))
          continue;

        window.addEventListener("AppCommand", this._listener, true);
      }
    },
    stop: function() {
      if (OS != "WINNT" || !this._listener)
        return;

      for (let window of getWindows()) {
        if (!isBrowser(window))
          continue;

        window.removeEventListener("AppCommand", this._listener, true);
      }
    }
  }
};

require("sdk/system/unload").when(() => {
  if (AppleRemote)
    AppleRemote.shutdown();
  if (OSXMediaKeys)
    OSXMediaKeys.shutdown();
  Switches.AppleRemote.stop();
  Switches.OSXMediaKeys.stop();
  Switches.WinMediaKeys.stop();
});

exports.startListening = function() {
  if (Prefs.prefs.useRemoteControl)
    Switches.AppleRemote.start();

  if (Prefs.prefs.useMediaKeys) {
    Switches.OSXMediaKeys.start();
    Switches.WinMediaKeys.start();
  }

  Prefs.on("useRemoteControl", () => {
    Switches.AppleRemote[Prefs.prefs.useRemoteControl ? "start" : "stop"]();
  });
  Prefs.on("useMediaKeys", () => {
    Switches.OSXMediaKeys[Prefs.prefs.useMediaKeys ? "start" : "stop"]();
    Switches.WinMediaKeys[Prefs.prefs.useMediaKeys ? "start" : "stop"]();
  });
};
