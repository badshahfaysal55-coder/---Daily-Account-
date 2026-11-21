/**
 * Copyright 2018 Google Inc. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *     http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

// If the loader is already loaded, just stop.
if (!self.define) {
  let registry = {};

  // Used for `eval` and `importScripts` where we can't get script URL by other means.
  // In both cases, it's safe to use a global var because those functions are synchronous.
  let nextDefineUri;

  const singleRequire = (uri, parentUri) => {
    uri = new URL(uri + ".js", parentUri).href;
    return registry[uri] || (
      
        new Promise(resolve => {
          if ("document" in self) {
            const script = document.createElement("script");
            script.src = uri;
            script.onload = resolve;
            document.head.appendChild(script);
          } else {
            nextDefineUri = uri;
            importScripts(uri);
            resolve();
          }
        })
      
      .then(() => {
        let promise = registry[uri];
        if (!promise) {
          throw new Error(`Module ${uri} didn’t register its module`);
        }
        return promise;
      })
    );
  };

  self.define = (depsNames, factory) => {
    const uri = nextDefineUri || ("document" in self ? document.currentScript.src : "") || location.href;
    if (registry[uri]) {
      // Module is already loading or loaded.
      return;
    }
    let exports = {};
    const require = depUri => singleRequire(depUri, uri);
    const specialDeps = {
      module: { uri },
      exports,
      require
    };
    registry[uri] = Promise.all(depsNames.map(
      depName => specialDeps[depName] || require(depName)
    )).then(deps => {
      factory(...deps);
      return exports;
    });
  };
}
define(['./workbox-43e44e5a'], (function (workbox) { 'use strict';

  self.skipWaiting();
  workbox.clientsClaim();
  /**
   * The precacheAndRoute() method efficiently caches and responds to
   * requests for URLs in the manifest.
   * See https://goo.gl/S9QRab
   */
  workbox.precacheAndRoute([{
    "url": "pwa-maskable-512x512.png",
    "revision": "67a66c7dab707d4fea1e435853ebf476"
  }, {
    "url": "pwa-512x512.png",
    "revision": "f78a9d8d7d9ab04f4634c46b0951e712"
  }, {
    "url": "pwa-192x192.png",
    "revision": "42bc8b95674066871d6eb66800b37050"
  }, {
    "url": "index.html",
    "revision": "26df7838836baed8e689df3f2dda57a8"
  }, {
    "url": "apple-touch-icon.png",
    "revision": "078b956d4e657b30c5f05273cfc55b21"
  }, {
    "url": "assets/workbox-window.prod.es5-Bd17z0YL.js",
    "revision": null
  }, {
    "url": "assets/purify.es-Dzkdzyfv.js",
    "revision": null
  }, {
    "url": "assets/index.es-CtOKRfT8.js",
    "revision": null
  }, {
    "url": "assets/index-CO5_IY0I.css",
    "revision": null
  }, {
    "url": "assets/index-7C80VWIU.js",
    "revision": null
  }, {
    "url": "assets/html2canvas-CwDQxptH.js",
    "revision": null
  }, {
    "url": "assets/aistudio/gemini-code-1794029464620_4b1b55ea.js",
    "revision": null
  }, {
    "url": "assets/aistudio/IMG_3709_4c4e1477.png",
    "revision": null
  }, {
    "url": "apple-touch-icon.png",
    "revision": "078b956d4e657b30c5f05273cfc55b21"
  }, {
    "url": "pwa-192x192.png",
    "revision": "42bc8b95674066871d6eb66800b37050"
  }, {
    "url": "pwa-512x512.png",
    "revision": "f78a9d8d7d9ab04f4634c46b0951e712"
  }, {
    "url": "pwa-maskable-512x512.png",
    "revision": "67a66c7dab707d4fea1e435853ebf476"
  }, {
    "url": "manifest.webmanifest",
    "revision": "5dcbf10b87a43b8ddf1cea221322ee49"
  }], {});
  workbox.cleanupOutdatedCaches();
  workbox.registerRoute(new workbox.NavigationRoute(workbox.createHandlerBoundToURL("index.html"), {
    denylist: [/^\/api/]
  }));
  workbox.registerRoute(/^\/api\/.*/i, new workbox.NetworkOnly(), 'GET');
  workbox.registerRoute(/^https:\/\/fonts\.googleapis\.com\/.*/i, new workbox.CacheFirst({
    "cacheName": "google-fonts-cache",
    plugins: [new workbox.ExpirationPlugin({
      maxEntries: 10,
      maxAgeSeconds: 31536000
    }), new workbox.CacheableResponsePlugin({
      statuses: [0, 200]
    })]
  }), 'GET');
  workbox.registerRoute(/^https:\/\/fonts\.gstatic\.com\/.*/i, new workbox.CacheFirst({
    "cacheName": "gstatic-fonts-cache",
    plugins: [new workbox.ExpirationPlugin({
      maxEntries: 10,
      maxAgeSeconds: 31536000
    }), new workbox.CacheableResponsePlugin({
      statuses: [0, 200]
    })]
  }), 'GET');

}));
