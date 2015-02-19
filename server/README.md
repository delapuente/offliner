# Offliner GH Tunnel
Due to CORS, GitHub does not allow a webpage hosted in gh-pages to access to its own user's ZIP packages served by the `codeload` domain. To enable gh-pages integration with offliner, it is necessary to overcome the CORS policy of GitHub. This is the goal of this simple node.js server.

## Installation and run

You only need to install the server dependencies by running the following command in the server directory:

```bash
$ npm install
```

Now run your server with:

```
$ node main.js
```

You can tweak the `port` property in the `config.json` file to change the listening port.

Remember to configure the `GH_PAGES_TUNNEL_SERVER` option in cache.js to point to this server.
