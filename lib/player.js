/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
"use strict";

const Windows = require("sdk/windows");
const {Tab} = require("sdk/tabs/tab");
const Tabs = require("sdk/tabs");
const TabUtils = require("sdk/tabs/utils");
const {setImmediate, setTimeout, setInterval, clearInterval} = require("sdk/timers");
const {get: _} = require("sdk/l10n");
const {viewFor} = require("sdk/view/core");

const kSoundCloudURI = "https://soundcloud.com/";
const kSoundCloudRE = /^https?:\/\/soundcloud\.com\//;
const kSelectorPlay = ".playControl";
const kSelectorSkip = ".skipControl";
const kSelectorTitle = ".playbackSoundBadge__title"

const kNSXUL = "http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul";

const STATE_PLAYING = exports.STATE_PLAYING = "playing";
const STATE_PAUSED = exports.STATE_PAUSED = "paused";
const STATE_DISABLED = exports.STATE_DISABLED = "disabled";

let gWidgetID = null;
let gCustomizableUI = null;
let gSoundCloudTab = null;

const getSoundCloudTab = function() {
  let {activeWindow} = Windows.browserWindows;
  if (activeWindow) {
    let activeTab = activeWindow.tabs.activeTab;
    if (!viewFor(activeTab).hasAttribute("pending") && kSoundCloudRE.test(activeTab.url || ""))
      return setActiveTab(activeTab);
  }

  let foundTab = null;
  for (let window of Windows.browserWindows) {
    for (let tab of window.tabs) {
      if (viewFor(tab).hasAttribute("pending") || !kSoundCloudRE.test(tab.url || ""))
        continue;
      foundTab = tab;
      break;
    }
    if (foundTab)
      break;
  }

  if (!foundTab)
    return;

  return setActiveTab(foundTab);
};

const setActiveTab = function(tab) {
  if (tab != gSoundCloudTab)
    removeTabListeners(gSoundCloudTab);
  gSoundCloudTab = tab;
  addTabListeners(tab);
  return tab;
};

const addTabListeners = function(tab) {
  if (!tab || tab._sc_close)
    return;
  tab._sc_close = () => {
    setActiveTab(null);
    setImmediate(exports.setState);
  }
  tab._sc_load = () => setImmediate(exports.setState);
  tab.on("close", tab._sc_close);
  tab.on("load", tab._sc_load);

  let worker = tab._sc_worker = tab.attach({
    contentScriptOptions: {
      STATE_DISABLED, STATE_PAUSED, STATE_PLAYING,
      kSelectorPlay, kSelectorTitle
    },
    contentScript: `
const {STATE_DISABLED, STATE_PAUSED, STATE_PLAYING, kSelectorPlay, kSelectorTitle} = self.options;
const kPollIntervalMs = 1000;
let gPollTimer, gState = {};

function readState() {
  let button = window.document.querySelector(self.options.kSelectorPlay);
  let state =  !button ? STATE_DISABLED : button.classList.contains("playing") ?
    STATE_PLAYING : STATE_PAUSED;
  if (state != gState.playstate) {
    gState.playstate = state;
    self.port.emit("playstatechange", { state });
  }

  let titleNode = window.document.querySelector(self.options.kSelectorTitle);
  let title = titleNode && titleNode.hasAttribute("title") ? titleNode.getAttribute("title") : null;
  if (title != gState.title) {
    gState.title = title;
    self.port.emit("trackchange", { state: gState.playstate, title });
  }
}

gPollTimer = setInterval(readState, kPollIntervalMs);

self.port.on("detach", function() {
  clearInterval(gPollTimer);
  window.close();
});`
  });

  worker.port.on("playstatechange", message => exports.setState(message.state));
  worker.port.on("trackchange", ({ state, title }) => exports.setState(state, title));
};

const removeTabListeners = function(tab) {
  if (!tab || !tab._sc_close)
    return;

  tab.off("close", tab._sc_close);
  tab.off("load", tab._sc_load);
  tab._sc_worker.destroy();
  tab._sc_close = tab._sc_load = tab._sc_worker = null;
};

const clickSkipControl = function(dir = "previous") {
  let tab = getSoundCloudTab();
  if (!tab)
    return;

  tab.attach({
    contentScriptOptions: { kSelectorSkip, dir },
    contentScript: `
let buttons = window.document.querySelectorAll(self.options.kSelectorSkip);
for (let i = buttons.length - 1; i >= 0; --i) {
  if (buttons[i].className.indexOf(self.options.dir) === -1)
    continue;
  buttons[i].click();
  break;
}`
  });
};

const clickPlayButton = function() {
  let tab = getSoundCloudTab();
  if (!tab)
    return;

  tab.attach({
    contentScriptOptions: { kSelectorPlay },
    contentScript: `
let button = window.document.querySelector(self.options.kSelectorPlay);
if (button)
  button.click();`
  })
};

exports.initialize = function(widgetID, customizableUI) {
  if (gWidgetID)
    return;

  gWidgetID = widgetID;
  gCustomizableUI = customizableUI;

  setImmediate(exports.setState);
};

exports.onPreviousCommand = function(e) {
  clickSkipControl();
};

exports.onPlayCommand = function(e) {
  exports.getPlayState().then(state => {
    if (state == STATE_DISABLED) {
      if (!getSoundCloudTab()) {
        // Try to open a new tab with SoundCloud.com in it...
        Tabs.open({
          url: kSoundCloudURI,
          onOpen: tab => gSoundCloudTab = tab,
          onLoad: () => addTabListeners(gSoundCloudTab)
        });
      }
      return exports.setState(STATE_DISABLED);
    }

    clickPlayButton();
    // Clicking the button is a toggle action, so the state will toggle here as well.
    exports.setState(state == STATE_PLAYING ? STATE_PAUSED : STATE_PLAYING);
  });
};

exports.onStopCommand = function(e) {
  exports.getPlayState().then(state => {
    if (state != STATE_PLAYING)
      return;

    clickPlayButton();
    // Clicking the button is a toggle action, so the state will toggle here as well.
    exports.setState(STATE_PAUSED);
  });
};

exports.onNextCommand = function(e) {
  clickSkipControl("next");
};

const setPlayButtonLabel = function(playButton, state, sound) {
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

  function gotCurrentSound() {
    if (!sound)
      sound = _("current-track");

    playButton.setAttribute("label", _(state == STATE_PLAYING ? pauseLabel :
      playLabel, sound));
    playButton.setAttribute("tooltiptext", _(state == STATE_PLAYING ? pauseTooltip :
      playTooltip, sound));
  }

  if (!sound) {
    exports.getCurrentSound().then(newTitle => {
      sound = newTitle;
      gotCurrentSound();
    });
  } else
    gotCurrentSound();
};

exports.setState = function(state, sound) {
  if (!state) {
    exports.getPlayState().then(state => exports.setState(state));
    return;
  }

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
    setPlayButtonLabel(playButton, state, sound);
  }
};

exports.getPlayState = function() {
  return new Promise(resolve => {
    let tab = getSoundCloudTab();
    if (!tab) {
      resolve(STATE_DISABLED);
      return;
    }

    let worker = tab.attach({
      contentScriptOptions: {
        STATE_DISABLED, STATE_PAUSED, STATE_PLAYING, kSelectorPlay
      },
      contentScript: `
let button = window.document.querySelector(self.options.kSelectorPlay);
self.port.emit("result", {
  state: !button ? self.options.STATE_DISABLED : button.classList.contains("playing") ?
    self.options.STATE_PLAYING : self.options.STATE_PAUSED
});`
    });
    worker.port.on("result", message => resolve(message.state));
  });
};

exports.getCurrentSound = function(playButton) {
  return new Promise(resolve => {
    let tab = getSoundCloudTab();
    if (!tab) {
      resolve(null);
      return;
    }

    let worker = tab.attach({
      contentScriptOptions: { kSelectorTitle },
      contentScript: `
let titleNode = window.document.querySelector(self.options.kSelectorTitle);
self.port.emit("result", titleNode && titleNode.hasAttribute("title") ? titleNode.getAttribute("title") : null);`
    });
    worker.port.on("result", resolve);
  });
};
