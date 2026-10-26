#!/usr/bin/env python3
"""Refresh the phone's static photo library after adding artwork to assets/."""
import hashlib
import io
import json
import re
import subprocess
import xml.etree.ElementTree as ET
from pathlib import Path
from urllib.parse import quote

from PIL import Image, ImageOps

ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / 'assets'
OUTPUT = ROOT / 'photos'
EXTENSIONS = {'.webp', '.png', '.jpg', '.jpeg', '.svg', '.ico', '.gif', '.avif'}
PRIORITY = ['Banner 16x9.webp', 'Banner 9x19.5.webp', 'Backdrop (1).webp',
            'madokafinal.webp', 'madoka standee.webp', 'madoka standee2.webp']
SVG = '{http://www.w3.org/2000/svg}'


def load_svg(path):
    tree = ET.fromstring(path.read_bytes())
    symbols = tree.findall(f'{SVG}symbol')
    if symbols:
        # A symbol sheet has no visible root canvas. Show its symbols together.
        tree.set('width', '512')
        tree.set('height', str(((len(symbols) + 3) // 4) * 128))
        tree.set('viewBox', f'0 0 512 {((len(symbols) + 3) // 4) * 128}')
        for i, symbol in enumerate(symbols):
            icon = ET.SubElement(tree, f'{SVG}svg', {
                'x': str(i % 4 * 128 + 16), 'y': str(i // 4 * 128 + 16),
                'width': '96', 'height': '96', 'viewBox': symbol.get('viewBox', '0 0 60 60'),
            })
            ET.SubElement(icon, f'{SVG}use', {'href': '#' + symbol.get('id')})
        svg = ET.tostring(tree)
    else:
        svg = path.read_bytes()
    rendered = subprocess.run(
        ['rsvg-convert', '--unlimited', '--keep-aspect-ratio', '--width', '1600', '--height', '1600'],
        input=svg, capture_output=True, check=True,
    )
    return Image.open(io.BytesIO(rendered.stdout)).convert('RGBA')


def source_size(path, image):
    if path.suffix.lower() != '.svg':
        return image.size
    tree = ET.fromstring(path.read_bytes())
    try:
        return tuple(int(float(tree.get(key))) for key in ('width', 'height'))
    except (TypeError, ValueError):
        return image.size


def photo_group(path):
    if path.parent.name == 'favicon_io':
        return 'marks'
    if path.parent.name == 'credits':
        return 'people'
    if path.parent.name == 'ios7' or path.suffix.lower() == '.svg':
        return 'phone'
    return 'event'


def sort_key(path):
    if path.parent == ASSETS and path.name in PRIORITY:
        return (0, PRIORITY.index(path.name), '')
    group = {'event': 1, 'people': 2, 'phone': 3, 'marks': 4}[photo_group(path)]
    return (group, 0, str(path.relative_to(ASSETS)).casefold())


def main():
    (OUTPUT / 'thumbs').mkdir(parents=True, exist_ok=True)
    (OUTPUT / 'previews').mkdir(parents=True, exist_ok=True)
    files = sorted((p for p in ASSETS.rglob('*') if p.is_file()
                    and p.suffix.lower() in EXTENSIONS), key=sort_key)
    entries = []
    for path in files:
        relative = path.relative_to(ROOT).as_posix()
        digest = hashlib.sha256(path.read_bytes()).hexdigest()[:12]
        identifier = hashlib.sha256(relative.encode()).hexdigest()[:12]
        stem = f'{identifier}-{digest}'
        thumb_path = OUTPUT / 'thumbs' / f'{stem}.webp'
        preview_path = OUTPUT / 'previews' / f'{stem}.webp'
        image = load_svg(path) if path.suffix.lower() == '.svg' else Image.open(path).convert('RGBA')
        image = ImageOps.exif_transpose(image)
        width, height = source_size(path, image)
        transparent = image.getextrema()[3][0] < 255

        thumbnail = Image.new('RGBA', (180, 180))
        reduced = ImageOps.contain(image, (180, 180), Image.Resampling.LANCZOS)
        thumbnail.alpha_composite(reduced, ((180 - reduced.width) // 2, (180 - reduced.height) // 2))
        if not thumb_path.exists():
            thumbnail.save(thumb_path, 'WEBP', quality=80, method=6)
        image.thumbnail((1600, 1600), Image.Resampling.LANCZOS)
        if not preview_path.exists():
            image.save(preview_path, 'WEBP', quality=87, method=6)
        entries.append({
            'id': identifier, 'name': path.name, 'group': photo_group(path),
            'source': quote(relative, safe='/'),
            'thumb': thumb_path.relative_to(ROOT).as_posix(),
            'preview': preview_path.relative_to(ROOT).as_posix(),
            'width': width, 'height': height, 'transparent': transparent,
            'light': not bool(re.search(r'white', path.name, re.I)),
        })
    (OUTPUT / 'library.json').write_text(json.dumps(entries, ensure_ascii=False, indent=2) + '\n')
    print(f'{len(entries)} photos; thumbnails {sum(p.stat().st_size for p in (OUTPUT / "thumbs").glob("*.webp")):,} bytes')


if __name__ == '__main__':
    main()
