"""Validate downloaded media and assemble continuous Listening tracks.

Requires imageio-ffmpeg (python -m pip install imageio-ffmpeg).
The original question tracks are retained for individual Part practice.
"""
from hashlib import sha256
import json
import math
from pathlib import Path
import subprocess
import tempfile
import wave

import imageio_ffmpeg
from download_toeicbuilding import DATA, ROOT, convert, write_json

RATE = 22050
PART_COUNTS = [6, 25, 39, 30, 30, 16, 54]


def media_path(url):
    return DATA / 'media' / url.rsplit('/', 1)[-1]


def assemble(playlist):
    # Match the source player's three-second pause after each question group.
    identity = json.dumps({'playlist': playlist, 'gap': 3, 'version': 1}, sort_keys=True)
    name = sha256(identity.encode()).hexdigest() + '.mp3'
    target = DATA / 'media' / name
    metadata = DATA / 'audio-metadata' / (name + '.json')
    if target.exists() and metadata.exists():
        return name, json.loads(metadata.read_text())['durationSeconds']
    executable = imageio_ffmpeg.get_ffmpeg_exe()
    total_frames = 0
    with tempfile.TemporaryDirectory(prefix='toeic-audio-') as temporary:
        wav = Path(temporary) / 'listening.wav'
        with wave.open(str(wav), 'wb') as out:
            out.setnchannels(1)
            out.setsampwidth(2)
            out.setframerate(RATE)
            for track in playlist:
                decoded = subprocess.run([executable, '-v', 'error', '-i', str(media_path(track['url'])),
                                          '-f', 's16le', '-ac', '1', '-ar', str(RATE), 'pipe:1'], capture_output=True)
                if decoded.returncode or not decoded.stdout:
                    raise ValueError('Cannot decode audio: ' + track['url'])
                out.writeframesraw(decoded.stdout)
                total_frames += len(decoded.stdout) // 2
                if track['kind'] == 'questions':
                    out.writeframesraw(bytes(RATE * 3 * 2))
                    total_frames += RATE * 3
        encoded = subprocess.run([executable, '-v', 'error', '-y', '-i', str(wav), '-codec:a', 'libmp3lame',
                                  '-b:a', '64k', '-f', 'mp3', str(target.with_suffix('.part'))], capture_output=True)
        if encoded.returncode:
            raise ValueError('Cannot encode continuous Listening audio')
        target.with_suffix('.part').replace(target)
    duration = total_frames / RATE
    write_json(metadata, {'durationSeconds': duration, 'gapSeconds': 3, 'sourceTracks': playlist})
    return name, duration


def main():
    catalog = json.loads((ROOT / 'imports/toeicbuilding/catalog.json').read_text(encoding='utf-8'))
    assets, library, reports = {}, [], []
    for entry in catalog['entries']:
        selection = DATA / 'source' / (entry['sourceId'] + '-parts.html')
        quiz = DATA / 'source' / (entry['sourceId'] + '-quiz.html')
        if not selection.exists() or not quiz.exists():
            continue
        try:
            test, _ = convert(entry, selection.read_text(encoding='utf-8'), quiz.read_text(encoding='utf-8'), assets)
        except Exception as error:
            reports.append({'id': entry['sourceId'], 'excluded': str(error)})
            continue
        questions = test['questions']
        if test['sourceIssues']:
            reports.append({'id': test['id'], 'excluded': test['sourceIssues']})
            continue
        missing = sorted({q[field] for q in questions for field in ('audioUrl', 'imageUrl')
                          if q.get(field) and not media_path(q[field]).exists()})
        missing = sorted(set(missing) | {p['url'] for p in test['listeningPlaylist'] if not media_path(p['url']).exists()})
        for q in questions:
            if any(q.get(field) in missing for field in ('audioUrl', 'imageUrl')):
                q['sourceWarning'] = 'File h\u00ecnh / audio t\u1eeb ngu\u1ed3n kh\u00f4ng t\u1ea3i \u0111\u01b0\u1ee3c (l\u1ed7i 404).'
            if q['part'] <= 4 and not q.get('audioUrl'):
                q['sourceWarning'] = 'Ngu\u1ed3n ch\u01b0a c\u00f3 audio cho c\u00e2u / nh\u00f3m c\u00e2u n\u00e0y.'
            if (q['part'] == 1 or q['part'] >= 6) and not q.get('imageUrl') and not q.get('passage'):
                q['sourceWarning'] = 'Ngu\u1ed3n ch\u01b0a c\u00f3 h\u00ecnh / b\u00e0i \u0111\u1ecdc cho c\u00e2u n\u00e0y.'
        report = {'id': test['id'], 'title': test['title'], 'questions': len(questions), 'missingMedia': missing,
                  'warnings': [{'number': q['number'], 'message': q['sourceWarning']} for q in questions if q.get('sourceWarning')]}
        expected = [part for part, count in enumerate(PART_COUNTS, 1) for _ in range(count)]
        complete = ([q['part'] for q in questions] == expected and all(q.get('audioUrl') for q in questions[:100])
                    and all(q.get('imageUrl') or q.get('passage') for q in questions if q['part'] == 1 or q['part'] >= 6)
                    and not any(q.get('sourceIncomplete') for q in questions))
        if complete and not missing and test['listeningPlaylist']:
            try:
                name, duration = assemble(test['listeningPlaylist'])
                report['listeningDurationSeconds'] = round(duration, 2)
                if duration <= 3600:
                    test['listeningAudioUrl'] = '/api/toeic/media/' + name
                    test['listeningDurationSeconds'] = math.ceil(duration)
                else:
                    report['fullTestUnavailable'] = 'Source audio exceeds the supported 60-minute Listening window.'
            except Exception as error:
                report['audioError'] = str(error)
        elif not complete:
            report['fullTestUnavailable'] = 'Incomplete question or audio structure in the source.'
        report['fullAvailable'] = bool(test.get('listeningAudioUrl'))
        reports.append(report)
        test.pop('sourceIssues')
        test.pop('listeningPlaylist')
        library.append(test)
        print(f"{test['title']}: {len(questions)} questions; full={report['fullAvailable']}; missing={len(missing)}", flush=True)
    write_json(DATA / 'library-report.json', reports)
    candidate = DATA / 'library.candidate.json'
    write_json(candidate, library)
    validation = subprocess.run(['node', '-e', """
const fs = require('fs');
const {toeicQuestionSchema} = require('./packages/shared/dist');
const tests = JSON.parse(fs.readFileSync(process.argv[1], 'utf8'));
for (const test of tests) {
  if (!test.questions.length || test.questions.length > 200) throw new Error(test.id + ': invalid question count');
  if (new Set(test.questions.map(q => q.id)).size !== test.questions.length) throw new Error(test.id + ': duplicate IDs');
  for (const question of test.questions) toeicQuestionSchema.parse(question);
}
""", str(candidate)], cwd=ROOT, capture_output=True)
    if validation.returncode:
        raise ValueError('Library validation failed; existing library was not replaced: ' + validation.stderr.decode(errors='replace')[:2000])
    candidate.replace(DATA / 'library.json')
    print(f"Prepared {len(library)} tests, {sum(len(t['questions']) for t in library)} questions.", flush=True)


if __name__ == '__main__':
    main()
