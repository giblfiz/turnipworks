# Engine core: commander's intent

**The one judgment:** does the shared play space (its areas) stay **consistent, permissioned and smooth** under real network conditions?

- **Consistent:** every participant who can see an area converges on the same state, in the relay's order, after any mix of latency, jitter, reconnects and relay restarts. Nothing committed is ever lost, and nothing is applied twice.
- **Permissioned:** every command is checked by the relay against the seat that sent it. An LLM seat can never do or see more than the human who created it, and revoking the human revokes the agent. Secrets (GM-only tables, party-only scenes) are filtered by the relay, not hidden by the client.
- **Smooth:** your own actions feel instant (optimistic apply), other people's cursors and drags glide (interpolated presence), and lag shows up as delay, never as jumps backwards or flicker.

This folder is the foundation the product grows on, not a demo. Its code follows the seven principles in `docs/NETCODE.md`:
1. state is plain data;
2. one door (`dispatch`);
3. stable IDs;
4. nothing global but the campaign;
5. humans and LLMs are the same kind of participant;
6. views are first-class;
7. there is one command protocol.

When a choice trades beauty for one of the three words above, the three words win. When it trades the three words against each other, consistency wins over smoothness, and permission wins over both.

**Delete or rewrite when:** a real engine build supersedes a module. The command core (`core/`) and the journal format are the parts expected to survive.
