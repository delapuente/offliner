
function XMLHttpRequest() {
  this._headers = Object.create(null);
  this._listeners = Object.create(null);
}

XMLHttpRequest.prototype = {
  constructor: XMLHttpRequest,

  addEventListener: function (eventName, listener) {
    this._listeners[eventName] = this._listeners[eventName] || [];
    this._listeners[eventName].push(listener);
  },

  open: function (method, url) {
    Object.defineProperty(this, '_method', { value: method });
    Object.defineProperty(this, '_url', { value: url });
  },

  responseType: "",

  send: function () {
    var that = this;

    fetch(this._url, { method: this._method })
      .then(processResponse, executeErrorCallbacks);

    function processResponse(response) {
      response = response.clone();
      Object.defineProperty(that, '_response', { value: response });
      if (that.responseType === '') {
        response.text().then(copyBody);
      }
      else if (that.responseType === 'arraybuffer') {
        response.arrayBuffer().then(copyBody);
      }
      else {
        throw new Error(
          'responseType ' + that.responseType + ' not implemented!'
        );
      }
    }

    function copyBody(body) {
      Object.defineProperty(that, 'response', { value: body });
      executeLoadCallbacks(undefined); // passing nothing
    }

    function executeLoadCallbacks(response) {
      executeCallbacks('load', response);
    }

    function executeErrorCallbacks(reason) {
      executeCallbacks('error', reason);
    }

    function executeCallbacks(eventName, value) {
      that._listeners[eventName].forEach(function (listener) {
        listener.call(that, value);
      });
    }
  },

  setRequestHeader: function (header, value) {
    this._headers[header] = value;
  },

  getResponseHeader: function (header) {
    return this._response.headers.get(header);
  }
};
