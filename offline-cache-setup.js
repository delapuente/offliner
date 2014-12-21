
navigator.serviceWorker.register('/offline-cache.js', {
  scope: '/'
}).then(function () {
  console.log('Offline cache installed at ' + new Date() + '!');
}, function (reason) {
  console.log(reason);
});
