
(function () {
  'use strict';

  var root = document.currentScript.dataset.root || '/';
  var channel = new MessageChannel();

  channel.port1.onmessage = function (message) {
    var loglevel = message.data.loglevel;
    if (loglevel !== 'undefined') {
      var args = message.data.args || [];
      console[loglevel].apply(console, args);
    }
  };

  navigator.serviceWorker.register(root + 'offline-cache.js', {
    scope: root
  }).then(function (registration) {
    var sw = registration.active ||
             registration.waiting ||
             registration.installing;
    sw.postMessage('subscribe', [channel.port2]);
  }, function (reason) {
    console.log(reason);
  });
}());

