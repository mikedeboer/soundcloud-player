var EXPORTED_SYMBOLS = ["createWorker", "createChromeWorker"];

function createWorker(url) {
  return new Worker(url);
}

function createChromeWorker(url) {
  return new ChromeWorker(url);
}
