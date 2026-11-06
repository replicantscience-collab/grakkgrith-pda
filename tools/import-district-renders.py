"""Import completed candidate renders listed in docs/district-render-sources.json."""
import json
import sys
from pathlib import Path
from PIL import Image

root = Path(__file__).resolve().parents[1]
sources = json.loads(Path(sys.argv[1]).read_text(encoding='utf-8'))
progress_path = root / 'docs/district-render-progress.json'
progress = json.loads(progress_path.read_text(encoding='utf-8'))
places_path = root / 'data/places.json'
places = json.loads(places_path.read_text(encoding='utf-8'))
for source in sources:
    district_id = source['id']
    district = places['districts'][district_id]
    output = root / 'maps/candidates' / f'{district_id}.jpg'
    output.parent.mkdir(parents=True, exist_ok=True)
    if not output.exists():
        with Image.open(source['path']) as image:
            image.convert('RGB').save(output, quality=85, optimize=True)
    with Image.open(output) as image:
        width, height = image.size
    places['maps'][district_id] = {
        'title': district['name'] + (' Network Overview' if district['layer'] == 'network' else ' Map' if district['name'].endswith('District') else ' District Map'),
        'short': district['name'],
        'kind': 'network' if district['layer'] == 'network' else 'district',
        'district': district_id,
        'status': 'design candidate',
        'image': output.relative_to(root).as_posix(),
        'width': width,
        'height': height,
    }
    district['map'] = district_id
    if district.get('atlas'):
        district['atlas']['districtMap'] = district_id
    for row in progress['maps']:
        if row['id'] == district_id:
            row.update(status='rendered', image=output.relative_to(root).as_posix(), width=width, height=height)
places_path.write_text(json.dumps(places, indent=2, ensure_ascii=False) + '\n', encoding='utf-8')
progress_path.write_text(json.dumps(progress, indent=2, ensure_ascii=False) + '\n', encoding='utf-8')
print(f'Imported {len(sources)} candidate maps')
