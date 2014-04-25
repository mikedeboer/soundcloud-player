self.onmessage = function (msg) {
  let fun = msg.data.fun;
  if (fun in self)
    self[fun](msg.data.arg);
}

let lib;
let mktcw_create, mktcw_start_listening, mktcw_stop_listening, mktcw_destroy;
let mktcw;

function init(libPath) {
  lib = ctypes.open(libPath);

  mktcw_create = lib.declare("mktcw_create", ctypes.default_abi, ctypes.voidptr_t);
  mktcw_start_listening = lib.declare("mktcw_start_listening", ctypes.default_abi, ctypes.void_t, ctypes.voidptr_t);
  mktcw_stop_listening = lib.declare("mktcw_stop_listening", ctypes.default_abi, ctypes.void_t, ctypes.voidptr_t);
  mktcw_destroy = lib.declare("mktcw_destroy", ctypes.default_abi, ctypes.void_t, ctypes.voidptr_t);

  mktcw = mktcw_create();
  let mktcwAddressAsDecimalString = ctypes.cast(mktcw, ctypes.uintptr_t).value.toString();

  if (ctypes.CDataFinalizer) {
    mktcw = ctypes.CDataFinalizer(mktcw, mktcw_destroy);
  }

  listenerWorker = new ChromeWorker("OSXMediaKeysListenerWorker.js");
  listenerWorker.postMessage({
    mktcwAddressAsDecimalString: mktcwAddressAsDecimalString,
    libPath: libPath
  });
  listenerWorker.addEventListener("message", function workerSentMessage(msg) {
    function sendKeyEvent(type) {
      self.postMessage({ type: type, keyCode: msg.data.keyCode });
    }
    if (msg.data.keyRepeat) {
      sendKeyEvent("keypress");
    } else {
      if (msg.data.pressedDown) {
        sendKeyEvent("keydown");
        sendKeyEvent("keypress");
      } else {
        sendKeyEvent("keyup");
      }
    }
  });
}

function startListening() {
  mktcw_start_listening(mktcw);
}

function stopListening() {
  mktcw_stop_listening(mktcw);
}

function shutdown() {
  if (ctypes.CDataFinalizer) {
    // XXX This shouldn't be necessary; this should happen automatically when
    // the worker is garbage collected, but it doesn't
    mktcw.dispose();
  } else {
    mktcw_destroy(mktcw);
  }
  lib.close();
  self.close();
}
