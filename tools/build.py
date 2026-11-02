#!/usr/bin/env python3
"""Packs behavior_pack + resource_pack into dist/MinimapForBedrock.mcaddon (and .mcpack files)."""
import os
import zipfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DIST = os.path.join(ROOT, "dist")
PACKS = {"behavior_pack": "Minimap_BP", "resource_pack": "Minimap_RP"}


def add_dir(zf, src, prefix):
    for base, _, files in os.walk(src):
        for f in sorted(files):
            full = os.path.join(base, f)
            rel = os.path.relpath(full, src)
            zf.write(full, os.path.join(prefix, rel) if prefix else rel)


os.makedirs(DIST, exist_ok=True)
addon = os.path.join(DIST, "MinimapForBedrock.mcaddon")
with zipfile.ZipFile(addon, "w", zipfile.ZIP_DEFLATED) as zf:
    for folder, name in PACKS.items():
        add_dir(zf, os.path.join(ROOT, folder), name)
print("wrote", os.path.relpath(addon, ROOT))
for folder, name in PACKS.items():
    out = os.path.join(DIST, name + ".mcpack")
    with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED) as zf:
        add_dir(zf, os.path.join(ROOT, folder), "")
    print("wrote", os.path.relpath(out, ROOT))
