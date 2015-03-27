(function (exports) {
  'use strict';

  var nextPromiseId = 1;

  var originalOff = exports.off;

  var root = (function () {
    var root = new URL(
      document.currentScript.dataset.root || '',
      window.location.origin
    ).href;
    return root.endsWith('/') ? root : root + '/';
  }());

  var workerURL =
    root + (document.currentScript.dataset.worker || 'offliner-worker.js');

  exports.off = {

    _eventListeners: {},

    _xpromises: {},

    restore: function () {
      exports.off = originalOff;
      return this;
    },

    install: function () {
      navigator.serviceWorker.register(workerURL, {
        scope: root
      })
      .then(function () {
        console.log('Offliner installed');
      })
      .catch(function (reason) {
        console.warn(reason);
      });
      this._installMessageHandlers();
    },

    on: function (type, handler, willBeThis) {
      if (!this._has(type, handler, willBeThis)) {
        this._eventListeners[type] = this._eventListeners[type] || [];
        this._eventListeners[type].push([handler, willBeThis]);
      }
    },

    update: function () {
      return this._crossPromise('update');
    },

    activate: function () {
      return this._crossPromise('activate');
    },

    _runListeners: function (type, evt) {
      var listeners = this._eventListeners[type] || [];
      listeners.forEach(function (listenerAndThis) {
        var listener = listenerAndThis[0];
        var willBeThis = listenerAndThis[1];
        listener.call(willBeThis, evt);
      });
    },

    _installMessageHandlers: function installMessageHandlers() {
      var that = this;
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
          that._handleMessage(typeAndSubType[1], msg);
        }
      }
    },

    _handleMessage: function (offlinerType, msg) {
      var sw = navigator.serviceWorker;
      if (offlinerType === 'crossPromise') {
        this._resolveCrossPromise(msg);
      }
      else {
        this._runListeners(offlinerType, msg);
      }
    },

    _has: function (type, handler, willBeThis) {
      var listeners = this._eventListeners[type] || [];
      for (var i = 0, listenerAndThis; (listenerAndThis = listeners[i]); i++) {
        if (listenerAndThis[0] === handler &&
            listenerAndThis[1] === willBeThis) {
          return true;
        }
      }
      return false;
    },

    _crossPromise: function (order) {
      return new Promise(function (accept, reject) {
        var uniqueId = nextPromiseId++;
        var msg = {
          type: 'crossPromise',
          id: uniqueId,
          order: order
        };
        this._xpromises[uniqueId] = [accept, reject];
        this._send(msg);
      }.bind(this));
    },

    _send: function (msg) {
      navigator.serviceWorker.controller.postMessage(msg);
    },

    _resolveCrossPromise: function (msg) {
      var implementation = this._xpromises[msg.id];
      if (implementation) {
        implementation[msg.status === 'rejected' ? 1 : 0](msg.value);
      }
      else {
        console.warn('Trying to resolve unexistent promise:', msg.id);
      }
    }
  };

}(this));
