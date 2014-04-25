self.onmessage = function (msg) {
  let fun = msg.data.fun;
  if (fun in self)
    self[fun](msg.data.arg);
}

let lib;
let artcw_create, artcw_start_listening, artcw_stop_listening, artcw_destroy;
let artcw;

function init(libPath) {
  lib = ctypes.open(libPath);

  artcw_create = lib.declare("artcw_create", ctypes.default_abi, ctypes.voidptr_t);
  artcw_start_listening = lib.declare("artcw_start_listening", ctypes.default_abi, ctypes.void_t, ctypes.voidptr_t);
  artcw_stop_listening = lib.declare("artcw_stop_listening", ctypes.default_abi, ctypes.void_t, ctypes.voidptr_t);
  artcw_destroy = lib.declare("artcw_destroy", ctypes.default_abi, ctypes.void_t, ctypes.voidptr_t);

  artcw = artcw_create();
  let artcwAddressAsDecimalString = ctypes.cast(artcw, ctypes.uintptr_t).value.toString();

  if (ctypes.CDataFinalizer) {
    artcw = ctypes.CDataFinalizer(artcw, artcw_destroy);
  }

  listenerWorker = new ChromeWorker("AppleRemoteListenerWorker.js");
  listenerWorker.postMessage({
    artcwAddressAsDecimalString: artcwAddressAsDecimalString,
    libPath: libPath
  });
  listenerWorker.addEventListener("message", function workerSentMessage(msg) {
    let e = {
      type: msg.data.pressedDown ? "buttondown" : "buttonup",
      button: msg.data.type
    };
    self.postMessage(e);
    if (e.type == "buttondown")
      startAutorepeat(e.button);
    else
      stopAutorepeat(e.button);
  });
}

function startListening() {
  artcw_start_listening(artcw);
}

function stopListening() {
  artcw_stop_listening(artcw);
}

function shutdown() {
  if (ctypes.CDataFinalizer) {
    // XXX This shouldn't be necessary; this should happen automatically when
    // the worker is garbage collected, but it doesn't
    artcw.dispose();
  } else {
    artcw_destroy(artcw);
  }
  lib.close();
  self.close();
}

// Autorepeat stuff
// This automatically sends repeating buttonpress events while the button is
// down.

const kAutorepeatInitialDelay = 500; // ms
const kAutorepeatInterval = 100; // ms

let autorepeatTimers = {};

function startAutorepeat(button) {
  stopAutorepeat(button);
  autorepeatTimers[button] = setTimeout(function () {
    repeatButtonPress(button);
  }, kAutorepeatInitialDelay);
  sendButtonPress(button);
}

function sendButtonPress(button) {
  self.postMessage({
    type: "buttonpress",
    button: button
  });
}

function repeatButtonPress(button) {
  sendButtonPress(button);
  autorepeatTimers[button] = setTimeout(function () {
    repeatButtonPress(button);
  }, kAutorepeatInterval);
}

function stopAutorepeat(button) {
  if (button in autorepeatTimers) {
    clearTimeout(autorepeatTimers[button]);
    delete autorepeatTimers[button];
  }
}
