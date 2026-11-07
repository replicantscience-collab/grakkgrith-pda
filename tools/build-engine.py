"""One-time extraction: lift the rules engine out of apps/player.html into apps/engine.js.

Functions move word for word; the only rewrite is `state` -> `S()` (the character the
engine was created for), so Edit sheet and the one-page Sheet run the exact same code.
Kept in the repo as a record of how engine.js was cut; not part of the build.
"""
import re, sys

PLAYER = 'apps/player.html'
MOVE = """toNum clampInt deepCopy itemType isWeaponClass isAmmoClass isConsumableClass isBackClass itemNoRefill
defaultActionsForClass getItemActions itemAllows counts setCur gearCategory damageType ammoType sameAmmoType
parseSignedTags applyItemMods parseItemLocalMods blankArmorProfile legacyArmorFromItem normalizeArmorProfileData
normalizeArmorProfile slotBonusFromText backSlotBonus normalizeEquipIndex equippedItem unlockedSlotCount attrNames
skillRankRaw skillValue stressCap heatCap defenseFromReflex currentWoundIndex currentConditions classifyAttackProfile
rawAttackSteps rollDicePool countSuccesses outcomeForCheck woundRollPenalty conditionRollEffects buildPool
ensurePlayAutomationState playSnapshot actionChanges actionValue playTimeStamp clearSlotByIndex removeIfNoRefillZero""".split()


def find(s, name):
    m = re.search(r'(?<![\w.])function\s+' + name + r'\s*\(', s)
    if not m:
        sys.exit('missing ' + name)
    i = s.index('{', m.end())
    d, k, q = 0, i, None
    while k < len(s):
        c = s[k]
        if q:
            if c == '\\':
                k += 2
                continue
            if c == q:
                q = None
        elif c in '\'"`':
            q = c
        elif c == '{':
            d += 1
        elif c == '}':
            d -= 1
            if d == 0:
                return m.start(), k + 1
        k += 1
    sys.exit('unbalanced ' + name)


def main():
    s = open(PLAYER).read()
    pieces, spans = [], []
    for n in MOVE:
        a, b = find(s, n)
        spans.append((a, b, n))
        body = s[a:b]
        body = re.sub(r'(?<![\w.$])state(?![\w$])', 'S()', body)
        if n == 'buildPool':
            body = body.replace('deriveCombat()', 'deriveCore()')
        pieces.append(body)
    print('\n'.join(pieces))
    if '--strip' in sys.argv:
        # remove the moved definitions from player.html, back to front
        for a, b, n in sorted(spans, reverse=True):
            s = s[:a] + '/* ' + n + ': apps/engine.js */' + s[b:]
        open(PLAYER, 'w').write(s)


main()
