/** @module offliner */

importScripts('./asyncStoragePromise.js');

(function (self) {
  ['log', 'warn', 'error'].forEach(function (method) {
    self[method] = console[method].bind(console);
  });

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
        this._schedulePeriodicUpdates();
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
    return asyncStorage.get(this._uniquename + key);
  };

  /**
   * Sets a setting for the offliner handler.
   * @param {String} - the setting.
   * @param {any} - the value to be set.
   * @private
   */
  Offliner.prototype.set = function (key, value) {
    return asyncStorage.set(this._uniquename + key, value);
  };

  /**
   * Install the timers for periodic updates.
   * @private
   */
  Offliner.prototype._schedulePeriodicUpdates = function () {
    if (!this._updateControl.enabled) {
      if (!this._updateControl.alreadyRunOnce &&
          !this._updateControl.inProgressProcess) {
        log('SW awake update.');
        this._update();
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
    return this.get('current-version').then(function (currentVersion) {
      if (currentVersion) { return this._update(); }
      else { return this.prefetch(); }
    }.bind(this), error);
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
  Offliner.prototype._update = function () {
    // XXX: Only one update process is allowed at a time.
    if (!this._updateControl.inProgressProcess) {
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
   * Processes prefetch declared resources using the registered middlewares.
   */
  Offliner.prototype.prefetch = function () {
    var allResources = offliner.prefetch.resources();
    var resourcesByType = groupResources(allResources);
    return offliner.prefetch.handlers().reduce(function (process, handler) {
      process.then(function () {
        var resources = resourcesByType[handler.type];
        return handler(resources);
      });
    }, Promise.resolve());

    function groupResources(resources) {
      var resourceGatherers =
        offliner.prefetch.handlers().reduce(function (gatherers, handler) {
          gatherers[handler.type] = [];
        }, {});
      resources.forEach(function (resource) {
        var normalize = offliner.prefetch.option('normalizer');
        if (typeof resource !== 'object') {
          resource = normalize(resource);
        }
        if (typeof resource === 'object' && typeof resource.type === 'string') {
          var resourcesByType = gatherers[resource.type];
          if (resourcesByType) { resourcesByType.push(resource); }
        }
      });
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
    return offliner.update.check();
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
        offliner.update.isNewVersion(localVersion, remoteVersion);

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
    });
  };

  /**
   * Evolves the current cache to the new cache by using the update middleware.
   * @returns {Promise}
   *
   * @private
   */
  Offliner.prototype._evolveCache = function (newCache) {
    return this._openActiveCache().then(function (currentCache) {
      return offliner.update.evolve(currentCache, newCache);
    });
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
        .then(this._doFetch.bind(this, request))
        .catch(error);
    }
    return this._doFetch(request);
  };

  /**
   * Use configured middlewares to perform the fetch process.
   * @returns {Promise}
   *
   * @private
   */
  Offliner.prototype._doFetch = function (request) {
    return new Promise(function (resolve, reject) {
      var process = Promise.reject();
      offliner.fetch.pipeline.reduce(function (promise, middleware) {
        return process.then(resolve, middleware.bind(undefined, request));
      }, Promise.reject());
      process.catch(reject);
    });
  };

  self.offliner = new Offliner();

}(typeof self === 'undefined' ? this : self));

