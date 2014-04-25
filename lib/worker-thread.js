/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
"use strict";

const {Cu} = require("chrome");
const workerThreadModuleURL = require("sdk/self").data.url("WorkerThread.jsm");
const workerThreadModule = Cu.import(workerThreadModuleURL);

require("sdk/system/unload").when(function () {
  Cu.unload(workerThreadModuleURL);
});

exports.createWorker = function createWorker(url) {
  return workerThreadModule.createWorker(url);
};

exports.createChromeWorker = function createChromeWorker(url) {
  return workerThreadModule.createChromeWorker(url);
};
