
var express = require('express'),
    request = require('request'),
    config  = require('./config.json');

var tunnel = express();
tunnel.get('/archive/:userName/:repo/:branch', getZip);
tunnel.head('/archive/:userName/:repo/:branch', getZip);
tunnel.listen(config.port);
console.log('Listening on port ' + config.port + '...');

function getZip(req, res, next) {
  var username = req.params.userName;
  var repo = req.params.repo;
  var branch = req.params.branch;
  var url = 'https://codeload.github.com/' +
            username + '/' + repo + '/zip/' + branch;
  console.log(req.method.toUpperCase() + ' ' + url);

  var origin = 'https://' + username + '.github.io';
  var writeHead = res.writeHead;
  res.writeHead = function () {
    res.header('Access-Control-Allow-Origin', origin);
    res.header('Access-Control-Expose-Headers', 'ETag,Content-Length');
    writeHead.apply(res, arguments);
  };
  var ghRequest = request[req.method.toLowerCase()](url);
  ghRequest.on('error', function () {});
  req.pipe(ghRequest).pipe(res);
}
