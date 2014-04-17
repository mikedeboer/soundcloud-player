/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
"use strict";

const {Cu} = require("chrome");


const {id: kAddonID, data: Data} = require("sdk/self");
const {get: _} = require("sdk/l10n");
const {CustomizableUI} = Cu.import("resource:///modules/CustomizableUI.jsm", {});
const {Iterator} = require("./utils");
const Player = require("./player");

const kNSXUL = "http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul";
const kWidePanelItemClass = "panel-wide-item";
const kButtonPrefix = "button--" + kAddonID.toLowerCase().replace(/[^a-z0-9-_]/g, "");
const kWidgetID = kButtonPrefix + "-soundcloud-player";

const toButtonID = id => kWidgetID + "-" + id;

function setAttributes(node, attrs) {
  let doc = node.ownerDocument;
  for (let [name, value] of Iterator(attrs)) {
    if (!value) {
      if (node.hasAttribute(name))
        node.removeAttribute(name);
    } else {
      if (name == "shortcutId" || name == "oncommand" || name == "realID")
        continue;

      if (name == "label" || name == "tooltiptext" || name == "altlabel" || name == "alttooltiptext") {
        let id = attrs.id;
        // Support alternate values
        if (name.startsWith("alt")) {
          id = value;
          value = null;
        }
        let stringId = (typeof value == "string") ? value : name.replace(/^alt/, "");
        let additionalArgs = [];
        if (attrs.shortcutId) {
          let shortcut = doc.getElementById(attrs.shortcutId);
          if (shortcut)
            additionalArgs.push(ShortcutUtils.prettifyShortcut(shortcut));
        }
        value = _(id + "." + stringId, additionalArgs);
      } else if (name == "id") {
        value = attrs.realID;
      }
      node.setAttribute(name, value);
    }
  }
}

function updateCombinedWidgetStyle(node, area, modifyCloseMenu) {
  let inPanel = (area == CustomizableUI.AREA_PANEL);
  let cls = inPanel ? "panel-combined-button" : "toolbarbutton-1 toolbarbutton-combined";
  let attrs = {class: cls};
  if (modifyCloseMenu) {
    attrs.closemenu = inPanel ? "none" : null;
  }
  attrs["cui-areatype"] = area ? CustomizableUI.getAreaType(area) : null;
  for (let i = 0, l = node.childNodes.length; i < l; ++i) {
    if (node.childNodes[i].localName == "separator")
      continue;
    setAttributes(node.childNodes[i], attrs);
  }
}

exports.create = function() {
  CustomizableUI.createWidget({
    id: kWidgetID,
    type: "custom",
    defaultArea: CustomizableUI.AREA_NAVBAR,
    onBuild: function(document) {
      let buttons = [{
        id: "prev-button",
        oncommand: Player.onPreviousCommand,
        label: true,
        tooltiptext: true,
        disabled: true
      }, {
        id: "play-button",
        oncommand: Player.onPlayCommand,
        label: true,
        tooltiptext: true,
        altlabel: "pause-button",
        alttooltiptext: "pause-button"
      }, {
        id: "next-button",
        oncommand: Player.onNextCommand,
        label: true,
        tooltiptext: true,
        disabled: true
      }];

      // Store the computed ID for convenience.
      for (let button of buttons)
        button.realID = toButtonID(button.id);

      let node = document.createElementNS(kNSXUL, "toolbaritem");
      node.setAttribute("id", kWidgetID);
      node.setAttribute("label", _("label"));
      node.setAttribute("title", _("tooltiptext"));
      // Set this as an attribute in addition to the property to make sure we can
      // style correctly.
      node.setAttribute("removable", "true");
      node.classList.add("chromeclass-toolbar-additional");
      node.classList.add("toolbaritem-combined-buttons");
      node.classList.add(kWidePanelItemClass);

      buttons.forEach(function(button, idx) {
        if (idx != 0)
          node.appendChild(document.createElementNS(kNSXUL, "separator"));
        let btnNode = document.createElementNS(kNSXUL, "toolbarbutton");
        setAttributes(btnNode, button);

        node.appendChild(btnNode);
        if (button.oncommand) {
          node.addEventListener("command", function(e) {
            button.oncommand(e);
          }, false);
        }
      });

      updateCombinedWidgetStyle(node, this.currentArea);

      let listener = {
        onWidgetAdded: (widgetId, area, position) => {
          if (widgetId != this.id)
            return;
          updateCombinedWidgetStyle(node, area);
        },

        onWidgetRemoved: (widgetId, prevArea) => {
          if (widgetId != this.id)
            return;
          // When a widget is demoted to the palette ('removed'), it's visual
          // style should change.
          updateCombinedWidgetStyle(node);
        },

        onWidgetReset: (widgetNode) => {
          if (widgetNode != node)
            return;
          updateCombinedWidgetStyle(node, this.currentArea);
        },

        onWidgetMoved: (widgetId, area) => {
          if (widgetId != this.id)
            return;
          updateCombinedWidgetStyle(node, area);
        },

        onWidgetInstanceRemoved: (widgetId, doc) => {
          if (widgetId != this.id || doc != document)
            return;
          CustomizableUI.removeListener(listener);
        },

        onWidgetDrag: (widgetId, area) => {
          if (widgetId != this.id)
            return;
          area = area || this.currentArea;
          updateCombinedWidgetStyle(node, area);
        }
      };
      CustomizableUI.addListener(listener);

      buttons.push({
        id: "soundcloud-player",
        realID: kWidgetID
      });
      require("./widget-style").load(document, buttons);

      Player.initialize(this.id, CustomizableUI);

      return node;
    }
  });
};
