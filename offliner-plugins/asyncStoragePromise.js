(function (asyncStorage) {
  for (var method in this.asyncStorage) {
    var fn = asyncStorage[method].bind(asyncStorage);
    asyncStorage[method] = function () {
      var args = Array.prototype.slice.call(arguments);
      return new Promise(function (accept, reject) {
        fn.apply(asyncStorage, args.concat([accept]));
      });
    };
  }
}(this.asyncStorage));
