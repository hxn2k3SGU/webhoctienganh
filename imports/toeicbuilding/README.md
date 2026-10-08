# Local TOEIC Building library

The public catalog is in `catalog.json`. Private question data, answer keys, source
snapshots and downloaded media are stored in `backend/data/toeicbuilding/`, which
is excluded from Git. Copy this directory when moving the app to another machine.

The backend loads `library.json` from the `toeicbuilding` directory next to the
main account database. All signed-in users on this installation can use the
library; attempts and results remain private to each account. Media requests
require the app's normal authentication and support byte ranges for audio seeking.

## Download and prepare

Run these commands from the repository root:

```powershell
npm run build
python -m pip install imageio-ffmpeg
python scripts/download_toeicbuilding.py
python scripts/prepare_toeicbuilding.py
```

The downloader expects a Netscape-format authenticated cookie jar at
`backend/data/toeicbuilding/session.cookies`. It does not store a password. Delete
the temporary cookie jar after downloading. Completed downloads are reused on
reruns. By default, it downloads the 55 catalog entries labeled ETS; `--all` also
includes supplementary lessons, dictation and placement exercises, which can
require additional format handling.

The preparation command validates question data before replacing `library.json`.
It preserves passage images, question/group audio, answer keys and explanations.
Full Listening tracks combine the source directions and question clips, with the
source player's three-second gap after each question group. Source tracks remain
available for practice. Listening runs for at least 45 minutes and extends to the
actual assembled audio duration when needed; Reading remains 75 minutes. Tests
with missing content stay available for practice without enabling full mode.

## Reports

- `download-report.json`: download totals and failed URLs.
- `library-report.json`: per-test completeness, media failures and source warnings.
- `audio-metadata/`: continuous track durations and ordered source clips.
- `raw/`: original structured question records for checking conversion.
- `media/`: images, original audio clips and assembled Listening tracks.

Conversion preserves source defects explicitly. If the same correct option is
duplicated, either identical option is accepted. Missing text is labeled; the
converter does not invent questions or explanations. Broken group references are
recovered only when an earlier source filename explicitly names the question range.

Validation:

```powershell
python scripts/test_toeicbuilding.py
npm run test -w @lexiloop/backend -- tests/toeic.test.ts tests/toeic-library.test.ts
npm run test -w @lexiloop/frontend -- tests/ToeicPage.test.tsx
npm run typecheck
npx tsx scripts/verify_toeicbuilding.ts
```

The latest completed download contains 55 tests / 11,000 questions, with 49 tests
enabled for full mode. Six practice-only tests have source defects: ETS 2023 Test
3; ETS 2024 Tests 9 and 10; ETS 2026 Tests 4, 5 and 8. Four linked media files
return HTTP 404 at the source. The local report lists the affected questions.
