# Inn kit gaps — inn-02 (2026-10-02)

Objects the inn room grammars (`tools/spawn-tuner/ROOMS.md`, solver v2) want but the catalog lacked, found by running the v2 solver over every inn room type (880 rooms): privy seats stood in a bare bank with nothing between them, back-to-back stall rows had no back panel, and fine rooms had no wall mirror. Everything else the grammars want already had a catalog line and only lacked a mesh; those SKUs are in `runs/inn-02/manifest.tsv`.

## C5. Inn fittings (inn-02)

- **privy-stall-partition** — wooden privy stall partition · kit · edge · size:4x48x72 · wood · set:TAV,CAS,MKT · var:shape · aff:block,los · kit · P2 · stands between privy seats in a bank; 4 ft deep, 6 ft tall, open above
- **privy-stall-door** — half-height privy stall door (leaf only) · kit · edge · size:30x3x60 · wood · set:TAV,CAS,MKT · var:shape · aff:pass,open,los · kit · P2 · closes a privy stall; gap above and below
- **stable-stall-back** — stall back panel for back-to-back stall rows · kit · edge · size:120x6x60 · wood · set:TAV,HUT,CAS · var:shape · aff:block,cover · kit · P2 · solid plank wall between two stall rows that share a spine
- **mirror-wall** — framed mirror hung on a wall · wall · sub · size:24x3x36 · mixed · set:NOB,TAV,CLT · var:wealth · aff:- · mesh · P2 · fine guest rooms and washstands; silvered glass painted matte
