#!/usr/bin/env python3
import os
import sys

path = '/config/modes.yaml'
try:
    mtime = int(os.path.getmtime(path))
    print(mtime)
    sys.exit(0)
except Exception as e:
    print(f"ERROR: {e}", file=sys.stderr)
    sys.exit(1)
