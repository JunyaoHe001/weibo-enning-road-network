# Enning Road Weibo Network

A browser-based temporal network atlas for the Mashi Street Protection Movement within Guangzhou's Enning Road regeneration controversy.

**Live atlas:** https://junyaohe001.github.io/weibo-enning-road-network/

The interface reproduces the structure and temporal accumulation of a directed Weibo forwarding network without publishing message text, usernames, profile names, or original account identifiers. It is designed as a compact research visualisation with controls on the left and the network graph on the right.

## Research context

The atlas accompanies:

> He, J., Lin, Y., Hooimeijer, P., & Monstadt, J. (2024). Informal participation in digital planning: How can third parties use social media to shift power relations in planning? *Computers, Environment and Urban Systems, 114*, 102193. https://doi.org/10.1016/j.compenvurbsys.2024.102193

The article examines how third parties, especially civil society and journalism, use social media to mobilise participants, form communities, connect online and offline action, and influence planning priorities.

## Atlas functions

- Accumulate the network through non-empty ten-minute activity intervals.
- Switch between the core movement period and all structurally valid records in the supplied analysis backup.
- View the cumulative network or one selected interval.
- Play, pause, step, or jump through the activity sequence.
- Focus on the whole network, the published `Media-1` ego network, or the published `CSO-1` ego network.
- Filter to the largest weak component or retain all components.
- Size nodes by degree, weighted degree, HITS hub, HITS authority, betweenness, or PageRank.
- Colour nodes by recomputed structural community, first appearance, or published actor role.
- Pan, zoom, and click a node to highlight its direct neighbourhood.

## Public data boundary

This repository publishes only:

- random public node identifiers generated independently of the source identifiers;
- directed source-target structure;
- interaction weights;
- timestamps rounded down to ten-minute intervals;
- recomputed layout, community, and centrality values;
- two role labels already used in the published article: `Media-1` and `CSO-1`.

It does **not** publish:

- Weibo message or repost text;
- usernames, nicknames, profile names, or biographies;
- original numeric or platform identifiers;
- original-to-public identifier mappings;
- the supplied spreadsheets or Gephi project;
- any cross-platform identity links.

See [SANITISATION.md](SANITISATION.md) and [DATA-NOTES.md](DATA-NOTES.md).

## Backup coverage

The supplied structurally valid analysis backup contains:

- 1,002 directed edge records;
- 1,124 distinct nodes;
- 1,010 weighted interactions;
- 178 non-empty ten-minute activity intervals.

The published article reports the initial collection as 1,038 retweets and 1,147 users. The atlas therefore documents and visualises the supplied backup rather than claiming to recreate every record in the initial collection.

## Repository structure

```text
index.html                 Interactive atlas
assets/app.js              Network interaction and rendering
assets/styles.css          Interface styling
data/meta.json             Public metadata and rounded timeline
data/nodes.json            Anonymised nodes and recomputed metrics
data/edges.json            Anonymised directed ties
docs/data-and-privacy.html Public-facing data note
preview/                   Screenshots
```

## Local preview

A local web server is required because the page loads JSON files with `fetch`:

```bash
python -m http.server 8000
```

Then open `http://localhost:8000/`.

## Licences and data use

Code is released under the MIT License. The public network data are provided for inspection and research communication under the conditions in [DATA-USE-NOTICE.md](DATA-USE-NOTICE.md). The source data remain excluded.
