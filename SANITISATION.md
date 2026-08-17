# Sanitisation and disclosure controls

## Purpose

This repository provides a public structural visualisation of a social-media interaction network while excluding source content and account-level identity information.

## Removed fields

The following source fields were removed before the public files were generated:

- post, repost, and message text;
- account usernames and display names;
- original node identifiers;
- profile metadata;
- source spreadsheet row identifiers;
- raw timestamps at minute or second precision;
- unused Gephi attributes containing source labels or text.

The original spreadsheets and Gephi project are not copied into this repository.

## Identifier replacement

Each node was assigned a new public identifier in the form `ER####`. The assignment used a fresh random permutation and is unrelated to source ordering, source IDs, names, degree ranking, or time of appearance.

The original-to-public mapping was used only transiently during preparation. It was not written to disk and is not included in the release package or repository.

## Retained published roles

The article discusses two structurally important actor categories as `Media-1` and `CSO-1`. Those role labels are retained because they are part of the published analysis. The corresponding account names, usernames, original IDs, and profile information are not published.

All other nodes are labelled only as anonymised actors and may be displayed through their random public identifiers.

## Temporal reduction

Activity timestamps are rounded down to ten-minute intervals in China Standard Time. The atlas does not expose the original minute- or second-level timestamps.

The timeline contains only intervals with at least one structurally valid directed record. Playback therefore represents the sequence of observed active intervals, not a continuous clock with empty intervals.

## Recomputed values

The public release recomputes the following values from anonymised structure:

- ForceAtlas2 layout;
- Louvain communities;
- degree and weighted degree;
- PageRank;
- betweenness centrality;
- HITS hub and authority scores;
- weak-component membership.

These values do not require message text or account names.

## Residual limitations

The public files retain network topology. In principle, a person with independent access to the original network and sufficient auxiliary information could attempt structural matching. The release reduces disclosure by removing identity fields, replacing IDs, rounding time, withholding the mapping, and excluding the raw files. It does not claim formal differential privacy or legal certification of anonymisation.

No public interface or download endpoint exposes source text, original IDs, usernames, or the identifier mapping.
