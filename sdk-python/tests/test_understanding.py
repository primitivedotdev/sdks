from primitive import matched_rules


def test_matched_rules_returns_nothing_for_none() -> None:
    assert matched_rules(None) == []
    assert matched_rules(None, "rule_1") == []
