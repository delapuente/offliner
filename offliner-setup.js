(function () {
  'use strict';

  var root = document.currentScript.dataset.root || '/';

  navigator.serviceWorker.register(root + 'offliner-worker.js', {
    scope: root
  }).catch(function (reason) {
    console.log(reason);
  });
}());
