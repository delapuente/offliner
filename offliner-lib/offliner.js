/** @module offliner */

(function (self) {
  ['log', 'warn', 'error'].forEach(function (method) {
    self[method] = console[method].bind(console);
  });

  var DEFAULT_VERSION = '$zero$';

  /**
   * Creates a new Offliner instance.
   * @param {String} - a unique name representing the offline handler. This
   * allow you to instantiate several offliners for the same or different
   * workers without causing collisions between the configuration and cache
   * names.
   * @memberof offliner
   * @class
   */
  function Offliner(uniquename) {
    Object.defineProperty(this, '_uniquename', {
      get: function () { return uniquename ? uniquename + ':' : ''; }
    });

    this._isStarted = false;

    /**
     * The global update control.
     * @type {UpdateControl}
     * @private
     */
    this._updateControl = {
      enabled: false,
      alreadyRunOnce: false,
      intervalId: null,
      inProgressProcess: null
    };

    /**
     * Set to `true` when the worker is waiting for the first fetch.
     * @private
     */
    this._firstFetch = true;

    /**
     * API to configure the fetching pipeline.
     */
    this.fetch = new FetchConfig();

    /**
     * API to configure the prefetch process.
     */
    this.prefetch = new PrefetchConfig();

    /**
     * API to configure the update process.
     */
    this.update = new UpdateConfig();
  }

  /**
   * @typedef {object} UpdateControl
   * @property {boolean} enabled - Indicates if updates are enabled.
   * @property {boolean} alreadyRunOnce - Set to `true` when the update has run
   * once.
   * @property {number|null} intervalId - Holds the reference to the timer for
   * the next update.
   * @property {object} inProgressProcess - Holds the reference to the promise
   * representing the currently running update process.
   *
   * @memberof offliner
   */

  /**
   * Installs the service worker in stand-alone mode.
   */
  Offliner.prototype.standalone = function () {

    if (this._isStarted) { return; }

    self.addEventListener('install', function (e) {
      e.waitUntil(
        this._install()
          .then(function () { log('Offliner installed'); })
      );
    }.bind(this));

    self.addEventListener('activate', function (e) {
      e.waitUntil(
        this._activateNextCache()
          .then(function () { log('Offliner activated!'); })
      );
    }.bind(this));

    self.addEventListener('fetch', function (e)  {
      if (e.request.method !== 'GET') {
        e.respondWith(fetch(e.request));
      }
      else {
        if (this.update.option('enabled')) {
          this._schedulePeriodicUpdates();
        }
        e.respondWith(this._fetchAfterCacheActivation(e.request));
      }
    }.bind(this));

    this._isStarted = true;
  };

  /**
   * Gets a setting for the offliner handler.
   * @param {String} - the setting to be retrieved.
   * @private
   */
  Offliner.prototype.get = function (key) {
    var configURL = this._getConfigURL(key);
    return caches.open('__offliner-config').then(function (cache) {
      return cache.match(configURL).then(function (response) {
        if (!response) { return Promise.resolve(null); }
        else { return response.json(); }
      });
    });
  };

  /**
   * Sets a setting for the offliner handler.
   * @param {String} - the setting.
   * @param {any} - the value to be set.
   * @private
   */
  Offliner.prototype.set = function (key, value) {
    var configURL = this._getConfigURL(key);
    var response = new Response(JSON.stringify(value));
    return caches.open('__offliner-config').then(function (cache) {
      return cache.put(configURL, response);
    });
  };

  /**
   * Return a fake URL scheme for a setting.
   * @param {String} - the setting.
   *
   * @private
   */
  Offliner.prototype._getConfigURL = function (key) {
    return 'http://config/' + this._uniquename + key;
  };

  /**
   * Install the timers for periodic updates.
   * @private
   */
  Offliner.prototype._schedulePeriodicUpdates = function (fromInstall) {
    if (!this._updateControl.enabled) {
      if (!this._updateControl.alreadyRunOnce &&
          !this._updateControl.inProgressProcess) {
        log('SW awake update.');
        this._update(fromInstall);
      }
      var updatePeriod = offliner.update.option('period');
      if (typeof updatePeriod === 'number' ) {
        log('Next update in', updatePeriod / 1000, 'seconds.');
        this._updateControl.intervalId = setInterval(function () {
          log('Periodic update. Next in', updatePeriod / 1000, 'seconds.');
          this._update();
        }.bind(this), updatePeriod);
      }
      this._updateControl.enabled = true;
    }
  };

  /**
   * Determine if the worker should prefetch or update upon updating the
   * service worker.
   * @private
   */
  Offliner.prototype._install = function () {
    var fromInstall = true;
    return this.get('current-version').then(function (currentVersion) {
      var isUpdateEnabled = this.update.option('enabled');
      if (currentVersion) {
        return isUpdateEnabled ?
               this._schedulePeriodicUpdates(fromInstall) : Promise.resolve();
      }
      return this._initialize().then(this._prefetch.bind(this));
    }.bind(this), error);
  };

  /**
   * Initializes the current version and active cache for the first time.
   *
   * @private
   */
  Offliner.prototype._initialize = function () {
    return this._getCacheNameForVersion(DEFAULT_VERSION)
      .then(this.set.bind(this, 'active-cache'))
      .then(this.set.bind(this, 'current-version', DEFAULT_VERSION));
  };

  /**
   * Performs a generic update process. It consists into:
   *
   *   1. Check for a new version using a middleware.
   *   2. Prepare the new version database.
   *   3. Evolve the offline cache using the middleware.
   *   4. Clean-up.
   *
   *  @private
   */
  Offliner.prototype._update = function (fromInstall) {
    // XXX: Only one update process is allowed at a time.
    if (!this._updateControl.inProgressProcess) {
      this.update.flags = { isCalledFromInstall: fromInstall };
      this._updateControl.inProgressProcess = this._getLatestVersion()
        .then(this._checkIfNewVersion.bind(this))
        .then(updateCache.bind(this))
        .then(endUpdateProcess.bind(this))  // XXX:
        .catch(error)                       //
        .then(endUpdateProcess.bind(this)); // equivalent to .finally();
    }
    return this._updateControl.inProgressProcess;

    function updateCache(newVersion) {
      if (newVersion) {
        return this._getCacheNameForVersion(newVersion)
          .then(caches.open.bind(caches))
          .then(this._evolveCache.bind(this));
      }
    }

    function endUpdateProcess() {
      this._updateControl.alreadyRunOnce = true;
      this._updateControl.inProgressProcess = null;
    }
  };

  /**
   * Return the CACHE name for a version given.
   * @private
   */
  Offliner.prototype._getCacheNameForVersion = function (version) {
    return Promise.resolve(this._uniquename + 'cache-' + version);
  };

  /**
   * Opens current active cache and starts prefetch.
   *
   * @private
   */
  Offliner.prototype._prefetch = function () {
    return this._openActiveCache().then(this._doPrefetch.bind(this));
  };

  /**
   * Processes prefetch declared resources using the registered middlewares.
   * @param {Cache} - the cache for the middlewares to populate.
   *
   * @private
   */
  Offliner.prototype._doPrefetch = function (cache) {
    var allResources = this.prefetch.resources();
    var fetchers = this.prefetch.fetchers();
    var resourcesByType = groupResources(fetchers, allResources);
    return fetchers.reduce(function (process, fetcher) {
      return process.then(function () {
        var resources = resourcesByType[fetcher.type];
        return fetcher.prefetch(resources, cache);
      });
    }, Promise.resolve());

    function groupResources(fetchers, resources) {
      var resourceGatherers = fetchers.reduce(function (gatherers, fetcher) {
        gatherers[fetcher.type] = [];
        return gatherers;
      }, {});
      resources.forEach(function (resource) {
        var resourcesByType = resourceGatherers[resource.type];
        if (resourcesByType) { resourcesByType.push(resource); }
      });
      return resourceGatherers;
    }
  };

  /**
   * Obtains the latest version using the update middleware.
   * @returns {Promise} {@link external:String} Tag representing the
   * latest version. The tag will be used as suffix for the new cache.
   *
   * @private
   */
  Offliner.prototype._getLatestVersion = function () {
    return this.update.check();
  };

  /**
   * Determine if there is a new version based on the latest version and the
   * current one by using the update middleware.
   * @returns {Promise} The new version tag is returned if there is a new
   * version or `null` otherwise.
   *
   * @private
   */
  Offliner.prototype._checkIfNewVersion = function (remoteVersion) {
    return this.get('current-version').then(function (localVersion) {
      var isNewVersion =
        this.update.isNewVersion(localVersion, remoteVersion);

      if (isNewVersion) {
        log('New version ' + remoteVersion + ' found!');
        if (localVersion) { log('Updating from version ' + localVersion); }
        else { log('First update'); }

        return this.set('next-version', remoteVersion)
          .then(function () { return remoteVersion; });
      }
      else {
        log('No update needed');
      }
      return null;
    }.bind(this));
  };

  /**
   * Evolves the current cache to the new cache by using the update middleware.
   * @returns {Promise}
   *
   * @private
   */
  Offliner.prototype._evolveCache = function (newCache) {
    return this._openActiveCache().then(function (currentCache) {
      var exportedPrefetch = this._doPrefetch.bind(this, newCache);
      return this.update.evolve(currentCache, newCache, exportedPrefetch);
    }.bind(this));
  };

  /**
   * Uses dynamic information to open the active CACHE.
   *
   * @private
   */
  Offliner.prototype._openActiveCache = function () {
    return this.get('active-cache').then(caches.open.bind(caches));
  };

  /**
   * Change the active cache to be the evolved cache if available. Once the
   * active cache has been updated, the former one is lost.
   * @returns {Promise}
   *
   * @private
   */
  Offliner.prototype._activateNextCache = function () {
    return Promise.all([
      this.get('current-version'),
      this.get('next-version')
    ])
    .then(function (versions) {
      var currentVersion = versions[0];
      var nextVersion = versions[1];
      if (nextVersion && currentVersion !== nextVersion) {
        return this._swapCaches().then(this._updateCurrentVersion.bind(this));
      }
    }.bind(this));
  };

  /**
   * Makes active cache to be the next-version cache populated during a past
   * update process. After swapping, the previous cache is lost.
   * @returns {Promise}
   *
   * @private
   */
  Offliner.prototype._swapCaches = function () {
    return Promise.all([
      getCurrentCache.call(this),
      getNextCache.call(this)
    ]).then(swap.bind(this));

    function getCurrentCache() {
      return this.get('active-cache');
    }

    function getNextCache() {
      return this.get('next-version')
        .then(this._getCacheNameForVersion.bind(this));
    }

    function swap(names) {
      var currentCache = names[0],
          nextCache = names[1];
      return this.set('active-cache', nextCache)
        .then(caches.delete.bind(caches, currentCache));
    }
  };

  /**
   * Updates the current version.
   * @returns {Promise}
   *
   * @private
   */
  Offliner.prototype._updateCurrentVersion = function () {
    return this.get('next-version')
      .then(this.set.bind(this, 'current-version'));
  };

  /**
   * Before serving anything from cache, this method emulates an activation
   * and triggers {@link this._activateNextCache} to convert the evolved into
   * the current active cache.
   *
   * Notice the evolved cache was created in a previous update process, now
   * is ready but it was not replaced yet the active cache.
   *
   * @param {Request} - the request to be fetched.
   *
   * @private
   */
  Offliner.prototype._fetchAfterCacheActivation = function (request) {
    if (this._firstFetch) {
      this._firstFetch = false;
      return this._activateNextCache()
        .then(this._fetch.bind(this, request))
        .catch(error);
    }
    return this._fetch(request);
  };

  /**
   * Use configured middlewares to perform the fetch process.
   * @returns {Promise}
   *
   * @private
   */
  Offliner.prototype._fetch = function (request) {
    return new Promise(function (resolve, reject) {
      this._openActiveCache().then(function (cache) {
        var sources = this.fetch.pipeline();
        trySources(sources);

        function trySources(sources, from) {
          from = from || 0;
          var sourcesCount = sources.length;
          if (from === sources.length) { reject(); }
          else {
            sources[from](request, cache).then(resolve, function () {
              trySources(sources, from + 1);
            });
          }
        }
      }.bind(this));
    }.bind(this));
  };

  function PrefetchConfig() {
    this._resourceFetchers = {};
    this._resources = [];
  }

  PrefetchConfig.prototype.use = function (fetcher) {
    this._resourceFetchers[fetcher.type] = fetcher;
    this._activeFetcher = fetcher;
    return this;
  };

  PrefetchConfig.prototype.resources = function (resources) {
    if (arguments.length === 0) { return this._resources; }

    if (!Array.isArray(resources)) { resources = [resources]; }
    for (var i = 0, resource; (resource = resources[i]); i++) {
      var normalized;
      if (typeof resource !== 'object' || !resource || !resource.type) {
        try {
          normalized = this._activeFetcher.normalize(resource);
        }
        catch (e) {}
      }
      if (!normalized) {
        warn(resource, 'can not be normalized by', this._activeFetcher.type);
      }
      else {
        this._resources.push(normalized);
      }
    }
    return this;
  };

  PrefetchConfig.prototype.fetchers = function () {
    return Object.keys(this._resourceFetchers).map(function (type) {
      return this._resourceFetchers[type];
    }.bind(this));
  };

  function UpdateConfig() {
    this._options = {};
  }

  UpdateConfig.prototype.option = function (optname, value) {
    if (arguments.length === 2) {
      this._options[optname] = value;
      return this;
    }
    if (arguments.length === 1) {
      return this._options[optname];
    }
  };

  UpdateConfig.prototype.use = function (updateImplementation) {
    this.option('enabled', true);
    this._impl = updateImplementation;
    return this;
  };

  Object.defineProperty(UpdateConfig.prototype, 'flags', {
    set: function (value) {
      this._impl.flags = value;
    },
    get: function () {
      return this._impl.flags;
    }
  });

  UpdateConfig.prototype.check = function () {
    return this._impl.check();
  };

  UpdateConfig.prototype.isNewVersion = function (localVersion, remoteVersion) {
    return this._impl.isNewVersion(localVersion, remoteVersion);
  };

  UpdateConfig.prototype.evolve = function (currentCache, newCache, prefetch) {
    return this._impl.evolve(currentCache, newCache, prefetch);
  };

  function FetchConfig() {
    this._pipeline = [];
  }

  FetchConfig.prototype.use = function (source) {
    this._pipeline.push(source);
    return this;
  };

  FetchConfig.prototype.pipeline = function () {
    return this._pipeline;
  };

  FetchConfig.prototype.orFail = function () {
    return this.use(function () {
      return Promise.reject(new Error('End of fetch pipeline!'));
    });
  };

  self.Offliner = Offliner;

  self.sources = {};
  self.fetchers = {};
  self.updaters = {};

}(typeof self === 'undefined' ? this : self));

