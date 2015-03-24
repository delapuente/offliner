
(function (self) {
  'use strict';

  function URLFetcher(options) {
    options = options || {};
    var base = options.base || '/';
    this._base = base.endsWith('/') ? base : (base + '/');
    this._bust = options.bust || false;
  }

  URLFetcher.prototype.type = 'url';

  URLFetcher.prototype.prefetch = function (resources, cache) {
    return Promise.all(resources.map(function (resource) {
      var url;
      try {
        url = new URL(resource.url, self.location.origin);
      }
      catch (e) {
        return Promise.resolve();
      }

      url.pathname = this._base + url.pathname.substr(1);
      var request = new Request(url.href);
      var fetchURL = this._bust ? bustedURL(url.href) : url.href;
      var fetchRequest = new Request(fetchURL, { mode: 'no-cors' });
      return fetch(fetchRequest).then(function (response) {
        if (response.status >= 200 && response.status < 300) {
          return cache.put(request, response);
        }
      }).catch();
    }.bind(this)));
  };

  URLFetcher.prototype.normalize = function (resource) {
    if (typeof resource !== 'string') { return; }
    return { type: 'url', url: resource };
  };

  // Normalizes the url to be fetched.
  function bustedURL(url) {
    // XXX: No idea why we must not bust the root URL, but it works
    var tokens = new self.URL(url);
    if (tokens.host !== self.location.host) { return url; }
    return tokens.pathname !== '/' ? bust(tokens) : tokens.href;
  }

  // Bust the URL to avoid navigator cache.
  function bust(tokens) {
    return tokens.href + (tokens.search ? '&' : '?') + '__b=' + Date.now();
  }

  /**
   * Contains handlers for the prefetch process.
   * @module fetchers
   */
  self.fetchers = self.fetchers || {};

  /**
   * Create a {@link URLFetcher} with passed options.
   * @returns {URLFetcher} a basic URL fetcher to fetch resources pointed by
   * URLs.
   */
  self.fetchers.url = function (options) {
    return new URLFetcher(options);
  };

}(typeof self === 'undefined' ? this : self));
