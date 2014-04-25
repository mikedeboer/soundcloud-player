/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
"use strict";

/**
 * Usage:
 * 
 * var osxMediaKeysModule = require("osx-media-keys");
 * var osxMediaKeys = osxMediaKeysModule.createInstance();
 * osxMediaKeys.on("keydown", function (event) {
 *   dump("keydown: " + event.keyCode + "\n");
 *   if (event.keyCode == event.kMediaKeyPlay)
 *     dump("Start / Stop\n");
 * });
 *
 * osxMediaKeys.startListening();
 * osxMediaKeys.stopListening();
 * osxMediaKeys.shutdown();
 */

const {data} = require("sdk/self");
const {Class} = require("sdk/core/heritage");
const {emit} = require("sdk/event/core");
const {EventTarget} = require("sdk/event/target");
const {OS} = require("sdk/system/runtime");
const {toFilename} = require("sdk/url");
const {createChromeWorker} = require("./worker-thread");

function OSXMediaKeysButtonEvent(type, keyCode) {
  this.type = type;
  this.keyCode = keyCode;
}

OSXMediaKeysButtonEvent.prototype = {
  // see ev_keymap.h
  // There are different constants for "Next" and "Fast" resp.
  // "Previous" and "Rewind", but on all Apple keyboards I've
  // seen they're the same key, and their keycode is the
  // Fast/Rewind one.
  kMediaKeyPlay:     16, //   >
  kMediaKeyNext:     17, //  >>|
  kMediaKeyPrevious: 18, //  |<<
  kMediaKeyFast:     19, //  >>
  kMediaKeyRewind:   20  //   <<
};

const OSXMediaKeys = Class({
  implements: [EventTarget],

  _worker: null,
  initialize: function() {
    EventTarget.prototype.initialize.call(this);

    let libPath = toFilename(data.url("./libOSXMediaKeysThreadedCWrapper.dylib"));
    this._worker = createChromeWorker(data.url("./OSXMediaKeysControllerWorker.js"));
    this._worker.postMessage({
      fun: "init",
      arg: libPath
    });

    this._worker.addEventListener("message", msg => {
      let {type, keyCode} = msg.data;
      let event = new OSXMediaKeysButtonEvent(type, keyCode);
      emit(this, type, event);
    });
  },

  startListening: function OSXMediaKeys_startListening() {
    this._worker.postMessage({fun: "startListening"});
  },

  stopListening: function OSXMediaKeys_stopListening() {
    this._worker.postMessage({fun: "stopListening"});
  },

  shutdown: function OSXMediaKeys_shutdown() {
    this._worker.postMessage({fun: "shutdown"});
  }
});

exports.createInstance = function() {
  if (OS != "Darwin")
    return null;

  return OSXMediaKeys();
};
