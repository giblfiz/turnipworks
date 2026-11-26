// Loaded before the converter (node --import ./sandbox.mjs): the network is shut off inside the process. Node's
// permission model (the flags relay/uploads.js passes) already forbids reading or writing outside the worker and job
// folders, child processes and workers; it does not cover sockets in this Node version, so this does. Nothing in the
// converter needs the network, so anything that reaches for it is a bug or an attack, and it throws.
import net from 'node:net';
import tls from 'node:tls';
import dns from 'node:dns';
import http from 'node:http';
import https from 'node:https';
import dgram from 'node:dgram';

const no = () => { throw new Error('the upload worker has no network'); };
for (const [mod, keys] of [[net, ['connect', 'createConnection', 'createServer']], [tls, ['connect', 'createServer']], [http, ['request', 'get', 'createServer']], [https, ['request', 'get', 'createServer']], [dgram, ['createSocket']], [dns, ['lookup', 'resolve', 'resolve4', 'resolve6', 'resolveAny']]]) {
  for (const k of keys) { try { Object.defineProperty(mod, k, { value: no, writable: false, configurable: false }); } catch { } }
}
try { net.Socket.prototype.connect = no; } catch { }
try { dns.promises.lookup = no; dns.promises.resolve = no; } catch { }
for (const k of ['fetch', 'WebSocket', 'EventSource', 'XMLHttpRequest']) { try { Object.defineProperty(globalThis, k, { value: no, writable: false, configurable: false }); } catch { } }
