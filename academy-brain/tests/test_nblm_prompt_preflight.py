import json

from swarm.gates import FAIL, PASS, UNVERIFIED, nblm_prompt_preflight as npf

SUMMARY_BODY = "\n".join(f"- {s}" for s in npf.REQUIRED_SUMMARY_SECTIONS)

GOOD_PROMPT = f"""## Notebook A — Student Deck (Pass A)

Duration: 45 minutes. Audience: ages 9-12.

```
Teach the lesson for 45 minutes to a class aged ages 9-12.
```

## Notebook B — Student Summary

Mascot: Tata the fox.

```
Summarize for parents.
{SUMMARY_BODY}
```
"""


def run(prompt_text, **fields):
    payload = {"promptText": prompt_text, **fields}
    return npf.nblm_prompt_preflight(json.dumps(payload))


def test_well_formed_prompt_with_matching_resolved_fields_passes():
    r = run(
        GOOD_PROMPT,
        expectedDurationText="45 minutes",
        expectedAudienceText="ages 9-12",
        expectedBrandingText="Tata the fox",
    )
    assert r.verdict == PASS


def test_missing_deck_a_section_fails():
    text = GOOD_PROMPT.split("## Notebook B", 1)[1]
    text = "## Notebook B" + text
    r = run(text)
    assert r.verdict == FAIL
    assert "no deck-a section found" in r.detail


def test_recognized_heading_without_fenced_prompt_does_not_count_as_resolved():
    text = GOOD_PROMPT.replace(
        "```\nTeach the lesson for 45 minutes to a class aged ages 9-12.\n```",
        "Teach the lesson for 45 minutes to a class aged ages 9-12.",
    )

    r = run(text)

    assert r.verdict == FAIL
    assert "no deck-a prompt block found" in r.detail


def test_duplicate_recognized_heading_fails_unlike_setdefault_parsing():
    duplicated = GOOD_PROMPT + "\n" + GOOD_PROMPT
    r = run(duplicated)
    assert r.verdict == FAIL
    assert "appears 2 times" in r.detail


def test_resolved_duration_not_present_verbatim_fails():
    r = run(GOOD_PROMPT, expectedDurationText="60 minutes")
    assert r.verdict == FAIL
    assert "duration" in r.detail


def test_resolved_audience_not_present_verbatim_fails():
    r = run(GOOD_PROMPT, expectedAudienceText="ages 13-15")
    assert r.verdict == FAIL
    assert "audience" in r.detail


def test_resolved_branding_clause_not_present_verbatim_fails():
    r = run(GOOD_PROMPT, expectedBrandingText="a mascot that does not appear")
    assert r.verdict == FAIL
    assert "branding" in r.detail


def test_forbidden_string_present_in_prompt_fails():
    r = run(GOOD_PROMPT, forbiddenStrings=["Tata the fox"])
    assert r.verdict == FAIL
    assert "forbidden string" in r.detail


def test_summary_missing_a_required_section_fails():
    text = GOOD_PROMPT.replace("- Mini Activity", "")
    r = run(text)
    assert r.verdict == FAIL
    assert "Mini Activity" in r.detail


def test_non_json_payload_is_unverified_not_a_crash():
    r = npf.nblm_prompt_preflight("not json")
    assert r.verdict == UNVERIFIED


def test_empty_prompt_text_is_unverified():
    r = run("   ")
    assert r.verdict == UNVERIFIED
