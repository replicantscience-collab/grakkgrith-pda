"""Import version-two renders without overwriting the first candidate images."""
import json
import re
import sys
from pathlib import Path
from PIL import Image

root = Path(__file__).resolve().parents[1]
sources = json.loads(Path(sys.argv[1]).read_text(encoding='utf-8'))
briefs = json.loads((root/'data/district-map-briefs.json').read_text(encoding='utf-8'))
catalog_path = root/'data/places.json'
catalog = json.loads(catalog_path.read_text(encoding='utf-8'))
catalog['districts']['old-city']['layer'] = 'underground'
progress = []
for source in sources:
    district_id = source['id']
    brief = next(b for b in briefs['briefs'] if b['id']==district_id)
    output = root/'maps/candidates'/f'{district_id}-v2.jpg'
    if not output.exists():
        with Image.open(source['path']) as image:
            image.convert('RGB').save(output,quality=85,optimize=True)
    with Image.open(output) as image:
        width,height = image.size
    entry = catalog['maps'][district_id]
    entry.update(image=output.relative_to(root).as_posix(),width=width,height=height,
                 sources=brief['sources'],brief=district_id,
                 note='Lore-grounded illustration; local names and placements are proposals.' if brief['sources'] else 'Provisional expansion from PDA description; no public World Anvil source found.')
    entry['annotations'] = [dict(name=p['name'],note=p['note'],x=p['x'],y=p['y'],approx=True,canonStatus=p['canonStatus']) for p in brief['landmarks']]
    # Main Roads is an abstract network illustration, not a travel destination.
    if district_id != 'main-roads':
        for landmark in brief['landmarks']:
            slug = re.sub(r'[^a-z0-9]+','-',landmark['name'].lower()).strip('-')
            place_id = f'{district_id}--candidate-{slug}'
            place = dict(id=place_id,district=district_id,name=landmark['name'],type='landmark',
                         blurb=landmark['note']+'.',canonStatus=landmark['canonStatus'],
                         sources=brief['sources'],pin=dict(map=district_id,x=landmark['x'],y=landmark['y'],approx=True))
            existing=next((p for p in catalog['places'] if p['id']==place_id),None)
            if existing:
                existing.update(place)
            else:
                catalog['places'].append(place)
    progress.append(dict(id=district_id,image=entry['image'],width=width,height=height,status='rendered',annotations=len(brief['landmarks']),sources=brief['sources']))
catalog_path.write_text(json.dumps(catalog,indent=2,ensure_ascii=False)+'\n',encoding='utf-8')
(root/'docs/district-lore-render-progress.json').write_text(json.dumps(progress,indent=2,ensure_ascii=False)+'\n',encoding='utf-8')
print(f'Imported {len(progress)} v2 maps; first-pass art and existing places preserved.')
