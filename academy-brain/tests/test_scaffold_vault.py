import scaffold_vault


def test_creates_all_stage_dirs(tmp_path):
    created = scaffold_vault.scaffold(tmp_path)
    assert len(created) == len(scaffold_vault.STAGE_DIRS)
    for name in scaffold_vault.STAGE_DIRS:
        assert (tmp_path / name).is_dir()


def test_scaffold_is_idempotent(tmp_path):
    scaffold_vault.scaffold(tmp_path)
    scaffold_vault.scaffold(tmp_path)
    assert (tmp_path / "10-digest").is_dir()


def test_never_touches_read_only_source_trees():
    protected = {"Abdeen_Moon_OS_Docs", "Techno Square identity"}
    assert protected.isdisjoint(scaffold_vault.STAGE_DIRS)


def test_fanout_stages_declare_three_providers():
    assert len(scaffold_vault.TOPOLOGY["40-critique"]["fanout"]) == 3
    assert len(scaffold_vault.TOPOLOGY["30-research"]["fanout"]) == 3


def test_claude_never_competes_in_a_stage_it_judges():
    assert "claude" not in scaffold_vault.TOPOLOGY["30-research"]["fanout"]
    assert "claude" not in scaffold_vault.TOPOLOGY["40-critique"]["fanout"]
    assert scaffold_vault.TOPOLOGY["30-research"]["owner"] == "claude"


def test_localize_is_claude_only():
    assert scaffold_vault.TOPOLOGY["70-localized"]["fanout"] == ()
    assert scaffold_vault.TOPOLOGY["70-localized"]["owner"] == "claude"


def test_render_topology_lists_every_stage():
    text = scaffold_vault.render_topology()
    for name in scaffold_vault.STAGE_DIRS:
        assert name in text
