/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
"use strict";

const {windows: getWindows, isBrowser} = require("sdk/window/utils");
const TabUtils = require("sdk/tabs/utils");
const {setImmediate, setTimeout, setInterval, clearInterval} = require("sdk/timers");
const {get: _} = require("sdk/l10n");

const kSoundCloudURI = "https://soundcloud.com/";
const kSoundCloudRE = /^https?:\/\/soundcloud\.com\//;

const kNSXUL = "http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul";

const STATE_PLAYING = exports.STATE_PLAYING = "playing";
const STATE_PAUSED = exports.STATE_PAUSED = "paused";
const STATE_DISABLED = exports.STATE_DISABLED = "disabled";

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
    if (!isBrowser(window))
      continue;
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
};

const addTabListeners = function(tab) {
  if (!tab)
    return;
  let window = getSoundCloudContentWindow(tab);
  if (!window)
    return;

  tab.parentNode.addEventListener("TabClose", function tabClose(e) {
    if (e.target != tab)
      return;

    tab.parentNode.removeEventListener("TabClose", tabClose);
    gSoundCloudTab = null;
  }, false);

  if (!window.require) {
    waitFor(() => window.require && window.document.querySelector(".playControl"), () => {
      addSoundCloudListeners(window);
      setTimeout(() => {
        exports.setState();
        exports.onPlayCommand();
      }, 1000);
    });
  } else {
    addSoundCloudListeners(window);
  }
};

const addSoundCloudListeners = function(window) {
  window.document.addEventListener("load", function onLoad(e) {
    setImmediate(exports.setState);
  }, false);

  let sc_req = window.require;
  let eventBus = sc_req("event-bus");
  eventBus.on("audio:play", function() {
    setImmediate(() => exports.setState(STATE_PLAYING));
  });
  eventBus.on("audio:pause", function() {
    setImmediate(() => exports.setState(STATE_PAUSED));
  });
};

const getSoundCloudContentWindow = function(tab) {
  tab = tab || getSoundCloudTab();
  if (!tab)
    return null;

  return TabUtils.getBrowserForTab(tab).contentWindow.wrappedJSObject;
};

const getPlayButton = function() {
  let window = getSoundCloudContentWindow();
  if (!window)
    return null;

  return window.document.querySelector(".playControl") || null;
};

const getSkipControl = function(dir = "previous") {
  let window = getSoundCloudContentWindow();
  if (!window)
    return null;

  let buttons = window.document.querySelectorAll(".skipControl");
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

  setImmediate(exports.setState);
};

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

exports.onStopCommand = function(e) {
  let state = exports.getPlayState(playButton);
  if (state != STATE_PLAYING)
    return;

  let playButton = getPlayButton();
  playButton.click();
  // Clicking the button is a toggle action, so the state will toggle here as well.
  exports.setState(STATE_PAUSED, playButton);
};

exports.onNextCommand = function(e) {
  let button = getSkipControl("next");
  if (!button)
    return;

  button.click();
};

const setPlayButtonLabel = function(playButton, state) {
  let pauseLabel = playButton.getAttribute("altlabel");
  if (!pauseLabel)
    return;

  let pauseTooltip = playButton.getAttribute("alttooltiptext");
  let playLabel = playButton.getAttribute("origlabel");
  let playTooltip = playButton.getAttribute("origtooltiptext");
  if (!playLabel) {
    playLabel = playButton.getAttribute("label");
    playButton.setAttribute("origlabel", playLabel);
    playTooltip = playButton.getAttribute("tooltiptext");
    playButton.setAttribute("origtooltiptext", playTooltip);
  }

  let currentSound = _("current-track");
  let sound = exports.getCurrentSound();
  if (sound)
    currentSound = _("playing-track", sound.artist, sound.title);

  playButton.setAttribute("label", _(state == STATE_PLAYING ? pauseLabel : playLabel, currentSound));
  playButton.setAttribute("tooltiptext", _(state == STATE_PLAYING ? pauseTooltip : playTooltip, currentSound));
};

exports.setState = function(state) {
  if (!state)
    state = exports.getPlayState();

  let playerNodes = gCustomizableUI.getWidget(gWidgetID).instances.map(instance => instance.node);
  for (let node of playerNodes) {
    let buttons = node.getElementsByTagNameNS(kNSXUL, "toolbarbutton");
    let playButton = buttons.item(1);
    switch (state) {
      case STATE_PAUSED:
      case STATE_PLAYING:
        playButton.setAttribute("state", state);
        buttons.item(0).removeAttribute("disabled");
        buttons.item(2).removeAttribute("disabled");
        break;
      case STATE_DISABLED:
        playButton.setAttribute("state", STATE_PAUSED);
        buttons.item(0).setAttribute("disabled", "true");
        buttons.item(2).setAttribute("disabled", "true");
        break;
    }
    setPlayButtonLabel(playButton, state);
  }
};

exports.getPlayState = function(playButton) {
  playButton = playButton || getPlayButton();
  if (!playButton)
    return STATE_DISABLED;

  return playButton.classList.contains("playing") ? STATE_PLAYING : STATE_PAUSED;
};

exports.getCurrentSound = function(playButton) {
  playButton = playButton || getPlayButton();
  if (!playButton)
    return null;

  try {
    let window = playButton.ownerDocument.defaultView;
    let sc_req = window.require;
    let o = sc_req("lib/play-manager").getCurrentSound();
    if (o) {
      return {
        artist: o.attributes.user.username,
        title: o.attributes.title
      };
    }
  } catch (ex) {}

  return null;
};
