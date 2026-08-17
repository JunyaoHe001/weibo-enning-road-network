# Data notes

## Source material used privately

The atlas was prepared from the supplied analysis backups:

- a directed edge workbook containing interaction records and timing fields;
- a workbook summarising non-empty activity intervals;
- a Gephi project used during the original analysis.

These files contain source labels and account information and are therefore excluded from the public repository.

## Public record counts

After structural validation of the supplied edge workbook, the public atlas contains:

| Measure | Public atlas |
|---|---:|
| Directed edge records | 1,002 |
| Distinct anonymised nodes | 1,124 |
| Sum of interaction weights | 1,010 |
| Non-empty ten-minute intervals | 178 |
| Weak components | 128 |
| Nodes in largest weak component | 812 |

The core movement filter covers 21–28 September 2012 and contains 993 directed records and 1,113 nodes. A small number of structurally valid records in the supplied backup occur after this period and can be viewed through the extended-record option.

## Difference from the article's initial collection

The article reports an initial collection of 1,038 retweets and 1,147 users. The current atlas uses the structurally valid records available in the supplied analysis backup. The difference is stated in the interface and documentation rather than silently treating the backup as identical to the initial collection.

## Directed ties

Each edge represents a forwarding relation from one anonymised account to another. Parallel source-target records were not present in the supplied structural backup. The retained weight field records interaction intensity where the source workbook supplied a value greater than one.

## Time representation

- Time zone: China Standard Time, UTC+08:00.
- Public precision: ten-minute interval.
- Timeline: non-empty intervals only.
- Default scope: core movement, 21–28 September 2012.
- Optional scope: all structurally valid supplied records, ending in March 2013.

## Community and layout methods

The original Gephi project is not distributed. For the public atlas, layout and communities were recomputed from anonymised topology:

- layout: ForceAtlas2 with a fixed seed for reproducible positioning;
- community display: Louvain partition with a fixed seed;
- peripheral small communities are grouped into an `Other` display category while their structural community values remain available internally.

## Interpretation

The atlas supports exploration of network formation, activity timing, centrality, communities, and the published `Media-1` and `CSO-1` ego networks. It does not reproduce message content, sentiment, discourse, or qualitative evidence from the article.
