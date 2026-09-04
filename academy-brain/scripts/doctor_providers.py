"""Report which provider CLIs the swarm can actually reach.

Injecting `which` keeps this testable without depending on what happens to
be installed on the machine running the tests.
"""

from __future__ import annotations

import shutil
import sys

from swarm.paths import PROVIDERS

PROVIDER_COMMANDS: dict[str, str] = {name: name for name in sorted(PROVIDERS)}


def probe(name: str, which=shutil.which) -> dict:
    """Resolve one provider's executable."""
    command = PROVIDER_COMMANDS[name]
    path = which(command)
    return {"name": name, "command": command, "path": path, "reachable": path is not None}


def report(results: list[dict]) -> str:
    """Human-readable reachability table."""
    lines = ["provider   status    path"]
    for r in results:
        status = "ON PATH" if r["reachable"] else "MISSING"
        lines.append(f"{r['name']:<10} {status:<9} {r['path'] or '-'}")
    return "\n".join(lines)


def main(argv: list[str] | None = None, which=shutil.which) -> int:
    results = [probe(name, which=which) for name in PROVIDER_COMMANDS]
    print(report(results))
    missing = [r["name"] for r in results if not r["reachable"]]
    if missing:
        print(f"\n{len(missing)} provider(s) unreachable: {', '.join(missing)}")
        print("The swarm cannot delegate to a CLI it cannot resolve.")
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
