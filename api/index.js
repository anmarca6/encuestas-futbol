// Vercel serverless function adapter for the vinext app.
//
// vinext (https://github.com/cloudflare/vinext) ships a production server
// (`vinext/server/prod-server`) that expects to own a long-running
// `node:http` server via `startProdServer()`. Vercel's Node.js runtime
// instead wants a single `(req, res) => void` handler per invocation.
//
// To reuse vinext's real request handling (static asset serving from
// `dist/client`, RSC/SSR rendering, compression, image optimization, etc.)
// instead of reimplementing it, we let `startProdServer()` run once per
// warm Lambda instance, but intercept `http.createServer`/`server.listen()`
// so no port is ever actually bound — then extract the `request` event
// listener it registered and call that directly on every invocation.
import http from 'node:http';
import path from 'node:path';

let requestListenerPromise;

function getRequestListener() {
  requestListenerPromise ??= createRequestListener();
  return requestListenerPromise;
}

async function createRequestListener() {
  const originalListen = http.Server.prototype.listen;
  let capturedServer;

  // vinext imports `createServer` as a named import from 'node:http', which
  // Node snapshots at process bootstrap — patching `http.createServer` (the
  // default export) would not be visible there. `Server.prototype` is a
  // single shared object regardless of import style, so patch `listen()`
  // instead and use `this` to capture the instance it was called on.
  //
  // vinext calls server.listen(port, host, callback) and awaits the
  // 'listening' event via that callback. We never bind a real port here, so
  // just invoke the callback ourselves to let startProdServer() proceed.
  http.Server.prototype.listen = function patchedListen(...args) {
    capturedServer = this;
    const callback = args.find((arg) => typeof arg === 'function');
    if (callback) queueMicrotask(callback);
    return this;
  };

  try {
    const { startProdServer } = await import('vinext/server/prod-server');
    await startProdServer({
      port: 0,
      host: '127.0.0.1',
      outDir: path.join(process.cwd(), 'dist'),
      silent: true,
    });
  } finally {
    http.Server.prototype.listen = originalListen;
  }

  if (!capturedServer) {
    throw new Error(
      '[vercel-adapter] vinext prod server did not create an http.Server as expected',
    );
  }
  const listener = capturedServer.listeners('request')[0];
  if (!listener) {
    throw new Error(
      '[vercel-adapter] vinext prod server did not register a request listener as expected',
    );
  }
  return listener;
}

export default async function handler(req, res) {
  const listener = await getRequestListener();
  listener(req, res);
}
