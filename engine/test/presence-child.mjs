// A client in its own process for presence.test.mjs: ClientSync over a websocket, pinging like the browser
// (client/main.js). The test freezes it with SIGSTOP and thaws it with SIGCONT.
//   node presence-child.mjs <ws url> <seat token>
import WebSocket from 'ws';
import { ClientSync } from '../core/client-sync.js';
import { wsTransport } from '../core/transport.js';
const [url, token] = process.argv.slice(2);
const c = new ClientSync({ token, transport: wsTransport(url, WebSocket), onStatus: (s) => process.stdout.write(s + '\n') });
c.connect();
setInterval(() => c.ping(), 200); // (the test's timeout is 600 ms, not 90 s: ping at the same ratio's safe side)
