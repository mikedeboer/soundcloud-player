/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
"use strict";

const {Class} = require("sdk/core/heritage");
const {emit, on, once} = require("sdk/event/core");
const {EventTarget} = require("sdk/event/target");
const {windows: getWindows} = require("sdk/window/utils");
const TabUtils = require("sdk/tabs/utils");
const {setImmediate, setTimeout, setInterval, clearInterval} = require("sdk/timers");

const kSoundCloudURI = "https://soundcloud.com/";
const kSoundCloudRE = /^https?:\/\/soundcloud\.com\//;

const kNSXUL = "http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul";

const STATE_PLAYING = "playing";
const STATE_PAUSED = "paused";
const STATE_DISABLED = "disabled";

let gWidgetID = null;
let gCustomizableUI = null;
let gSoundCloudTab = null;

const waitFor = function(condition, callback) {
  let res = condition();
  if (res)
    return callback(res);

  let intval = setInterval(() => {
    res = condition();
    if (!res)
      return;

    clearInterval(intval);
    callback(res);
  }, 200);
};

const getSoundCloudTab = function() {
  if (gSoundCloudTab)
    return gSoundCloudTab;

  let foundTab = null;
  for (let window of getWindows()) {
    for (let tab of TabUtils.getTabs(window)) {
      if (!kSoundCloudRE.test(TabUtils.getURI(tab)))
        continue;
      foundTab = tab;
      break;
    }
    if (foundTab)
      break;
  }

  gSoundCloudTab = foundTab;
  addTabListeners(foundTab);

  return foundTab;
}

const addTabListeners = function(tab) {
  if (!tab)
    return;
  let window = getSoundCloudContentWindow(tab);
  if (!window)
    return;

  tab.parentNode.addEventListener("TabClose", function tabClose(e) {
    if (e.target != tab)
      return;

    tab.removeEventListener("close", tabClose);
    gSoundCloudTab = null;
  }, false);

  if (!window.require) {
    waitFor(() => window.require && window.$ && window.$(".playControl").length, () => {
        addSoundCloudListeners(window);
        setTimeout(() => {
          exports.setState();
          exports.onPlayCommand();
        }, 1000);
    });
  } else {
    addSoundCloudListeners(window);
  }
}

const addSoundCloudListeners = function(window) {
  window.document.addEventListener("DOMContentLoaded", function onLoad(e) {
    setImmediate(() => exports.setState());
  }, false);

  let sc_req = window.require;
  let eventBus = sc_req("event-bus");
  eventBus.on("audio:play", function() {
    setImmediate(() => exports.setState(STATE_PLAYING));
  });
  eventBus.on("audio:pause", function() {
    setImmediate(() => exports.setState(STATE_PAUSED));
  });
}

const getSoundCloudContentWindow = function(tab) {
  tab = tab || getSoundCloudTab();
  if (!tab)
    return null;

  return TabUtils.getBrowserForTab(tab).contentWindow.wrappedJSObject;
}

const getPlayButton = function() {
  let window = getSoundCloudContentWindow();
  if (!window)
    return null;

  return window.$(".playControl")[0] || null;
};

const getSkipControl = function(dir = "previous") {
  let window = getSoundCloudContentWindow();
  let buttons = window.$(".skipControl");
  for (let i = buttons.length - 1; i >= 0; --i) {
    if (!buttons[i].className.contains(dir))
      continue;
    return buttons[i];
  }

  return null;
};

exports.initialize = function(widgetID, customizableUI) {
  if (gWidgetID)
    return;

  gWidgetID = widgetID;
  gCustomizableUI = customizableUI;

  exports.getPlayState();
};

exports.unitialize = function() {};

exports.onPreviousCommand = function(e) {
  let button = getSkipControl();
  if (!button)
    return;

  button.click();
};

exports.onPlayCommand = function(e) {
  let playButton = getPlayButton();
  let state = exports.getPlayState(playButton);

  if (state == STATE_DISABLED) {
    if (!getSoundCloudTab()) {
      // Try to open a new tab with SoundCloud.com in it...
      let tab = TabUtils.openTab(e.target.ownerDocument.defaultView, kSoundCloudURI);
      addTabListeners(tab);
    }
    return exports.setState(STATE_DISABLED);
  }

  playButton.click();
  // Clicking the button is a toggle action, so the state will toggle here as well.
  exports.setState(state == STATE_PLAYING ? STATE_PAUSED : STATE_PLAYING, playButton);
};

exports.onNextCommand = function(e) {
  let button = getSkipControl("next");
  if (!button)
    return;

  button.click();
};

exports.setState = function(state) {
  if (!state)
    state = exports.getPlayState();

  let playerNodes = gCustomizableUI.getWidget(gWidgetID).instances.map(instance => instance.node);
  for (let node of playerNodes) {
    let buttons = node.getElementsByTagNameNS(kNSXUL, "toolbarbutton");
    switch (state) {
      case STATE_PAUSED:
      case STATE_PLAYING:
        buttons.item(1).setAttribute("state", state);
        buttons.item(0).removeAttribute("disabled");
        buttons.item(2).removeAttribute("disabled");
        break;
      case STATE_DISABLED:
        buttons.item(1).setAttribute("state", STATE_PLAYING);
        buttons.item(0).setAttribute("disabled", "true");
        buttons.item(2).setAttribute("disabled", "true");
        break;
    }
  }
}

exports.getPlayState = function(playButton) {
  playButton = playButton || getPlayButton();
  if (!playButton)
    return STATE_DISABLED;

  return playButton.classList.contains("playing") ? STATE_PLAYING : STATE_PAUSED;
};
