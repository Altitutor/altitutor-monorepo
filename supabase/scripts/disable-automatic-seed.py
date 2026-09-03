#!/usr/bin/env python3
"""Disable [db.seed] in config.toml so `supabase start` applies migrations only."""

from pathlib import Path
from sys import argv, stderr, stdin, stdout


def disable_automatic_seed(config_text: str) -> str:
    lines = config_text.splitlines(keepends=True)
    out: list[str] = []
    in_seed = False
    replaced = False
    for line in lines:
        stripped = line.lstrip()
        if stripped.startswith("["):
            in_seed = stripped.startswith("[db.seed]")
        if in_seed and stripped.startswith("enabled = true"):
            line = line.replace("enabled = true", "enabled = false", 1)
            replaced = True
        out.append(line)
    if not replaced:
        raise ValueError("Did not find [db.seed] enabled = true to disable")
    return "".join(out)


def main() -> None:
    if argv[1:2] == ["--dry-run"]:
        stdout.write(disable_automatic_seed(stdin.read()))
        return

    config_path = Path(argv[1] if len(argv) > 1 else "supabase/config.toml")
    config_path.write_text(disable_automatic_seed(config_path.read_text()))
    stdout.write(f"Disabled automatic seed in {config_path}\n")


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        stderr.write(f"{error}\n")
        raise SystemExit(1) from error
