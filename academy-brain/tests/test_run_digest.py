from swarm import envelope
from swarm.digest_office import DigestResult, Slide

import run_digest


def test_source_map_covers_the_eleven_existing_decks():
    assert len(run_digest.SOURCE_MAP) == 11


def test_source_map_keys_are_valid_session_ids():
    from swarm.paths import SESSION_IDS

    assert set(run_digest.SOURCE_MAP).issubset(set(SESSION_IDS))


def test_render_digest_produces_parseable_envelope():
    result = DigestResult(
        sid="L1-s1",
        slides=[Slide(1, "What is a micro:bit?", "A tiny computer.", "Ask first.")],
        images=[{"file": "img-01.png", "slide": 1, "ext": "png", "bytes": 70}],
    )
    text = run_digest.render_digest(result, "L1-s1")
    env, body = envelope.parse(text)

    assert env.id == "L1-s1"
    assert env.stage == "digest"
    assert env.owner == "script"
    assert "What is a micro:bit?" in body


def test_render_digest_includes_speaker_notes():
    result = DigestResult(
        sid="L1-s1", slides=[Slide(1, "T", "B", "Ask students to predict.")]
    )
    assert "Ask students to predict." in run_digest.render_digest(result, "L1-s1")


def test_render_digest_lists_images():
    result = DigestResult(
        sid="L1-s1",
        slides=[Slide(1, "T", "B", "")],
        images=[{"file": "img-01.png", "slide": 1, "ext": "png", "bytes": 70}],
    )
    assert "img-01.png" in run_digest.render_digest(result, "L1-s1")


def test_warnings_mark_status_gated():
    result = DigestResult(
        sid="L1-s1", slides=[Slide(1, "", "", "")], warnings=["slide 1 is empty"]
    )
    env, _ = envelope.parse(run_digest.render_digest(result, "L1-s1"))
    assert env.status == "gated"
