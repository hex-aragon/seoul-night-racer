#!/usr/bin/env python3
"""Reject private files in Git or a static deployment directory; never print contents."""
import pathlib
import subprocess
import sys

PRIVATE_DIRS = {".git", ".ssh", ".aws", ".vercel", ".wrangler", "__pycache__"}
PRIVATE_SUFFIXES = {".pem", ".key", ".p12", ".pfx", ".keystore", ".db", ".sqlite", ".sqlite3", ".log"}

def private(path):
    name = path.name.lower()
    return (
        bool(PRIVATE_DIRS.intersection(part.lower() for part in path.parts))
        or (name.startswith(".env") and name != ".env.example")
        or name.startswith((".dev.vars", "id_rsa", "id_ed25519"))
        or name in {".npmrc", ".pypirc", ".netrc", "credentials.json", "service-account.json", "vinext-server.json"}
        or path.suffix.lower() in PRIVATE_SUFFIXES
        or name.endswith((".db-wal", ".db-shm", ".sqlite-wal", ".sqlite-shm"))
    )

def main():
    if len(sys.argv) > 1:
        root = pathlib.Path(sys.argv[1])
        if not root.is_dir():
            raise SystemExit("Deployment directory is missing")
        paths = [p.relative_to(root) for p in root.rglob("*") if p.is_file() or p.is_symlink()]
        failures = [str(p) for p in paths if private(p) or (root / p).is_symlink() or ".env.example" in p.parts]
    else:
        paths = [pathlib.Path(p) for p in subprocess.check_output(["git", "ls-files", "-z"]).decode().split("\0") if p]
        failures = [str(p) for p in paths if private(p) or ("public" in p.parts and p.name == ".env.example")]
    if failures:
        print("Private files blocked (paths only):", *failures, sep="\n")
        return 1
    print("Public-file policy passed")
    return 0

if __name__ == "__main__":
    sys.exit(main())
