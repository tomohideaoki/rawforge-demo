#!/usr/bin/env python3
"""Offline, read-only checks for markdown content drafts. No network, no API, no publishing."""
from pathlib import Path
import argparse
import re
import sys

SUSPICIOUS = (
    (re.compile(r"(?i)api[_-]?key\s*[:=]\s*\S+"), "possible API key"),
    (re.compile(r"(?i)(password|secret|access[_-]?token)\s*[:=]\s*\S+"), "possible credential"),
)
PLACEHOLDERS = ("【記事公開後に確認済みURL】", "【関連note記事を作成・公開・URL確認後にだけ案内】", "【比較記事の公開後にだけ案内】")

def check(path: Path) -> list[str]:
    issues = []
    try:
        data = path.read_text(encoding="utf-8")
    except (OSError, UnicodeError) as exc:
        return [f"{path}: unable to read: {exc}"]
    for pattern, name in SUSPICIOUS:
        if pattern.search(data):
            issues.append(f"{path}: {name}; review locally before committing")
    for marker in PLACEHOLDERS:
        if marker in data:
            issues.append(f"{path}: unpublished-link placeholder remains")
    return issues

def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("files", nargs="+", type=Path, help="Markdown draft files to check")
    args = parser.parse_args()
    findings = []
    for path in args.files:
        if path.suffix.lower() != ".md":
            findings.append(f"{path}: expected .md file")
        else:
            findings.extend(check(path))
    if findings:
        print("\n".join(findings))
        return 1
    print(f"PASS: {len(args.files)} markdown file(s) checked; no listed markers detected")
    return 0

if __name__ == "__main__":
    sys.exit(main())
