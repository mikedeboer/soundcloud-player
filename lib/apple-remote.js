/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
"use strict";

/**
 * Usage:
 * 
 * var appleRemoteModule = require("apple-remote");
 * var appleRemote = appleRemoteModule.createInstance();
 * appleRemote.on("buttondown", function (event) {
 *   dump("buttondown: " + event.button + "\n");
 *   if (event.button == event.kRemoteButtonPlay)
 *     dump("Start / Stop\n");
 * });
 * appleRemote.on("buttonpress", function (event) {
 *   dump("buttonpress: " + event.button + "\n");
 *   if (event.button == event.kRemoteButtonPlus)
 *     osxSystemVolume.increaseVolume();
 *   else if (event.button == event.kRemoteButtonMinus)
 *     osxSystemVolume.decreaseVolume();
 * });
 * appleRemote.on("buttonup", function (event) {
 *   dump("buttonup: " + event.button + "\n");
 * });
 *
 * appleRemote.startListening();
 * appleRemote.stopListening();
 * appleRemote.shutdown();
 */

const {data} = require("sdk/self");
const {Class} = require("sdk/core/heritage");
const {emit} = require("sdk/event/core");
const {EventTarget} = require("sdk/event/target");
const {OS} = require("sdk/system/runtime");
const {toFilename, URL} = require("sdk/url");
const {createChromeWorker} = require("./worker-thread");

function AppleRemoteButtonEvent(type, button) {
  this.type = type;
  this.button = button;
}

AppleRemoteButtonEvent.prototype = {
  // normal events
  kRemoteButtonPlus:       1<<1,
  kRemoteButtonMinus:      1<<2,
  kRemoteButtonMenu:       1<<3,
  kRemoteButtonPlay:       1<<4,
  kRemoteButtonRight:      1<<5,
  kRemoteButtonLeft:       1<<6,

  // hold events
  kRemoteButtonPlus_Hold:  1<<7,
  kRemoteButtonMinus_Hold: 1<<8,
  kRemoteButtonMenu_Hold:  1<<9,
  kRemoteButtonPlay_Hold:  1<<10,
  kRemoteButtonRight_Hold: 1<<11,
  kRemoteButtonLeft_Hold:  1<<12,

  // special events (not supported by all devices)
  kRemoteControl_Switched: 1<<13
};


const AppleRemote = Class({
  implements: [EventTarget],

  _worker: null,
  initialize: function() {
    EventTarget.prototype.initialize.call(this);

    let libPath = toFilename(data.url("libAppleRemoteThreadedCWrapper.dylib"));
    this._worker = createChromeWorker(data.url("AppleRemoteControllerWorker.js"));
    this._worker.postMessage({
      fun: "init",
      arg: libPath
    });

    this._worker.addEventListener("message", msg => {
      let {type, button} = msg.data;
      let event = new AppleRemoteButtonEvent(type, button);
      emit(this, type, event);
    });
  },

  startListening: function() {
    this._worker.postMessage({fun: "startListening"});
  },

  stopListening: function() {
    this._worker.postMessage({fun: "stopListening"});
  },

  shutdown: function() {
    this._worker.postMessage({fun: "shutdown"});
  }
});

exports.createInstance = function() {
  if (OS != "Darwin")
    return null;

  return AppleRemote();
};
