function listen(artcw, libPath) {
  let lib = ctypes.open(libPath);

  let artcw_message_t = ctypes.StructType("artcw_message", [
    { "type": ctypes.unsigned_int },
    { "pressedDown": ctypes.bool },
    { "isDestroyNotification": ctypes.bool }
   ]);

  let artcw_get_message = lib.declare("artcw_get_message", ctypes.default_abi, artcw_message_t, ctypes.voidptr_t);

  while (true) {
    let msg = artcw_get_message(artcw);
    if (msg.isDestroyNotification) {
      lib.close();
      self.close();
      return;
    }
    self.postMessage({ type: msg.type, pressedDown: msg.pressedDown });
  }
}

self.onmessage = function (msg) {
  let artcwAddressAsDecimalString = msg.data.artcwAddressAsDecimalString;
  let artcw = ctypes.cast(ctypes.uintptr_t(artcwAddressAsDecimalString), ctypes.voidptr_t);
  listen(artcw, msg.data.libPath);
}
