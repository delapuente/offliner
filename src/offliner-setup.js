(function () {
  'use strict';

  var activating = false;

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

  installMessageHandlers();

  function installMessageHandlers() {
    if (!installMessageHandlers.done) {
      if (typeof BroadcastChannel === 'function') {
        var bc = new BroadcastChannel('offliner-channel');
        bc.onmessage = onmessage;
      }
      else {
        window.addEventListener('message', onmessage);
      }
      installMessageHandlers.done = true;
    }
    
    function onmessage(e) {
      var msg = e.data;
      var type = msg ? msg.type : '';
      var typeAndSubType = type.split(':');
      if (typeAndSubType[0] === 'offliner') {
        handleMessage(typeAndSubType[1], msg);
      }
    }
  }

  function handleMessage(offlinerType, msg) {
    var sw = navigator.serviceWorker;
    switch (offlinerType) {
      case 'activationPending':
        var confirmation = confirm('There is a new version. Do you want to ' +
            'update?');

        if (confirmation && !activating) {
          if (sw.controller) {
            sw.controller.postMessage('activate');
            activating = true;
          }
          else {
            sw.addEventListener('controllerchange', function once() {
              sw.removeEventListener('controllerchange', once);
              sw.controller.postMessage('activate');
              activating = true;
            });
          }
        }
        break;

      case 'activationDone':
        if (activating) {
          activating = false;
          alert('Update done. Reloading...');
          window.location = './index.html';
        }
        else { console.warn('Received not expected message!'); }
        break;

      case 'activationFailed':
        if (activating) {
          activating = false;
          alert('Something went wrong.');
        }
        else { console.warn('Received not expected message!'); }
        break;
    }
  }
}());
