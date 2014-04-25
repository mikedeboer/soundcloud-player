/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
"use strict";

const {data} = require("sdk/self");
const {OS} = require("sdk/system/runtime");
const {createChromeWorker} = require("./worker-thread");

let sWorker = null;
function getWorker() {
  if (!sWorker) {
    sWorker = createChromeWorker(data.url("CmdRunWorker.js"));
    sWorker.postMessage(OS);
  }
  return sWorker;
}

exports.runCommand = function(cmd, callback) {
  let worker = getWorker();
  worker.addEventListener("message", function workerSentMessage(msg) {
    if (msg.data.cmd == cmd) {
      worker.removeEventListener("message", workerSentMessage);
      if (callback)
        callback(msg.data.result);
    }
  });
  worker.postMessage(cmd);
};
