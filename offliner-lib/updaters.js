
(function (self) {
  'use strict';

  function PrefetchUpdate(options) {
    options = options || {};
    this._onInstallOnly = options.onInstallOnly;
  }

  PrefetchUpdate.prototype.check = function () {
    var now = new Date();
    var newVersion = null;
    if (!this._onInstallOnly || this.flags.isCalledFromInstall) {
      newVersion = getDateTag(now);
    }
    return Promise.resolve(newVersion);

    function getDateTag(date) {
      return '' + date.getFullYear() +
             (date.getMonth() + 1) +
             date.getDate() + '-' +
             date.toTimeString().split(' ')[0] + ':' + date.getMilliseconds();
    }
  };

  PrefetchUpdate.prototype.isNewVersion = function (current, newVersion) {
    if (newVersion === current) {
      newVersion = increaseVersion(current);
    }
    return newVersion;

    function increaseVersion(version) {
      var newVersion, hasVersionCounter = /\+v\d+$/.test(version);
      var split = version.split('+');
      if (hasVersionCounter) {
        newVersion = parseInt(split.pop());
        newVersion++;
      }
      else {
        newVersion = 1;
      }
      var newTag = 'v' + newVersion;
      split.push(newTag);
      return split.join('+');
    }
  };

  PrefetchUpdate.prototype.evolve = function (current, next, prefetch) {
    return prefetch();
  };

  self.updaters = self.updaters || {};

  self.updaters.prefetch = function (options) {
    return new PrefetchUpdate(options);
  };

}(typeof self === 'undefined' ? this : self));
