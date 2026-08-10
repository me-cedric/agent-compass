#!/usr/bin/env python3
"""Convert an Excalidraw file (.excalidraw JSON) to a LikeC4 model (.c4).

Usage: excalidraw_to_likec4.py <input.excalidraw> <output.c4>

Deterministic mapping:
- rectangle / ellipse / diamond elements -> LikeC4 elements (kind: node)
- bound text (containerId) or the element's own text -> element title
- arrow / line elements with start+end bindings -> relationships
- arrow label text -> relationship label

Only the intended .c4 is written; the source is never modified.
"""
import json
import re
import sys

SHAPE_TYPES = {"rectangle", "ellipse", "diamond"}
EDGE_TYPES = {"arrow", "line"}


def slugify(text: str, used: set) -> str:
    base = re.sub(r"[^a-zA-Z0-9]+", "_", text.strip()).strip("_").lower() or "node"
    if base[0].isdigit():
        base = "n_" + base
    name, i = base, 2
    while name in used:
        name, i = f"{base}_{i}", i + 1
    used.add(name)
    return name


def quote(text: str) -> str:
    """LikeC4 string literal — pick a quote char not present in the text."""
    if "'" not in text:
        return "'" + text + "'"
    if '"' not in text:
        return '"' + text + '"'
    return "'" + text.replace("'", "") + "'"


def main() -> None:
    if len(sys.argv) != 3:
        print("usage: excalidraw_to_likec4.py <input.excalidraw> <output.c4>", file=sys.stderr)
        sys.exit(2)
    src, dst = sys.argv[1], sys.argv[2]
    with open(src, encoding="utf-8") as fh:
        data = json.load(fh)
    elements = [e for e in data.get("elements", []) if not e.get("isDeleted")]

    # Text bound to a container (Excalidraw stores labels as separate text els).
    text_for = {}
    for el in elements:
        if el.get("type") == "text" and el.get("containerId"):
            text_for[el["containerId"]] = (el.get("text") or "").strip()

    used: set = set()
    nodes = {}  # excalidraw id -> (varname, title)
    for el in elements:
        if el.get("type") in SHAPE_TYPES:
            title = (el.get("text") or text_for.get(el.get("id"), "") or "Node").strip() or "Node"
            nodes[el["id"]] = (slugify(title, used), title)

    rels = []
    for el in elements:
        if el.get("type") in EDGE_TYPES:
            s = (el.get("startBinding") or {}).get("elementId")
            t = (el.get("endBinding") or {}).get("elementId")
            if s in nodes and t in nodes:
                label = (el.get("text") or text_for.get(el.get("id"), "") or "").strip()
                rels.append((nodes[s][0], nodes[t][0], label))

    out = ["specification {", "  element node", "}", "", "model {"]
    for _id, (var, title) in nodes.items():
        out.append(f"  {var} = node {quote(title)}")
    if nodes and rels:
        out.append("")
    for s, t, label in rels:
        out.append(f"  {s} -> {t} {quote(label)}" if label else f"  {s} -> {t}")
    out += ["}", "", "views {", "  view index {", "    title 'Landscape'", "    include *", "  }", "}"]

    with open(dst, "w", encoding="utf-8") as fh:
        fh.write("\n".join(out) + "\n")
    print(f"wrote {dst}: {len(nodes)} elements, {len(rels)} relationships")


if __name__ == "__main__":
    main()
