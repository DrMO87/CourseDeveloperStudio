import pytest

from swarm import envelope

SAMPLE = """---
id: L1-s3
stage: critique
owner: codex
status: complete
inputs: [10-digest/L1-s3.md]
reads_allowed: ['00-contracts/**', '10-digest/L1-s3.*']
gate: {name: critique-schema, verdict: PASS}
tokens: 8420
run: wf_abc123
---
body text here
"""


def test_parse_returns_envelope_and_body():
    env, body = envelope.parse(SAMPLE)
    assert env.id == "L1-s3"
    assert env.owner == "codex"
    assert env.tokens == 8420
    assert body.strip() == "body text here"


def test_parse_rejects_missing_frontmatter():
    with pytest.raises(ValueError):
        envelope.parse("no frontmatter here")


def test_parse_rejects_invalid_session_id():
    with pytest.raises(ValueError):
        envelope.parse(SAMPLE.replace("id: L1-s3", "id: L9-s9"))


def test_parse_rejects_unknown_status():
    with pytest.raises(ValueError):
        envelope.parse(SAMPLE.replace("status: complete", "status: probably-fine"))


def test_render_round_trips():
    env, body = envelope.parse(SAMPLE)
    env2, body2 = envelope.parse(envelope.render(env, body))
    assert env2 == env
    assert body2.strip() == body.strip()


def test_read_scope_allows_declared_glob():
    env, _ = envelope.parse(SAMPLE)
    assert envelope.is_read_allowed(env, "00-contracts/rubric.md")
    assert envelope.is_read_allowed(env, "10-digest/L1-s3.md")


def test_read_scope_blocks_other_sessions():
    env, _ = envelope.parse(SAMPLE)
    assert not envelope.is_read_allowed(env, "10-digest/L1-s4.md")
    assert not envelope.is_read_allowed(env, "60-approved/L2-s1.md")


def test_read_scope_blocks_case_variant():
    env, _ = envelope.parse(SAMPLE)
    assert not envelope.is_read_allowed(env, "10-DIGEST/L1-S3.MD")


def test_read_scope_blocks_dotdot_traversal():
    env, _ = envelope.parse(SAMPLE)
    assert not envelope.is_read_allowed(env, "00-contracts/../secret/file.md")
