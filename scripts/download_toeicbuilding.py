"""Download the visible TOEIC catalog using an existing authenticated cookie jar.

No credentials are stored by this script. Private downloads live under backend/data.
Run from the repository root: python scripts/download_toeicbuilding.py
"""
import argparse
from concurrent.futures import ThreadPoolExecutor, as_completed
from hashlib import sha256
from html import unescape
from html.parser import HTMLParser
import json
from pathlib import Path
import re
import subprocess
import time
from urllib.parse import urlencode, quote, urlsplit

BASE = "https://test.toeicbuilding.com.vn"
ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "backend/data/toeicbuilding"


def write_json(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix(path.suffix + ".tmp")
    temporary.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    temporary.replace(path)


def fetch(url, destination, cookies=True):
    if urlsplit(url).hostname != urlsplit(BASE).hostname:
        raise ValueError("Unexpected source host")
    destination.parent.mkdir(parents=True, exist_ok=True)
    temporary = destination.with_suffix(destination.suffix + ".part")
    args = ["curl.exe", "--fail", "--silent", "--show-error", "--location",
            "--proto", "=https", "--proto-redir", "=https", "--max-time", "90",
            "--retry", "2", "--retry-delay", "2", "--output", str(temporary),
            "--write-out", "%{http_code}"]
    if cookies:
        args += ["--cookie", str(DATA / "session.cookies")]
    result = subprocess.run(args + [url], capture_output=True)
    if result.returncode or result.stdout.decode().strip() != "200":
        temporary.unlink(missing_ok=True)
        raise RuntimeError("Download failed: " + url + " (HTTP " + result.stdout.decode().strip() + ")")
    temporary.replace(destination)


class QuestionsParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.questions = []

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == "li" and "data-question" in attrs:
            self.questions.append(json.loads(attrs["data-question"]))


class PlainText(HTMLParser):
    def __init__(self):
        super().__init__()
        self.pieces = []

    def handle_starttag(self, tag, attrs):
        if tag in ("br", "p", "div", "li", "tr"):
            self.pieces.append("\n")

    def handle_endtag(self, tag):
        if tag in ("p", "div", "li", "tr"):
            self.pieces.append("\n")

    def handle_data(self, data):
        self.pieces.append(data)


def plain(value):
    parser = PlainText()
    parser.feed(value or "")
    value = "".join(parser.pieces).replace("\xa0", " ")
    return re.sub(r"\n\s*\n+", "\n\n", value).strip()


def asset(url, assets):
    url = url.replace(BASE + "//", BASE + "/")
    suffix = Path(urlsplit(url).path).suffix.lower()
    if suffix not in (".mp3", ".wav", ".ogg", ".png", ".jpg", ".jpeg", ".webp", ".gif"):
        raise ValueError("Unsupported source media: " + url)
    name = sha256(url.encode()).hexdigest() + suffix
    assets[name] = url
    return "/api/toeic/media/" + name


def convert(entry, selection, page, assets):
    parts = {}
    for row in re.findall(r"<tr\b[^>]*>(.*?)</tr>", selection, re.S):
        part_id = re.search(r'name="part_ids\[\]" value="(\d+)"', row)
        part = re.search(r"<td>\s*Part\s+(\d+)\s*</td>", row)
        if part_id and part:
            parts[int(part_id[1])] = int(part[1])
    parser = QuestionsParser()
    parser.feed(page)
    source = parser.questions
    if not source or len({q['id'] for q in source}) != len(source):
        raise ValueError("No questions or duplicate source IDs")
    by_id = {q['id']: q for q in source}
    questions, issues, playlist = [], [], []
    brief_audio = {}
    for block in re.split(r'<div class="row mt-3 brief-part"', page)[1:]:
        part_id = re.search(r'data-id="(\d+)"', block)
        block = block.split('class="row mt-3 brief-part"')[0]
        audio = re.search(r'<source src="([^"]+)"', block)
        if part_id and audio and int(part_id[1]) in parts and parts[int(part_id[1])] <= 4:
            brief_audio[parts[int(part_id[1])]] = asset(unescape(audio[1]), assets)
    last_part = None
    for number, q in enumerate(source, 1):
        part = parts[q['part_id']]
        parent = by_id.get(q.get('cauhoi_id'), q)
        # Some source rows omit the parent link. Recover only from an explicit
        # question range in an earlier media filename, within the same Part.
        if part >= 3 and not (parent.get('hinh') or parent.get('audio')):
            for candidate in reversed(source[:number - 1]):
                if candidate['part_id'] != q['part_id']:
                    break
                filenames = (candidate.get('hinh') or '') + ' ' + (candidate.get('audio') or '')
                ranges = re.findall(r'(?<!\d)(\d{1,3})-(\d{1,3})(?!\d)', filenames)
                if any(int(start) <= number <= int(end) for start, end in ranges):
                    parent = candidate
                    break
        count = 3 if part == 2 else 4
        fields = [plain(q.get('cau' + str(i))) for i in range(1, 6)]
        options = fields[:count]
        if count == 4 and fields[4] and not all(options):
            compact = [value for value in fields if value]
            if len(compact) == 4:
                options = compact
        correct = plain(q.get('cau_dung'))
        matches = [i for i, value in enumerate(options) if value and value == correct]
        accepted_answers = ['ABCD'[i] for i in matches]
        warning = None
        if len(matches) > 1:
            label = re.match(r'^\(?([ABCD])[).]', correct)
            if label and 'ABCD'.index(label[1]) in matches:
                matches = ['ABCD'.index(label[1])]
                warning = 'Ngu\u1ed3n c\u00f3 l\u1ef1a ch\u1ecdn tr\u00f9ng nhau. C\u00e1c l\u1ef1a ch\u1ecdn tr\u00f9ng n\u1ed9i dung \u0111\u00e1p \u00e1n \u0111\u00fang \u0111\u1ec1u \u0111\u01b0\u1ee3c ch\u1ea5p nh\u1eadn.'
        if len(matches) != 1:
            issues.append(f"Question {number}: ambiguous or missing answer")
        answer = "ABCD"[matches[0]] if len(matches) == 1 else None
        incomplete = [i for i, value in enumerate(options) if not value]
        image_choices = bool(q.get('hinh') or parent.get('hinh'))
        # Letter-only choices are intentional when their text is in audio/images.
        for index in incomplete:
            options[index] = 'ABCD'[index] if part <= 2 or image_choices else '[Source missing option ' + 'ABCD'[index] + ']'
        item = {'id': f"tb-{entry['sourceId']}-{q['id']}", 'number': number, 'part': part,
                'prompt': plain(q.get('ten')), 'options': [re.sub(r'^\(?[ABCD][).]\s*', '', value) or 'ABCD'[i] for i, value in enumerate(options)], 'answer': answer}
        if warning:
            item['sourceWarning'] = warning
            item['acceptedAnswers'] = accepted_answers
        if len(set(item['options'])) < len(item['options']):
            item['sourceWarning'] = 'Ngu\u1ed3n c\u00f3 l\u1ef1a ch\u1ecdn tr\u00f9ng n\u1ed9i dung. C\u00e1c l\u1ef1a ch\u1ecdn tr\u00f9ng \u0111\u00e1p \u00e1n \u0111\u00fang \u0111\u1ec1u \u0111\u01b0\u1ee3c ch\u1ea5p nh\u1eadn.'
            if answer:
                correct_text = item['options']['ABCD'.index(answer)]
                item['acceptedAnswers'] = ['ABCD'[i] for i, value in enumerate(item['options']) if value == correct_text]
        if incomplete and part >= 3 and not image_choices:
            item['sourceWarning'] = 'Ngu\u1ed3n thi\u1ebfu n\u1ed9i dung l\u1ef1a ch\u1ecdn ' + ', '.join('ABCD'[i] for i in incomplete) + '.'
            item['sourceIncomplete'] = True
        if parent.get('child') or parent['id'] != q['id']:
            item['groupId'] = f"tb-{entry['sourceId']}-{parent['id']}"
        image = q.get('hinh') or parent.get('hinh')
        if image:
            item['imageUrl'] = asset(BASE + '/images/' + quote(image), assets)
        audio = q.get('audio') or parent.get('audio')
        if audio:
            item['audioUrl'] = asset(BASE + '/audio/' + quote(audio), assets)
        explanation = plain(q.get('giai_thich'))
        if explanation:
            item['explanation'] = explanation
        if part <= 4 and part != last_part and part in brief_audio:
            playlist.append({'url': brief_audio[part], 'part': part, 'kind': 'directions'})
        if part <= 4 and audio and (not playlist or playlist[-1]['url'] != item['audioUrl']):
            playlist.append({'url': item['audioUrl'], 'part': part, 'kind': 'questions', 'firstQuestion': number})
        last_part = part
        questions.append(item)
    title = entry['title']
    if entry['category'] and entry['category'].lower() not in title.lower():
        title = entry['category'] + ' - ' + title
    return {'id': 'toeicbuilding-' + entry['sourceId'], 'title': title, 'sourceName': 'TOEIC Building',
            'sourceUrl': entry['sourceUrl'], 'kind': 'imported', 'category': entry['category'],
            'questions': questions, 'sourceIssues': issues, 'listeningPlaylist': playlist}, source


def download_media(name, url):
    destination = DATA / 'media' / name
    if not destination.exists():
        fetch(url, destination)
    with destination.open('rb') as file:
        prefix = file.read(256).lstrip().lower()
    if not prefix or prefix.startswith((b'<!doctype', b'<html', b'{')):
        destination.unlink(missing_ok=True)
        raise ValueError('Invalid media response: ' + url)
    return destination.stat().st_size


def main():
    args = argparse.ArgumentParser()
    args.add_argument('--all', action='store_true', help='Include supplementary practice catalogs')
    args.add_argument('--metadata-only', action='store_true')
    options = args.parse_args()
    catalog = json.loads((ROOT / 'imports/toeicbuilding/catalog.json').read_text(encoding='utf-8'))
    entries = [e for e in catalog['entries'] if options.all or (e['category'] or '').startswith('ETS ')]
    assets, tests, failures = {}, [], []
    for i, entry in enumerate(entries):
        try:
            selection_path = DATA / 'source' / (entry['sourceId'] + '-parts.html')
            page_path = DATA / 'source' / (entry['sourceId'] + '-quiz.html')
            if not selection_path.exists():
                fetch(entry['sourceUrl'], selection_path)
            selection = selection_path.read_text(encoding='utf-8')
            part_ids = re.findall(r'name="part_ids\[\]" value="(\d+)"', selection)
            if not part_ids:
                selection_path.unlink(missing_ok=True)
                raise ValueError('No accessible parts; login may be required')
            if not page_path.exists():
                fields = [('test', entry['sourceId']), ('time_limit', '120')] + [('part_ids[]', p) for p in part_ids]
                fetch(BASE + '/quizz?' + urlencode(fields), page_path)
            document, raw = convert(entry, selection, page_path.read_text(encoding='utf-8'), assets)
            write_json(DATA / 'raw' / (entry['sourceId'] + '.json'), raw)
            write_json(DATA / 'tests' / (document['id'] + '.json'), document)
            tests.append(document)
            print(f"[{i+1}/{len(entries)}] {document['title']}: {len(document['questions'])} questions, {len(document['sourceIssues'])} issues", flush=True)
        except Exception as error:
            failures.append({'sourceId': entry['sourceId'], 'error': str(error)})
            print(f"[{i+1}/{len(entries)}] FAILED {entry['sourceId']}: {error}", flush=True)
        time.sleep(0.2)
    write_json(DATA / 'assets.json', assets)
    write_json(DATA / 'download-report.json', {'tests': len(tests), 'assets': len(assets), 'failures': failures})
    if options.metadata_only:
        return
    total_bytes, media_failures = 0, []
    with ThreadPoolExecutor(max_workers=6) as pool:
        jobs = {pool.submit(download_media, name, url): name for name, url in assets.items()}
        for i, job in enumerate(as_completed(jobs), 1):
            try:
                total_bytes += job.result()
            except Exception as error:
                media_failures.append({'name': jobs[job], 'error': str(error)})
            if i % 100 == 0 or i == len(jobs):
                print(f"Media {i}/{len(jobs)}; {total_bytes // 1048576} MiB; {len(media_failures)} failures", flush=True)
                write_json(DATA / 'download-report.json', {'tests': len(tests), 'assets': len(assets), 'downloaded': i - len(media_failures), 'bytes': total_bytes, 'failures': failures, 'mediaFailures': media_failures})
    print('Download complete. Validate before publishing the local library.', flush=True)


if __name__ == '__main__':
    main()
