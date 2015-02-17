var CACHE_NAME = 'cache-zero';

// Convenient shortcuts
['log', 'warn', 'error'].forEach(function (method) {
  self[method] = console[method].bind(console);
});

var ports = [];

self.addEventListener('message', function (message) {
  if (message.data === 'subscribe') {
    ports.push(message.ports[0]);
    log('Subscription message received!');
  }
});

function broadcast(data) {
  ports.forEach(function (port) {
    port.postMessage(data);
  });
}

// The root pathname
var root = (function () {
  var currentPath = self.location.pathname;
  var tokens = currentPath.split('/');
  tokens.pop();
  var currentDir = tokens.join('/');
  return currentDir + '/';
}());

// Import plugins
importScripts('offliner-plugins/asyncStorage.js');
importScripts('offliner-plugins/asyncStoragePromise.js'); // exports asyncStorage
importScripts('offliner-plugins/XMLHttpRequest.js');
importScripts('offliner-plugins/zip.js/zip.js'); // exports zip
importScripts('offliner-plugins/zip.js/deflate.js');
importScripts('offliner-plugins/zip.js/inflate.js');
zip.useWebWorkers = false;

// Import the configuration file.
try {
  importScripts('cache.js');
}
catch (e) {
  var NETWORK_ONLY = {};
  var PREFETCH = [];
}

(function digestConfigFile() {
  var origin = self.location.origin;

  // Convert relative to global URLs.
  Object.keys(NETWORK_ONLY).forEach(function (url) {
    var fallback = NETWORK_ONLY[url];
    url = absoluteURL(url);
    if (typeof fallback === 'string') {
      NETWORK_ONLY[url] = absoluteURL(fallback);
    }
  });

  // Normalize prefetch
  if (PREFETCH && !Array.isArray(PREFETCH)) {
    PREFETCH = [PREFETCH];
  }
  else if (!PREFETCH) {
    PREFETCH = [];
  }
  PREFETCH = PREFETCH.map(function (option) {
    if (typeof option === 'object' && option.type === 'gh-pages') {
      var zipInfo = getZipInfoFromGHPages(self.location);
      option.type = 'zip';
      option.url = zipInfo.url;
      option.prefix = zipInfo.prefix;
      return option;
    }
    return option;
  });
}());

function getZipInfoFromGHPages(url) {
  var username = url.host.split('.')[0];
  var repo = url.pathname.split('/')[1];
  return {
    url: getZipFromGHData(username, repo, 'gh-pages'),
    prefix: repo + '-gh-pages/'
  };
}

function getZipFromGHData(username, repo, branch) {
  var path = ['archive', username, repo, branch].join('/');
  return 'http://cacheator.com:4000/' + path;
}

function absoluteURL(url) {
  return new self.URL(url, self.location.origin).href;
}

function join() {
  var joint = '';
  for (var i = 0, path; (path = arguments[i]); i++) {
    var hasLeadingSlash = path[0] === '/';
    var hasTrailingSlash = path[path.length - 1] === '/';
    if (hasTrailingSlash) { path = path.substr(0, path.length - 1); }
    joint += hasLeadingSlash ? path : ('/' + path);
  }
  return joint;
}

function getMIMEType(filename) {
  var MIMEMap = {
    'css': 'text/css',
    'js': 'application/javascript',
    'html,html': 'text/html'
  };
  var items;
  var mimetype = 'undefined';
  var extensions = Object.keys(MIMEMap);
  for (var i = 0, list; (list = extensions[i]); i++) {
    mimetype = MIMEMap[list];
    items = list.split(',');
    for (var j = 0, extension; (extension = items[j]); j++) {
      if (RegExp('\\.' + extension + '$').test(filename)) {
        return mimetype;
      }
    }
  }
  return mimetype;
}

// On install, we perform the prefetch process
self.addEventListener('install', function (event) {
  event.waitUntil(
    update()
      .then(function () {
        log('Offline cache installed at ' + new Date() + '!');
      })
      .catch(error)
  );
});

self.addEventListener('activate', function (event) {
  log('Offline cache activated at ' + new Date() + '!');
});

// Starts the update process
function update() {
  if (!self.updateProcess) {
    self.updateProcess = getLatestVersionNumber()
      .then(checkIfNewVersion)
      .then(function (newVersion) {
        if (newVersion) {
          return getCacheNameForVersion(newVersion)
            .then(caches.open.bind(caches))
            .then(prefetch)
            .then(updateMetaData);
        }
      })
      .then(endUpdateProcess)
      .catch(error)
      .then(endUpdateProcess); // XXX: equivalent to .finally();
  }
  return self.updateProcess;

  function endUpdateProcess() {
    self.updateProcess = null;
  }
}

function getLatestVersionNumber() {
  var latestVersion;
  if (!UPDATE) {
    latestVersion = Promise.resolve(CACHE_NAME);
  }
  else if (UPDATE.type === 'gh-pages') {
    var updateChannel = getZipInfoFromGHPages(self.location).url;
    latestVersion = fetch(updateChannel, { method: "HEAD" })
      .then(function (response) {
        return response.headers.get('ETag').replace(/"/g, '');
      })
      .catch(function (reason) {
        error('Update channel is unreachable, aborting.');
        throw new Error('Update channel unreachable');
      });
  }
  else {
    latestVersion = Promise.reject(new Error("Update method not supported!"));
  }
  return latestVersion;
}

function checkIfNewVersion(remoteVersion) {
  return asyncStorage.get('current-version').then(function (localVersion) {
    if (!localVersion || remoteVersion && remoteVersion !== localVersion) {
      log('New version ' + remoteVersion + ' found!');
      if (localVersion) { log('Updating from version ' + localVersion); }
      else { log('First update'); }
      return asyncStorage.set('next-version', remoteVersion)
        .then(function () { return remoteVersion; });
    }
    else {
      log('No update needed');
    }
    return null;
  });
}

function getCacheNameForVersion(version) {
  return Promise.resolve('cache-' + version);
}

// Prefetch is the process to prepopulate the offline cache
function prefetch(targetCache) {
  return cacheNetworkOnly(targetCache)
    .then(digestPreFetch.bind(undefined, targetCache));
}

// Caches the NETWORK_ONLY fallbacks
function cacheNetworkOnly(offlineCache) {
  return Promise.all(Object.keys(NETWORK_ONLY).map(function (url) {
    var promise;
    var fallback = NETWORK_ONLY[url];
    if (typeof fallback !== 'string') {
      promise = Promise.resolve();
    }
    else {
      var request = new Request(fallback, { mode: 'no-cors' });
      promise = fetch(request)
        .then(offlineCache.put.bind(offlineCache, request));
    }
    return promise;
  }));
}

// Creates a chain of promises to populate the cache
function digestPreFetch(targetCache) {
  var urls = [];
  var digestion = Promise.resolve();
  PREFETCH.forEach(function (option) {
    if (typeof option === 'string') {
      var url = absoluteURL(option);
      urls.push(url);
    }
    else if (option.type === 'zip') {
      var zipURL = absoluteURL(option.url);
      digestion = digestion.then(function () {
        return populateFromRemoteZip(zipURL, option.prefix, targetCache);
      });
    }
  });
  // TODO: Should we stablish some specific order between entries?
  digestion = digestion.then(function () {
    return populateFromURL(urls, targetCache);
  });
  return digestion;
}

function openActiveCache(version) {
  return asyncStorage.get('active-cache').then(caches.open.bind(caches));
}

function updateMetaData(newCache) {
  return asyncStorage.get('next-version').then(function (version) {
    return Promise.all([
      asyncStorage.set('current-version', version),
      getCacheNameForVersion(version)
        .then(asyncStorage.set.bind(asyncStorage, 'active-cache'))
    ]);
  });
}

function populateFromURL(urls, offlineCache) {
  urls = Array.isArray(urls) ? urls : [urls];
  return Promise.all(urls.map(function (url) {
    var request = new Request(fetchingURL(url), { mode: 'no-cors' });
    return fetch(request).then(offlineCache.put.bind(offlineCache, request));
  }));
}

// Fetch a remote ZIP, deflates it and add the routes to the cache
function populateFromRemoteZip(zipURL, prefixToStrip, targetCache) {
  log('Populating from ' + zipURL);
  prefixToStrip = prefixToStrip || '';
  var readZip = new Promise(function (accept, reject) {
    fetch(zipURL).then(function (response) {
      return response.blob();
    }).then(function (blob) {
      zip.createReader(new zip.BlobReader(blob), function(reader) {
        reader.getEntries(function(entries) {
          deflateInCache(entries, prefixToStrip, targetCache)
            .then(reader.close.bind(reader, null)) // avoid callback for close
            .then(accept);
        });
      }, function(error) {
        reject(error);
      });
    });
  });
  return readZip;
}

// Decompress each zipped file and add it to the cache
function deflateInCache(entries, prefixToStrip, offlineCache) {
  prefixToStrip = prefixToStrip || '';
  var logProgress = getProgressLogger(entries);
  return Promise.all(entries.map(function deflateFile(entry) {
    var promise;
    if (entry.directory) {
      logProgress();
      promise = Promise.resolve();
    }
    else {
      promise = new Promise(function (accept) {
        entry.getData(new zip.BlobWriter(), function(content) {
          var filename = entry.filename.substr(prefixToStrip.length);
          var headers = new Headers();
          headers.append('Content-Type', getMIMEType(filename));
          var response = new Response(content, { headers: headers });
          var url = absoluteURL(join(root, filename));
          offlineCache.put(url, response)
            .then(logProgress)
            .then(accept);
        });
      });
    }
    return promise;
  }));

  function getProgressLogger(entries) {
    var total = entries.length;
    var completed = 0;
    return function progressLogger() {
      completed++;
      log('Caching at ' + Math.floor(100 * completed/total) + '%');
    };
  }
}

// Intercept requests to network.
self.addEventListener('fetch', function (event) {
  var request = event.request;
  update();
  event.respondWith(offlineResolver(request));
});

// Apply NETWORK_ONLY policy or do the best effort to keep resources always
// up to date.
function offlineResolver(request) {
  if (isNetworkOnly(request)) {
    return responseThroughNetworkOnly(request);
  }
  else {
    return doBestEffort(request);
  }
}

function isNetworkOnly(request) {
  return !!NETWORK_ONLY[request.url];
}

// Try to fetch from network, if no response go to the cache if there is a
// fallback resource or fails.
function responseThroughNetworkOnly(request) {
  return fetch(fetchingRequest(request)).catch(function () {
    var fallback = NETWORK_ONLY[request.url];
    if (typeof fallback === 'string') {
      return responseThroughCache(new Request(fallback, { mode: 'no-cors' }));
    }
  });
}

// Try to fetch from cache or fails.
function responseThroughCache(request) {
  return openActiveCache().then(function (offlineCache) {
    return offlineCache.match(request).catch(function (error) {
      console.log(error);
    });
  });
}

// The best effort consists into try to fetch from remote. If possible, save
// into the cache. If not, retrieve from cache. If not even possible, it fails.
function doBestEffort(request) {
  return openActiveCache().then(function (offlineCache) {
    var localRequest = offlineCache.match(request).catch(function (error) {
      console.log(error);
    });

    var remoteRequest = fetch(fetchingRequest(request))
      .then(function (remoteResponse) {
        offlineCache.put(request, remoteResponse.clone());
        return remoteResponse;
      });

    var bestEffort = remoteRequest.catch(function () {
      return localRequest;
    });
    return bestEffort;
  });
}

function fetchingRequest(request) {
  var newRequest = request.clone();
  newRequest.url = fetchingURL(request.url);
  return newRequest;
}

// Normalizes the url to be fetched.
function fetchingURL(url) {
  // XXX: No idea why we must not bust the root URL, but it works
  var tokens = new self.URL(url);
  if (tokens.host !== self.location.host) { return url; }
  return tokens.pathname !== '/' ? busted(tokens) : tokens.href;
}

// Bust the URL to avoid navigator cache.
function busted(tokens) {
  return tokens.href + (tokens.search ? '&' : '?') + '__b=' + Date.now();
}
