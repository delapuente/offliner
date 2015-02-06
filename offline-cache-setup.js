
(function () {
  var root = document.currentScript.dataset.root || '/';

  navigator.serviceWorker.register(root + 'offline-cache.js', {
    scope: root
  }).then(function () {
    console.log('Offline cache installed at ' + new Date() + '!');
  }, function (reason) {
    console.log(reason);
  });
}());
