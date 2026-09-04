"""Frontmatter envelopes: the swarm's message format."""

from __future__ import annotations

import fnmatch
from dataclasses import dataclass

import yaml

from swarm.gates import _VALID as VALID_VERDICT
from swarm.paths import validate_session_id

VALID_STATUS = frozenset({"pending", "complete", "failed", "gated"})


@dataclass(frozen=True)
class Envelope:
    id: str
    stage: str
    owner: str
    status: str
    inputs: tuple[str, ...] = ()
    reads_allowed: tuple[str, ...] = ()
    gate: tuple[tuple[str, str], ...] = ()
    tokens: int = 0
    run: str = ""


def parse(text: str) -> tuple[Envelope, str]:
    """Split a document into its envelope and body. Raises ValueError if invalid."""
    if not text.startswith("---\n"):
        raise ValueError("document has no frontmatter")
    _, _, rest = text.partition("---\n")
    raw, sep, body = rest.partition("\n---\n")
    if not sep:
        raise ValueError("unterminated frontmatter")

    data = yaml.safe_load(raw) or {}
    validate_session_id(data.get("id", ""))

    status = data.get("status", "pending")
    if status not in VALID_STATUS:
        raise ValueError(f"invalid status {status!r}; expected one of {sorted(VALID_STATUS)}")

    gate = data.get("gate") or {}
    if gate and gate.get("verdict") not in VALID_VERDICT:
        raise ValueError(f"invalid verdict {gate.get('verdict')!r}")

    env = Envelope(
        id=data["id"],
        stage=data.get("stage", ""),
        owner=data.get("owner", ""),
        status=status,
        inputs=tuple(data.get("inputs") or ()),
        reads_allowed=tuple(data.get("reads_allowed") or ()),
        gate=tuple(sorted(gate.items())) if gate else (),
        tokens=int(data.get("tokens", 0)),
        run=data.get("run", ""),
    )
    return env, body


def render(env: Envelope, body: str) -> str:
    """Serialize an envelope and body back to a document."""
    data = {
        "id": env.id,
        "stage": env.stage,
        "owner": env.owner,
        "status": env.status,
        "inputs": list(env.inputs),
        "reads_allowed": list(env.reads_allowed),
        "tokens": env.tokens,
        "run": env.run,
    }
    if env.gate:
        data["gate"] = dict(env.gate)
    front = yaml.safe_dump(data, sort_keys=False, allow_unicode=True)
    return f"---\n{front}---\n{body}"


def is_read_allowed(env: Envelope, path: str) -> bool:
    """True if path matches any declared read pattern.

    Declared scope is the token-efficiency lever: an agent reads one
    session's files plus frozen contracts, never the vault.
    """
    normalized = path.replace("\\", "/")
    if ".." in normalized.split("/"):
        return False
    return any(fnmatch.fnmatchcase(normalized, pattern) for pattern in env.reads_allowed)
