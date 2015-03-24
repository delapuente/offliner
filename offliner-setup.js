(function () {
  'use strict';

  var root = (function () {
    var root = new URL(
      document.currentScript.dataset.root || '',
      window.location.origin
    ).href;
    return root.endsWith('/') ? root : root + '/';
  }());

  var workerURL =
    root + (document.currentScript.dataset.worker || 'offliner-worker.js');

  navigator.serviceWorker.register(workerURL, {
    scope: root
  }).catch(function (reason) {
    console.log(reason);
  });
}());
