# Results (blind Gemini reads + measured geometry)

## Per version, all six subjects

| version | reads | geometry | texture | mean rank /8 | table reads | table clean | axis share |
|---|---|---|---|---|---|---|---|
| current | 6.9 | 6.2 | 5.8 | 5.7 | 6.3 | 6.7 | 0.538 |
| TRELLIS regen | 6.2 | 5.8 | 5.2 | 5.4 | 6.7 | 7 | 0.524 |
| Meshy 7.1 | 7.7 | 7.3 | 7 | 3.8 | 6 | 6 | 0.555 |
| Meshy ST | 7.9 | 7.7 | 7.1 | 3.1 | 6.7 | 7.2 | 0.691 |

## Per subject

| subject | version | named blind (A) | reads | geom | tex | mean rank /8 | table reads/clean | axis share | in-game tris | runtime+lod10k+t256 KB | cost |
|---|---|---|---|---|---|---|---|---|---|---|---|
| store-shelving | current | store shelf (95) | 4.5 | 3 | 3 | 7.5 | 5/6 | 0.64 | 10000 | 858 | shipped |
| store-shelving | TRELLIS regen | store shelf (95) | 5 | 3.5 | 3 | 5.5 | 5/6 | 0.7 | 10000 | 823 | ~$0.01-0.05 |
| store-shelving | Meshy 7.1 | store shelf (95) | 7.5 | 6 | 6 | 3 | 8/8 | 0.554 | 10000 | 978 | 30 cr $0.60 |
| store-shelving | Meshy ST | store shelf (95) | 8.5 | 8 | 7.5 | 2 | 5/6 | 0.786 | 9523 | 576 | 15 cr $0.30 |
| server-rack | current | server rack (90) | 4.5 | 4.5 | 3.5 | 6.5 | 5/6 | 0.591 | 10000 | 762 | shipped |
| server-rack | TRELLIS regen | server rack (90) | 4.5 | 4 | 3.5 | 6.5 | 9/8 | 0.466 | 10000 | 795 | ~$0.01-0.05 |
| server-rack | Meshy 7.1 | server rack (90) | 8 | 8 | 7.5 | 2.5 | 5/6 | 0.641 | 10000 | 1067 | 30 cr $0.60 |
| server-rack | Meshy ST | server rack (90) | 7.5 | 7.5 | 6.5 | 2.5 | 9/8 | 0.704 | 9361 | 732 | 15 cr $0.30 |
| drinks-cooler | current | commercial drink refrigerator (95) | 8.5 | 7.5 | 7.5 | 3 | 9/9 | 0.732 | 10000 | 739 | shipped |
| drinks-cooler | TRELLIS regen | commercial drink refrigerator (95) | 4 | 6 | 3 | 5.5 | 3/6 | 0.79 | 9998 | 633 | ~$0.01-0.05 |
| drinks-cooler | Meshy 7.1 | commercial drink refrigerator (95) | 5.5 | 6.5 | 5.5 | 4.5 | 1/2 | 0.714 | 10000 | 904 | 30 cr $0.60 |
| drinks-cooler | Meshy ST | commercial drink refrigerator (95) | 5.5 | 7 | 5 | 5 | 3/6 | 0.836 | 9279 | 605 | 15 cr $0.30 |
| pallet-racking | current | warehouse pallet rack (95) | 8.5 | 7.5 | 7 | 6.5 | 8/8 | 0.764 | 10000 | 762 | shipped |
| pallet-racking | TRELLIS regen | warehouse pallet rack (95) | 8.5 | 7.5 | 7.5 | 5.5 | 8/8 | 0.705 | 10000 | 784 | ~$0.01-0.05 |
| pallet-racking | Meshy 7.1 | warehouse pallet rack (95) | 9 | 8 | 8 | 4 | 6/5 | 0.804 | 10000 | 1030 | 30 cr $0.60 |
| pallet-racking | Meshy ST | warehouse pallet rack (95) | 9 | 8 | 8 | 2 | 8/8 | 0.853 | 9454 | 622 | 15 cr $0.30 |
| fence-chain-link | current | chain-link fence (95) | 7 | 7 | 6.5 | 3.5 | 7/7 | 0.13 | 10000 | 787 | shipped |
| fence-chain-link | TRELLIS regen | chain-link fence (95) | 6 | 5.5 | 6 | 6.5 | 7/7 | 0.115 | 10000 | 825 | ~$0.01-0.05 |
| fence-chain-link | Meshy 7.1 | chain-link fence (95) | 7.5 | 7.5 | 7 | 4 | 7/7 | 0.145 | 10000 | 1180 | 30 cr $0.60 |
| fence-chain-link | Meshy ST | chain-link fence (95) | 8 | 7.5 | 7.5 | 4 | 7/7 | 0.414 | 10000 | 718 | 15 cr $0.30 |
| antenna-mast | current | radio tower (95) | 8.5 | 8 | 7 | 7 | 4/4 | 0.37 | 10000 | 761 | shipped |
| antenna-mast | TRELLIS regen | radio tower (95) | 9 | 8 | 8 | 3 | 8/7 | 0.367 | 10000 | 773 | ~$0.01-0.05 |
| antenna-mast | Meshy 7.1 | radio tower (95) | 8.5 | 8 | 8 | 5 | 9/8 | 0.475 | 10000 | 937 | 30 cr $0.60 |
| antenna-mast | Meshy ST | radio tower (95) | 9 | 8 | 8 | 3 | 8/8 | 0.55 | 8875 | 625 | 15 cr $0.30 |

## Defects named

- store-shelving / current: alone-close: melted sagging shelves, floating detached mesh artifact, blobby goods; room-close: floating detached geometric fragments, melted shelves, blobby goods; table: undersized with goods only at base and empty top
- store-shelving / TRELLIS regen: room-close: black normal and texture holes on top panel, lumpy endcaps, blobby goods; alone-close: floating black geometry artifacts above top shelf, warped lumpy frame; table: undersized with goods only at base and empty top
- store-shelving / Meshy 7.1: room-close: swollen puffy shelf edges, bulging endcaps, top triangulation specular artifacts; alone-close: pinched creased top surface, visible triangulation seams; table: goods are blurry low-resolution texture clusters
- store-shelving / Meshy ST: room-close: slight shelf waviness, low texture resolution, faceted top ridge; alone-close: simplified low-poly goods, solid-color textures; table: undersized with goods only at base and empty top
- server-rack / current: alone-close: underexposed near-black texture, blobby handle, completely missing status lights; room-close: ragged faceted cables, smeared texture, status lights barely visible; table: squat generator-like form with bulky top conduits
- server-rack / TRELLIS regen: room-close: collapsed hollowed top cable troughs, washed out textures, missing status lights; alone-close: excessively dark texture, blobby lumpy silhouette, status lights barely discernible; table: status lights are small and faint from table distance
- server-rack / Meshy 7.1: room-close: poor framing showing only top cables, front status lights not visible; alone-close: slight corner asymmetry, stylized painterly finish; table: squat generator-like form with bulky top conduits
- server-rack / Meshy ST: room-close: prominent top cables dominate silhouette, status lights mostly occluded; alone-close: dark front panel, smudged status lights, thick top cable bundle; table: status lights are small and faint from table distance
- drinks-cooler / current: alone-close: triangular crease artifact on side panel, blank lightbox header; room-close: soft textures at distance, repetitive stock arrangement across units; table: individual bottles are clustered texture pixels
- drinks-cooler / TRELLIS regen: alone-close: blurry smudged interior without distinct bottles, opaque door texture; room-close: completely blacked-out front, no glass doors or bottles visible; table: opaque dark fronts lacking glass doors and bottles
- drinks-cooler / Meshy 7.1: alone-close: slight waviness on door frame, simplified bottle caps; room-close: crumpled faceted metal panels, zero glass or bottles, fails to read as cooler; table: grotesquely stretched solid grey monoliths with no glass or bottles
- drinks-cooler / Meshy ST: room-close: missing glass doors and bottles entirely, monolithic blank flat panels; alone-close: low-poly bottle primitives, blank header box; table: opaque grey cabinet fronts lacking glass doors and bottles
- pallet-racking / current: alone-close: excessively dark lighting, obscured lower tier details, chunky frame profile; room-close: room perspective view, slight shadow darkness on lower shelf; table: simplified box geometry and repetitive textures
- pallet-racking / TRELLIS regen: alone-close: blocky upright posts, soft corner geometry, dark lighting; room-close: viewed at distance in room, minor mesh simplification on boxes; table: simplified box geometry and repetitive textures
- pallet-racking / Meshy 7.1: alone-close: faceted crinkles on shrinkwrapped loads, minor texture bleeding at brackets; room-close: partial framing showing side profile, partial foreground occlusion; table: massively oversized scale towers over walls
- pallet-racking / Meshy ST: room-close: slight poly faceting on shelf beams, minor texture stretching on shrinkwrap; alone-close: slight polygon faceting on beam corners, minor texture smearing on pallet underside; table: simplified box geometry and repetitive textures
- fence-chain-link / current: room-close: distant perspective, heavy framing obscuring wire mesh; alone-close: dark underexposed texture, low contrast, thick lattice junctions; table: dark rusty mesh blends into corner shadows
- fence-chain-link / TRELLIS regen: room-close: small scale in room view, heavy frame obscuring chain link; alone-close: melted and warped wire mesh, irregular lattice spacing, uneven post tops; table: dark rusty mesh blends into corner shadows
- fence-chain-link / Meshy 7.1: alone-close: thick wire mesh, dark monotone rust texture; room-close: distant room view, low mesh visibility; table: dark rusty mesh blends into corner shadows
- fence-chain-link / Meshy ST: alone-close: thick mesh wires, painted hazard stripes on posts; room-close: distant perspective in room, shadowed gate area; table: dark rusty mesh blends into corner shadows
- antenna-mast / current: alone-close: dark underexposed lighting, muted colors, obscured shadow details; room-close: room view perspective, slightly heavy strut thickness; table: too short and dark without clear red-white lattice
- antenna-mast / TRELLIS regen: room-close: chunky lattice struts, slight texture bleeding between red and white bands; alone-close: chunky diagonal members, low polygon count on top beacon dome; table: somewhat stocky proportions and simplified beacon
- antenna-mast / Meshy 7.1: room-close: close framing cuts off top beacon, slight texture blur on internal crossbars; alone-close: top antenna array cropped out, chunky bolt geometry; table: slightly chunky top antenna fittings
- antenna-mast / Meshy ST: alone-close: thick lattice struts, slight texture seam on diagonal braces; room-close: room view perspective, thick bracing members; table: slightly chunky lattice members and simplified apex
