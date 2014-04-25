function listen(mktcw, libPath) {
  let lib = ctypes.open(libPath);

  let mktcw_message_t = ctypes.StructType("mktcw_message", [
    { "isDestroyNotification": ctypes.bool },
    { "pressedDown": ctypes.bool },
    { "keyCode": ctypes.int },
    { "keyFlags": ctypes.int },
    { "keyRepeat": ctypes.bool },
   ]);

  let mktcw_get_message = lib.declare("mktcw_get_message", ctypes.default_abi, mktcw_message_t, ctypes.voidptr_t);

  while (true) {
    let msg = mktcw_get_message(mktcw);
    if (msg.isDestroyNotification) {
      lib.close();
      self.close();
      return;
    }
    self.postMessage({
      pressedDown: msg.pressedDown,
      keyCode: msg.keyCode,
      keyFlags: msg.keyFlags,
      keyRepeat: msg.keyRepeat,
    });
  }
}

self.onmessage = function (msg) {
  let mktcwAddressAsDecimalString = msg.data.mktcwAddressAsDecimalString;
  let mktcw = ctypes.cast(ctypes.uintptr_t(mktcwAddressAsDecimalString), ctypes.voidptr_t);
  listen(mktcw, msg.data.libPath);
}
