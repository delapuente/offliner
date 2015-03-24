
(function (self) {
  'use strict';

  function isPrefixMatch(prefix, str) {
    return str.substr(0, prefix.length) === prefix;
  }

  function getFirstPrefixMatch(prefixes, str) {
    for (var i = 0, prefix; (prefix = prefixes[i]); i++) {
      if (isPrefixMatch(prefix, str)) { return prefix; }
    }
    return null;
  }

  /**
   * Contains resolvers for the fetch process.
   * @module sources
   */
  self.sources = self.sources || {};

  /**
   * Creates a cache resolver that tries to fetch the resource from the
   * current active cache or fails.
   * @return {FetchResolver} - The cache resolver.
   */
  self.sources.cache = function () {
    return function (request, cache) {
      return cache.match(request).then(function (response) {
        if (!response) { return Promise.reject(); }
        else { return response; }
      });
    };
  };

  /**
   * Creates a resolver to fetch from a whitelisted set of URLs.
   * @param {Array} - a list of URLs from which the resolver can fetch. These
   * URLs match any request to them or other URLs prefixed by them. You can
   * indicate `*` to allow any URL.
   * @returns {FetchResolver} - a resolver to fetch from whitelisted URLs.
   */
  self.sources.network = function (whitelist) {
    if (whitelist === '*') {
      return function (request) {
        return fetch(request);
      };
    }

    if (!Array.isArray(whitelist)) {
      whitelist = whitelist ? [whitelist] : [];
    }

    return function (request) {
      var isAllowed = getFirstPrefixMatch(whitelist, request.url);
      return isAllowed ? fetch(request) : Promise.reject();
    };
  };

  /**
   * Creates a resolver to fetch from network but to fallback if network is
   * not available or there are fetching errors.
   * @param {FallbackMap} - an object with prefixes and fallbacks for when the
   * resource can not be normally fetched.
   * @returns {FetchResolver} - a resolver to fetch from network or fallbacks.
   */
  self.sources.fallback = function (fallbacks) {
    return function (request, cache) {
      var prefix = getFirstPrefixMatch(Object.keys(fallbacks), request.url);
      if (prefix) {
        return fetch(request).then(function (response) {
          if (response.status > 400) {
            return returnFallback();
          }
          return response;
        }, returnFallback);
      }
      return Promise.reject();

      function returnFallback() {
        return cache.match(new Request(fallbacks[prefix]));
      }
    };
  };

}(typeof self === 'undefined' ? this : self));
