"""
Optional background normalisation for busy product photos (dev-only).

    .venv-images/bin/python scripts/images/normalise-background.py <slug> [<slug> ...]
    .venv-images/bin/python scripts/images/normalise-background.py --preview <slug> ...

Runs rembg (MIT, local model, no key) on the manifest's 1:1 crop of each
listed entry, then composites the cut-out onto a neutral #F4F4F5 backdrop with
a soft contact shadow. Output: assets/product-source/<slug>.normalised.png
(gitignored, regenerated from the original + this script). --preview only
writes the result to the scratch dir for inspection and leaves the manifest
alone. Without --preview the manifest entry is updated:
    bg_normalised: true
    normalisation: { from_source_path, from_crop, model }
    source_path / crop → the normalised square.

Only apply where the edges come out clean — inspect every preview first.

Setup (once):  python3.12 -m venv .venv-images && .venv-images/bin/pip install "rembg[cpu]"
"""

import json
import os
import sys
import tempfile
from pathlib import Path

from PIL import Image, ImageFilter, ImageOps
from rembg import new_session, remove

ROOT = Path(__file__).resolve().parents[2]
MANIFEST = ROOT / "data" / "product-images.json"
SCRATCH = Path(os.environ.get("IMAGES_SCRATCH") or Path(tempfile.gettempdir()) / "cil-product-images") / "normalised"
MODEL = "isnet-general-use"
BACKDROP = (0xF4, 0xF4, 0xF5)
PADDING = 0.08  # fraction of the square kept clear around the product


def normalise(entry, session):
    source = ROOT / entry["source_path"]
    crop = entry["crop"]
    image = ImageOps.exif_transpose(Image.open(source)).convert("RGB")
    square = image.crop((crop["left"], crop["top"], crop["left"] + crop["size"], crop["top"] + crop["size"]))
    cutout = remove(square, session=session, post_process_mask=True)  # RGBA
    alpha = cutout.getchannel("A")
    bbox = alpha.point(lambda a: 255 if a > 24 else 0).getbbox()
    if not bbox:
        raise RuntimeError("empty mask")
    subject = cutout.crop(bbox)

    size = crop["size"]
    inner = int(size * (1 - 2 * PADDING))
    scale = min(inner / subject.width, inner / subject.height)
    subject = subject.resize((max(1, round(subject.width * scale)), max(1, round(subject.height * scale))), Image.LANCZOS)
    x = (size - subject.width) // 2
    y = (size - subject.height) // 2

    canvas = Image.new("RGB", (size, size), BACKDROP)
    # Soft contact shadow: the subject's silhouette, flattened, blurred and
    # offset downward at low opacity.
    shadow_alpha = subject.getchannel("A").resize((subject.width, max(1, subject.height // 6)))
    shadow = Image.new("L", (size, size), 0)
    shadow.paste(shadow_alpha, (x, y + subject.height - shadow_alpha.height // 2))
    shadow = shadow.filter(ImageFilter.GaussianBlur(size * 0.02)).point(lambda a: int(a * 0.28))
    canvas.paste(Image.new("RGB", (size, size), (0, 0, 0)), (0, 0), shadow)
    canvas.paste(subject, (x, y), subject)
    return canvas


def main(argv):
    preview = "--preview" in argv
    slugs = [a for a in argv if not a.startswith("--")]
    manifest = json.loads(MANIFEST.read_text())
    by_slug = {e["slug"]: e for e in manifest["entries"]}
    session = new_session(MODEL)
    SCRATCH.mkdir(parents=True, exist_ok=True)
    for slug in slugs:
        entry = by_slug[slug]
        if entry.get("bg_normalised"):
            base = entry["normalisation"]
            entry = {**entry, "source_path": base["from_source_path"], "crop": base["from_crop"]}
        result = normalise(entry, session)
        if preview:
            out = SCRATCH / f"{slug}.png"
            result.resize((800, 800), Image.LANCZOS).save(out)
            print(f"preview {out}")
            continue
        out_rel = f"assets/product-source/{slug}.normalised.png"
        result.save(ROOT / out_rel, optimize=True)
        original = by_slug[slug]
        original["normalisation"] = {
            "from_source_path": entry["source_path"],
            "from_crop": entry["crop"],
            "model": f"rembg {MODEL}",
            "backdrop": "#F4F4F5",
        }
        original["bg_normalised"] = True
        original["source_path"] = out_rel
        original["crop"] = {"left": 0, "top": 0, "size": result.width}
        if "background normalised" not in original["modifications"]:
            original["modifications"] = [*original["modifications"], "background normalised"]
        original["attribution"] = original["attribution"].replace("Cropped and resized.", "Cropped, resized and background normalised.")
        print(f"normalised {slug} → {out_rel}")
    if not preview:
        MANIFEST.write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + "\n")


if __name__ == "__main__":
    main(sys.argv[1:])
