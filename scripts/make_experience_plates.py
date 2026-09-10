#!/usr/bin/env python3
"""Generate the cover plates for experience.html.

Companies whose work left no photograph in this repo get a printed plate
instead of a logo: bone ground, halftone screen, ink double rule, a Bangers-ish
monogram and one flat ink drawing. Same two-tone-plus-one-accent recipe as the
rest of the Gotham system (assets/css/gotham.css).

    python3 scripts/make_experience_plates.py
"""
import pathlib

OUT = pathlib.Path(__file__).resolve().parent.parent / "assets" / "images" / "experience"
W, H = 600, 400
BONE, INK, RED, GOLD = "#F4EAD2", "#151820", "#E4442A", "#D9A13F"
FONT = "Impact, 'Haettenschweiler', 'Arial Narrow Bold', 'Arial Black', sans-serif"
MONO = "'Space Mono', 'Courier New', monospace"

# a flat ink drawing per company, drawn inside a 200x160 box at (330, 108)
ART = {
    # pedestrian inside a detection box with corner ticks
    "boe": """
      <g transform="translate(366,84)" fill="none" stroke="{ink}" stroke-width="7"
         stroke-linejoin="round" stroke-linecap="round">
        <path d="M6 6 H50 M6 6 V44 M160 6 H116 M160 6 V44 M6 158 H50 M6 158 V120 M160 158 H116 M160 158 V120"
              stroke="{red}"/>
        <circle cx="83" cy="44" r="15" fill="{bone}"/>
        <path d="M83 60 V104"/>
        <path d="M83 70 L58 88 M83 70 L108 84"/>
        <path d="M83 104 L64 140 M83 104 L104 140"/>
      </g>""",
    # cruise ship: hull, three decks, funnel, waterline
    "cssc": """
      <g transform="translate(360,84)" fill="none" stroke="{ink}" stroke-width="7"
         stroke-linejoin="round" stroke-linecap="round">
        <path d="M4 104 L196 104 L172 140 L28 140 Z" fill="{bone}"/>
        <path d="M26 104 L26 74 L174 74 L174 104" fill="{bone}"/>
        <path d="M52 74 L52 48 L148 48 L148 74" fill="{bone}"/>
        <path d="M86 48 L86 26 L120 26 L120 48" fill="{bone}"/>
        <path d="M132 44 L132 18 L150 18 L150 44" fill="{red}"/>
        <path d="M0 158 q26 -12 50 0 t50 0 t50 0 t50 0" stroke-width="6"/>
      </g>""",
    # message bubble with three dots
    "one800": """
      <g transform="translate(362,108)" fill="none" stroke="{ink}" stroke-width="7"
         stroke-linejoin="round" stroke-linecap="round">
        <path d="M14 6 H166 a14 14 0 0 1 14 14 V104 a14 14 0 0 1 -14 14 H74 L34 152 V118 H14
                 a14 14 0 0 1 -14 -14 V20 a14 14 0 0 1 14 -14 Z" fill="{bone}"/>
        <circle cx="52" cy="62" r="9" fill="{ink}" stroke="none"/>
        <circle cx="92" cy="62" r="9" fill="{ink}" stroke="none"/>
        <circle cx="132" cy="62" r="9" fill="{red}" stroke="none"/>
      </g>""",
    # paper glider on a launch arc
    "autodesk": """
      <g transform="translate(356,86)" fill="none" stroke="{ink}" stroke-width="7"
         stroke-linejoin="round" stroke-linecap="round">
        <path d="M12 96 L188 20 L150 116 Z" fill="{bone}"/>
        <path d="M150 116 L104 72 L188 20" />
        <path d="M104 72 L82 118" stroke="{red}"/>
        <path d="M0 158 q60 -34 118 -18" stroke-width="6" stroke-dasharray="14 12"/>
      </g>""",
}

PLATES = [
    ("one800", "800", "ONE800 Inc.", "Software / ML engineer"),
    ("boe", "BOE", "BOE Technology Group", "Machine learning intern"),
    ("cssc", "CSSC", "China State Shipbuilding", "Mechanical engineer intern"),
    ("autodesk", "ADSK", "Autodesk Inc.", "Student ambassador"),
]

TEMPLATE = """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {h}" width="{w}" height="{h}" role="img" aria-label="{name}">
  <defs>
    <pattern id="dots-{key}" width="10" height="10" patternUnits="userSpaceOnUse">
      <circle cx="2" cy="2" r="1.5" fill="{ink}" fill-opacity="0.13"/>
    </pattern>
  </defs>
  <rect width="{w}" height="{h}" fill="{bone}"/>
  <rect width="{w}" height="{h}" fill="url(#dots-{key})"/>
  <rect x="16" y="16" width="{iw}" height="{ih}" fill="none" stroke="{ink}" stroke-width="6"/>
  <rect x="28" y="28" width="{iw2}" height="{ih2}" fill="none" stroke="{gold}" stroke-width="2"/>
{art}
  <text x="56" y="176" font-family="{font}" font-size="88" letter-spacing="4" fill="{ink}">{mono_txt}</text>
  <path d="M56 206 H272 M56 216 H272" stroke="{ink}" stroke-width="4"/>
  <text x="56" y="256" font-family="{monofont}" font-size="{namesize}" letter-spacing="1" fill="{ink}">{name}</text>
  <text x="56" y="288" font-family="{monofont}" font-size="18" letter-spacing="1.5" fill="{ink}" fill-opacity="0.66">{role}</text>
  <path d="M56 320 l11 11 -11 11 -11 -11 Z" fill="{red}"/>
</svg>
"""

# square wordmark tiles, used where a company has no public logo to show
TILE = """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 220 220" width="220" height="220" role="img" aria-label="{name}">
  <rect width="220" height="220" fill="{bone}"/>
  <rect x="10" y="10" width="200" height="200" fill="none" stroke="{ink}" stroke-width="5"/>
  <rect x="21" y="21" width="178" height="178" fill="none" stroke="{gold}" stroke-width="2"/>
  <text x="110" y="{ty}" text-anchor="middle" font-family="{font}" font-size="{size}" letter-spacing="2" fill="{ink}">{word}</text>
  <path d="M110 158 l11 11 -11 11 -11 -11 Z" fill="{red}"/>
</svg>
"""

TILES = [
    ("one800", "800", "ONE800 Inc.", 70, 126),
    ("mpr", "MPR", "Motion Picture Robotics", 58, 124),
]


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    logos = OUT / "logos"
    logos.mkdir(parents=True, exist_ok=True)
    for key, word, name, size, ty in TILES:
        (logos / f"{key}.svg").write_text(TILE.format(
            bone=BONE, ink=INK, red=RED, gold=GOLD, font=FONT, monofont=MONO,
            word=word, name=name, size=size, ty=ty), encoding="utf-8")
        print("wrote", logos / f"{key}.svg")
    for key, mono_txt, name, role in PLATES:
        svg = TEMPLATE.format(
            w=W, h=H, iw=W - 32, ih=H - 32, iw2=W - 56, ih2=H - 56,
            bone=BONE, ink=INK, red=RED, gold=GOLD, font=FONT, monofont=MONO,
            key=key, mono_txt=mono_txt, name=name, role=role,
            namesize=19 if len(name) > 18 else 21,
            art=ART[key].format(ink=INK, bone=BONE, red=RED),
        )
        (OUT / f"{key}.svg").write_text(svg, encoding="utf-8")
        print("wrote", OUT / f"{key}.svg")

if __name__ == "__main__":
    main()
