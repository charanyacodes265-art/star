#!/usr/bin/env python3
import json
from pathlib import Path

root = Path('.')  # change to target directory if needed

for d in sorted(p for p in root.iterdir() if p.is_dir()):
    print(f"Folder: {d.name}")
    for f in sorted(d.glob('*.jsonl')):
        print(f"  File: {f.name}")
        keys_seen = set()
        sample_keys = None
        try:
            with f.open(encoding='utf-8') as fh:
                for line_num, line in enumerate(fh, start=1):
                    line = line.strip()
                    if not line:
                        continue
                    try:
                        obj = json.loads(line)
                    except json.JSONDecodeError:
                        # skip invalid JSON lines
                        continue
                    if isinstance(obj, dict):
                        keys_seen.update(obj.keys())
                        if sample_keys is None:
                            sample_keys = list(obj.keys())
            if keys_seen:
                keys_list = ", ".join(sorted(keys_seen))
                print(f"    Unique keys: {keys_list}")
                if sample_keys:
                    print(f"    Sample keys (first object): {', '.join(sample_keys)}")
            else:
                print("    (no object keys found in file)")
        except Exception as e:
            print(f"    (error reading file: {e})")
