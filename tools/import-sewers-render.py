"""Import a coherent Sewers Town redraw and reproject existing place IDs."""
import json
import sys
from pathlib import Path
from PIL import Image

root = Path(__file__).resolve().parents[1]
path = root/'data/places.json'
data = json.loads(path.read_text(encoding='utf-8'))
output = root/'maps/candidates/sewers-town-v2.jpg'
if not output.exists():
    with Image.open(sys.argv[1]) as image:
        image.convert('RGB').save(output, quality=85, optimize=True)
with Image.open(output) as image:
    width, height = image.size

sources = [
    'https://www.worldanvil.com/w/adyta-jeeperssheefers/a/sewers-community-settlement',
    'https://www.worldanvil.com/w/adyta-jeeperssheefers/a/the-deep-sewers-location',
    'https://www.worldanvil.com/w/adyta-jeeperssheefers/a/radio-sewers-organization',
    'https://www.worldanvil.com/w/adyta-jeeperssheefers/a/adyta-settlement',
]
coords = {
 'the-sewers--upper-walkways': (.459,.116),
 'the-sewers--old-pipe-gate': (.705,.105),
 'the-sewers--grub-guts': (.30,.195),
 'the-sewers--scrap-bone': (.90,.189),
 'the-sewers--tinker-house': (.27,.315),
 'the-sewers--slop-house': (.88,.329),
 'the-sewers--west-pipe-gate': (.105,.347),
 'the-sewers--main-canal': (.513,.410),
 'the-sewers--market-blocks': (.874,.415),
 'the-sewers--pit-pub': (.257,.414),
 'the-sewers--doll-works': (.65,.502),
 'the-sewers--south-runoff': (.916,.534),
 'the-sewers--deep-tunnels-entrance': (.44,.645),
 'deep-tunnels--gate-4': (.39,.802),
 'deep-tunnels--third-gate': (.278,.835),
 'deep-tunnels--sealed-gate': (.922,.816),
 'the-sewers--radio-sewers': (.703,.251),
 'the-sewers--the-lantern-exchange': (.44,.208),
 'the-sewers--the-listening-bench': (.605,.205),
 'the-sewers--the-span-market': (.365,.329),
 'the-sewers--the-patch-table': (.663,.404),
 'the-sewers--murr-corridor': (.298,.520),
 'the-sewers--pipe-37': (.67,.578),
}
by_id = {p['id']:p for p in data['places']}
migrations = []
for place_id,(x,y) in coords.items():
    place = by_id[place_id]
    before = dict(place['pin'])
    place['pin'] = dict(map='sewers-town', x=x, y=y, approx=True)
    migrations.append(dict(id=place_id, before=before, after=place['pin']))
by_id['the-sewers--radio-sewers']['blurb'] = 'A local relay of the distributed Radio Sewers network, carrying warnings, local news and sewer weather. This is not a fixed headquarters.'
by_id['the-sewers--radio-sewers']['sources'] = [sources[2]]
forge_id = 'the-sewers--broken-wing-forge'
forge = dict(id=forge_id, district='the-sewers', name='Broken Wing Forge', type='shop',
             blurb="Vipero's smithy near the Commons edge. The name is established lore; this precise placement is proposed.",
             canonStatus='established name; proposed placement', sources=[sources[3]],
             pin=dict(map='sewers-town', x=.098, y=.514, approx=True))
if forge_id in by_id:
    by_id[forge_id].update(forge)
else:
    data['places'].append(forge)
data['maps']['sewers-town'].update(
    image=output.relative_to(root).as_posix(), width=width, height=height,
    status='design candidate', sources=sources, brief='sewers-town',
    note='Existing PDA names are retained in a proposed layout. Radio Sewers is shown as a local relay. Deeper routes are unconfirmed.')
data['districts']['the-sewers']['atlas']['districtMap']='sewers-town'
data['districts']['deep-tunnels']['atlas']['districtMap']='sewers-town'
path.write_text(json.dumps(data,indent=2,ensure_ascii=False)+'\n',encoding='utf-8')
migration_path = root/'docs/sewers-map-pin-migration.json'
if not migration_path.exists():
    migration_path.write_text(json.dumps(dict(image=data['maps']['sewers-town']['image'],width=width,height=height,migrations=migrations),indent=2)+'\n',encoding='utf-8')
print(f'Imported Sewers redraw at {width}x{height}; reprojected {len(migrations)} existing IDs and retained their district assignments.')
