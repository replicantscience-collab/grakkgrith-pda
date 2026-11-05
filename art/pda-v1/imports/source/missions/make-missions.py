"""Generate the four story/side-board mission scene SVGs (1600x900) in the Sideways palette."""
import random, math, os, sys
OUT = sys.argv[1]
os.makedirs(OUT, exist_ok=True)
W, H = 1600, 900
INK, MID, PANEL = '#0a0b16', '#151124', '#1d162a'
BRASS, CREAM, PARCH = '#d7ac61', '#f7e8c6', '#ebd39e'
MAG, CYAN, LIME, ALERT = '#ef46ba', '#22dae4', '#9af269', '#fc6c74'

COMMON_DEFS = f'''
<filter id="grain" x="0" y="0" width="100%" height="100%">
  <feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="2" seed="7" result="n"/>
  <feColorMatrix in="n" type="matrix" values="0 0 0 0 1  0 0 0 0 .95  0 0 0 0 .85  0 0 0 .07 0"/>
</filter>
<filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
  <feGaussianBlur stdDeviation="6" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
</filter>
<filter id="softglow" x="-100%" y="-100%" width="300%" height="300%"><feGaussianBlur stdDeviation="22"/></filter>
<filter id="chalk" x="-5%" y="-5%" width="110%" height="110%">
  <feTurbulence type="fractalNoise" baseFrequency="1.4" numOctaves="1" seed="3" result="t"/>
  <feDisplacementMap in="SourceGraphic" in2="t" scale="4"/>
</filter>
<radialGradient id="vig" cx=".5" cy=".5" r=".75"><stop offset=".55" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".7"/></radialGradient>
'''

def wrap(body, defs=''):
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" width="{W}" height="{H}"><defs>{COMMON_DEFS}{defs}</defs>'
            f'{body}<rect width="{W}" height="{H}" fill="url(#vig)"/><rect width="{W}" height="{H}" filter="url(#grain)"/></svg>')

# ---------- Mission 01: Pipe 37 ----------
def pipe37():
    rnd = random.Random(37)
    vx, vy = 880, 430
    parts = [f'<rect width="{W}" height="{H}" fill="{INK}"/>']
    # receding arches, far to near
    rings = []
    for i in range(9, -1, -1):
        s = 0.8 ** i
        hw, top, bot = 900 * s, 620 * s, 520 * s
        x0, x1, yb = vx - hw, vx + hw, vy + bot
        yt = vy - top
        d = f'M{x0:.1f} {yb:.1f} L{x0:.1f} {vy - top*0.25:.1f} Q{x0:.1f} {yt:.1f} {vx:.1f} {yt:.1f} Q{x1:.1f} {yt:.1f} {x1:.1f} {vy - top*0.25:.1f} L{x1:.1f} {yb:.1f}'
        light = 0.10 + 0.55 * (1 - i / 9)
        rings.append((d, light, s))
    for d, light, s in rings:
        parts.append(f'<path d="{d}" fill="none" stroke="{BRASS}" stroke-opacity="{light*0.55:.2f}" stroke-width="{max(1.5, 10*s):.1f}"/>')
    # brick ticks on near walls
    for k in range(70):
        side = rnd.choice([-1, 1])
        y = rnd.uniform(120, 780)
        x = vx + side * rnd.uniform(560, 860)
        parts.append(f'<rect x="{x:.0f}" y="{y:.0f}" width="{rnd.uniform(40,90):.0f}" height="10" rx="2" fill="{BRASS}" fill-opacity="{rnd.uniform(.05,.14):.2f}"/>')
    # toxic water channel
    parts.append(f'<path d="M560 900 L{vx-40} {vy+70} L{vx+40} {vy+70} L1200 900 Z" fill="{LIME}" fill-opacity=".10"/>')
    parts.append(f'<path d="M640 900 L{vx-20} {vy+72} L{vx+20} {vy+72} L1120 900 Z" fill="{LIME}" fill-opacity=".18" filter="url(#softglow)"/>')
    for k in range(9):
        y = vy + 90 + k * k * 5.4
        half = 40 + (y - vy) * 0.62
        parts.append(f'<line x1="{vx-half*0.5:.0f}" y1="{y:.0f}" x2="{vx+half*0.3:.0f}" y2="{y:.0f}" stroke="{LIME}" stroke-opacity=".35" stroke-width="2"/>')
    # haze
    parts.append(f'<ellipse cx="{vx}" cy="{vy+60}" rx="520" ry="120" fill="{LIME}" fill-opacity=".10" filter="url(#softglow)"/>')
    # something in the dark
    parts.append(f'<g filter="url(#glow)" opacity=".9"><ellipse cx="{vx-14}" cy="{vy+8}" rx="6" ry="3.5" fill="{LIME}"/><ellipse cx="{vx+14}" cy="{vy+8}" rx="6" ry="3.5" fill="{LIME}"/></g>')
    # big pipe on the right wall
    parts.append('<g>'
                 '<path d="M1600 120 L1290 250 L1290 420 L1600 330 Z" fill="#2a2234"/>'
                 '<path d="M1600 120 L1290 250" stroke="#4a3d55" stroke-width="6"/>'
                 '<path d="M1290 250 L1290 420" stroke="#4a3d55" stroke-width="6"/>'
                 f'<ellipse cx="1290" cy="335" rx="36" ry="86" fill="#120e1a" stroke="{BRASS}" stroke-width="6"/>'
                 f'<ellipse cx="1290" cy="335" rx="20" ry="60" fill="{LIME}" fill-opacity=".25" filter="url(#glow)"/>'
                 '<path d="M1290 410 Q1296 520 1286 640" fill="none" stroke="#9af269" stroke-opacity=".5" stroke-width="5" stroke-dasharray="2 18" stroke-linecap="round"/>'
                 f'<text x="1420" y="300" font-family="Saira Condensed" font-weight="700" font-size="96" fill="#f2c94c" transform="rotate(-17 1420 300)" letter-spacing="2">37</text>'
                 '</g>')
    # caution tape across the frame
    tape = []
    for i in range(14):
        x = -40 + i * 130
        tape.append(f'<rect x="{x}" y="0" width="65" height="54" fill="{INK}"/>')
    parts.append(f'<g transform="translate(0 700) rotate(-6)"><rect x="-60" y="0" width="1800" height="54" fill="#f2c94c"/>{"".join(tape)}'
                 '</g>')
    # runner chalk mark on left wall
    parts.append(f'<g filter="url(#chalk)" stroke="{CYAN}" stroke-width="7" fill="none" stroke-linecap="round" stroke-linejoin="round" opacity=".9">'
                 '<path d="M150 380 L330 330 M290 300 L330 330 L300 370"/>'
                 '<circle cx="200" cy="470" r="34"/><path d="M178 460 L222 460 M200 444 L200 500"/></g>')
    parts.append(f'<text x="140" y="580" font-family="Permanent Marker" font-size="40" fill="{CYAN}" opacity=".85" filter="url(#chalk)" transform="rotate(-6 140 580)">still open?</text>')
    return wrap(''.join(parts))

# ---------- Mission 02: Route Lock ----------
def route_lock():
    rnd = random.Random(2)
    parts = [f'<rect width="{W}" height="{H}" fill="#14101e"/>']
    # brick wall
    for row in range(0, 22):
        y = row * 42
        off = 0 if row % 2 else 60
        for col in range(-1, 15):
            x = col * 120 + off
            shade = rnd.uniform(.16, .30)
            parts.append(f'<rect x="{x+3}" y="{y+3}" width="114" height="36" rx="3" fill="#5b2f36" fill-opacity="{shade:.2f}"/>')
    # lamplight cone
    parts.append(f'<path d="M900 0 L560 900 L1300 900 L960 0 Z" fill="{BRASS}" fill-opacity=".10"/>')
    parts.append(f'<ellipse cx="930" cy="40" rx="90" ry="26" fill="{BRASS}" fill-opacity=".9" filter="url(#glow)"/>')
    # passage arch
    parts.append('<path d="M700 900 L700 420 Q700 250 930 250 Q1160 250 1160 420 L1160 900 Z" fill="#05050b"/>')
    parts.append(f'<path d="M700 900 L700 420 Q700 250 930 250 Q1160 250 1160 420 L1160 900" fill="none" stroke="{BRASS}" stroke-opacity=".45" stroke-width="10"/>')
    # boards
    for (x1, y1, x2, y2) in [(660, 420, 1200, 640), (660, 700, 1200, 470), (660, 800, 1200, 760)]:
        parts.append(f'<line x1="{x1}" y1="{y1}" x2="{x2}" y2="{y2}" stroke="#6e5232" stroke-width="54" stroke-linecap="square"/>')
        parts.append(f'<line x1="{x1}" y1="{y1}" x2="{x2}" y2="{y2}" stroke="#000" stroke-opacity=".25" stroke-width="54" stroke-dasharray="2 70"/>')
    # chain + padlock
    links = ''.join(f'<ellipse cx="{760 + i*44}" cy="{560 + math.sin(i/2.2)*30:.0f}" rx="26" ry="14" fill="none" stroke="#a9a9b8" stroke-width="7"/>' for i in range(10))
    parts.append(f'<g>{links}</g>')
    parts.append('<g transform="translate(905 600)"><path d="M-30 0 V-34 A30 30 0 0 1 30 -34 V0" fill="none" stroke="#c9c9d6" stroke-width="12"/>'
                 '<rect x="-48" y="-4" width="96" height="86" rx="10" fill="#8c8c9e"/><circle cx="0" cy="34" r="10" fill="#2a2234"/><rect x="-4" y="34" width="8" height="26" fill="#2a2234"/></g>')
    # warden seal sticker
    parts.append(f'<g transform="translate(1060 360) rotate(12)"><circle r="92" fill="{ALERT}"/><circle r="78" fill="none" stroke="#fff" stroke-width="4" stroke-dasharray="6 6"/>'
                 '<text y="-18" text-anchor="middle" font-family="Saira Condensed" font-weight="700" font-size="34" fill="#fff" letter-spacing="3">WARDEN</text>'
                 '<text y="20" text-anchor="middle" font-family="Saira Condensed" font-weight="700" font-size="34" fill="#fff" letter-spacing="3">SEAL</text>'
                 '<text y="50" text-anchor="middle" font-family="Saira Condensed" font-weight="600" font-size="18" fill="#fff" letter-spacing="3">DO NOT PASS</text></g>')
    # chalk route arrows: original crossed out, new one turning away
    parts.append(f'<g filter="url(#chalk)" stroke="{CYAN}" stroke-width="9" fill="none" stroke-linecap="round" stroke-linejoin="round">'
                 '<path d="M120 640 L560 600 M510 560 L560 600 L515 645"/>'
                 '</g>')
    parts.append(f'<g filter="url(#chalk)" stroke="{MAG}" stroke-width="10" fill="none" stroke-linecap="round"><path d="M260 560 L440 680 M440 560 L260 680"/></g>')
    parts.append(f'<g filter="url(#chalk)" stroke="{LIME}" stroke-width="9" fill="none" stroke-linecap="round" stroke-linejoin="round">'
                 '<path d="M180 760 Q330 740 380 850 M330 830 L380 850 L400 800"/>'
                 '<path d="M1300 300 Q1420 250 1520 330 M1470 300 L1520 330 L1480 370"/></g>')
    parts.append(f'<text x="160" y="470" font-family="Permanent Marker" font-size="46" fill="{MAG}" filter="url(#chalk)" transform="rotate(-5 160 470)">sealed tues.</text>')
    parts.append(f'<text x="1250" y="470" font-family="Permanent Marker" font-size="40" fill="{LIME}" filter="url(#chalk)" transform="rotate(4 1250 470)">go round.</text>')
    parts.append(f'<text x="1250" y="520" font-family="Permanent Marker" font-size="30" fill="{LIME}" opacity=".8" filter="url(#chalk)" transform="rotate(4 1250 520)">it\'s watched</text>')
    return wrap(''.join(parts))

# ---------- Mission 03: What the File Says ----------
def file_says():
    rnd = random.Random(3)
    parts = [f'<rect width="{W}" height="{H}" fill="#2a1a14"/>']
    for k in range(40):  # wood grain
        y = k * 24 + rnd.uniform(-6, 6)
        parts.append(f'<path d="M0 {y:.0f} Q400 {y+rnd.uniform(-14,14):.0f} 800 {y:.0f} T1600 {y:.0f}" fill="none" stroke="#000" stroke-opacity="{rnd.uniform(.08,.2):.2f}" stroke-width="{rnd.uniform(2,6):.1f}"/>')
    # desk lamp pool
    parts.append(f'<ellipse cx="760" cy="420" rx="760" ry="460" fill="{BRASS}" fill-opacity=".12" filter="url(#softglow)"/>')
    # folder
    parts.append('<g transform="translate(260 120) rotate(-4)">'
                 '<path d="M0 30 L0 660 L1000 660 L1000 30 L560 30 L520 0 L380 0 L340 30 Z" fill="#c79a57"/>'
                 '<rect x="40" y="60" width="440" height="570" fill="#efe6d0"/>'
                 '<rect x="520" y="50" width="450" height="590" fill="#f5eedd" transform="rotate(2 745 345)"/>'
                 '</g>')
    # page lines + redactions on left page
    lines = []
    for i in range(16):
        y = 240 + i * 30
        w = rnd.uniform(240, 380)
        if rnd.random() < .38:
            lines.append(f'<rect x="330" y="{y-14}" width="{w:.0f}" height="20" fill="#0a0b16"/>')
        else:
            lines.append(f'<rect x="330" y="{y-6}" width="{w:.0f}" height="5" fill="#6b5a48" fill-opacity=".55"/>')
    parts.append(f'<g transform="rotate(-4 760 450)">{"".join(lines)}'
                 '<text x="330" y="205" font-family="Saira Condensed" font-weight="700" font-size="30" fill="#3a2a20" letter-spacing="3">INCIDENT 37-L · SUMMARY</text></g>')
    # stamp
    parts.append(f'<g transform="translate(660 600) rotate(-14)" opacity=".85"><rect x="-200" y="-50" width="400" height="100" rx="8" fill="none" stroke="{ALERT}" stroke-width="7"/>'
                 f'<text text-anchor="middle" y="-6" font-family="Saira Condensed" font-weight="700" font-size="40" fill="{ALERT}" letter-spacing="4">ABI · RESTRICTED</text>'
                 f'<text text-anchor="middle" y="34" font-family="Saira Condensed" font-weight="600" font-size="20" fill="{ALERT}" letter-spacing="2">FINDINGS SUBJECT TO REVISION</text></g>')
    # polaroids on right page
    def polaroid(x, y, rot, inner):
        return (f'<g transform="translate({x} {y}) rotate({rot})"><rect x="-120" y="-130" width="240" height="280" fill="#fbf8f0"/>'
                f'<rect x="-104" y="-114" width="208" height="200" fill="#11131f"/>{inner}</g>')
    tunnel = ''.join(f'<path d="M{-90*s:.0f} {70*s:.0f} V{-20*s:.0f} Q{-90*s:.0f} {-90*s:.0f} 0 {-90*s:.0f} Q{90*s:.0f} {-90*s:.0f} {90*s:.0f} {-20*s:.0f} V{70*s:.0f}" transform="translate(0 -14)" fill="none" stroke="{BRASS}" stroke-opacity="{.2+.6*s:.2f}" stroke-width="3"/>' for s in (1, .75, .55, .4, .28))
    tunnel += f'<circle cx="-6" cy="-14" r="3" fill="{LIME}"/><circle cx="6" cy="-14" r="3" fill="{LIME}"/>'
    parts.append(polaroid(1020, 300, 6, tunnel + '<text x="-90" y="128" font-family="Permanent Marker" font-size="24" fill="#3a2a20">P37 — 02:14</text>'))
    pipe = f'<rect x="-80" y="-60" width="160" height="60" fill="#2a2234"/><ellipse cx="80" cy="-30" rx="14" ry="30" fill="#120e1a" stroke="{BRASS}" stroke-width="3"/><text x="-50" y="-18" font-family="Saira Condensed" font-weight="700" font-size="30" fill="#f2c94c">37</text>'
    parts.append(polaroid(1190, 520, -8, pipe + '<text x="-90" y="128" font-family="Permanent Marker" font-size="24" fill="#3a2a20">who opened it?</text>'))
    # red string + pins
    parts.append(f'<path d="M1020 190 Q1150 330 1190 410 M1020 190 Q760 120 470 720" fill="none" stroke="{ALERT}" stroke-width="3"/>')
    for (x, y) in [(1020, 190), (1190, 410), (470, 720)]:
        parts.append(f'<circle cx="{x}" cy="{y}" r="12" fill="{MAG}" stroke="#000" stroke-opacity=".4" stroke-width="2"/>')
    # sticky note
    parts.append(f'<g transform="translate(170 640) rotate(-10)"><rect width="230" height="210" fill="#f2c94c"/>'
                 '<text x="20" y="64" font-family="Permanent Marker" font-size="34" fill="#3a1730">official</text>'
                 '<text x="20" y="112" font-family="Permanent Marker" font-size="34" fill="#3a1730">≠ true</text>'
                 '<text x="20" y="168" font-family="Permanent Marker" font-size="26" fill="#3a1730">ask Low Halo</text></g>')
    # coffee ring + magnifier
    parts.append('<circle cx="1420" cy="160" r="70" fill="none" stroke="#5a3418" stroke-opacity=".55" stroke-width="10"/>')
    parts.append(f'<g transform="translate(1380 780) rotate(-30)"><circle r="90" fill="{CYAN}" fill-opacity=".08" stroke="#b9b29f" stroke-width="16"/>'
                 '<rect x="-14" y="96" width="28" height="160" rx="10" fill="#3a2a20"/></g>')
    return wrap(''.join(parts))

# ---------- Side board ----------
def side_board():
    rnd = random.Random(4)
    parts = [f'<rect width="{W}" height="{H}" fill="#5a3a22"/>']
    for k in range(1800):  # cork speckle
        parts.append(f'<circle cx="{rnd.uniform(0,W):.0f}" cy="{rnd.uniform(0,H):.0f}" r="{rnd.uniform(1,3.5):.1f}" fill="#{rnd.choice(["2e1c10","7d5634","94673d"])}" fill-opacity=".55"/>')
    parts.append(f'<rect x="0" y="0" width="{W}" height="{H}" fill="none" stroke="#2b1a10" stroke-width="40"/>')
    notes = [
        (250, 250, -5, 'BURN-WIRE', ['outages again', 'venue block', 'not the meter?'], PARCH, MAG),
        (640, 220, 3, 'MURR', ['route check', 'bring earplugs', 'chem or charm'], '#d9f2c2', CYAN),
        (1030, 260, -3, 'BELOW', ['sealed room', 'paperwork too', 'clean'], PARCH, LIME),
        (1380, 230, 5, 'SALVAGE', ['keep the', 'lights on', 'Patchkin ask'], '#f6c7e5', BRASS),
    ]
    for x, y, r, title, lines, paper, pin in notes:
        body = ''.join(f'<text x="26" y="{140 + i*48}" font-family="Permanent Marker" font-size="32" fill="#2c1c18">{t}</text>' for i, t in enumerate(lines))
        tabs = ''.join(f'<rect x="{12 + i*48}" y="300" width="40" height="80" fill="{paper}"/><text transform="translate({38 + i*48} 372) rotate(-90)" font-family="Saira Condensed" font-weight="600" font-size="16" fill="#2c1c18">PDA · JOBS</text>' for i in range(5))
        parts.append(f'<g transform="translate({x-150} {y-60}) rotate({r} 150 160)"><rect x="6" y="8" width="300" height="380" fill="#000" fill-opacity=".3"/>'
                     f'<rect width="300" height="300" fill="{paper}"/>{tabs}'
                     f'<text x="26" y="78" font-family="Permanent Marker" font-size="48" fill="#3a1730">{title}</text>'
                     f'<line x1="26" y1="94" x2="270" y2="94" stroke="#3a1730" stroke-width="4"/>{body}'
                     f'<circle cx="150" cy="18" r="16" fill="{pin}" stroke="#000" stroke-opacity=".45" stroke-width="3"/></g>')
    # big header strip
    parts.append(f'<g transform="translate(800 720) rotate(-2)"><rect x="-430" y="-58" width="860" height="116" fill="{INK}"/>'
                 f'<text text-anchor="middle" y="18" font-family="Permanent Marker" font-size="62" fill="{BRASS}">SIDE BOARD · TAKE ONE</text></g>')
    return wrap(''.join(parts))

for name, fn in (('pipe37', pipe37), ('route-lock', route_lock), ('file-says', file_says), ('side-board', side_board)):
    open(os.path.join(OUT, f'mission-{name}.svg'), 'w').write(fn())
    print('wrote', name)

# ---------- Side board, wide banner (1600x500) ----------
H = 500
src = side_board()
import re as _re
src = _re.sub(r'<g transform="translate\(800 720\).*?</g>', '', src, flags=_re.S)  # HTML carries the heading
src = src.replace('<g transform="translate(100 190)', '<g transform="translate(100 120)')
for old, new in (('translate(100 190)', 'translate(100 70)'), ('translate(490 160)', 'translate(490 40)'), ('translate(880 200)', 'translate(880 80)'), ('translate(1230 170)', 'translate(1230 50)')):
    src = src.replace(old, new)
open(os.path.join(OUT, 'mission-side-board-wide.svg'), 'w').write(src)
print('wrote side-board-wide')
