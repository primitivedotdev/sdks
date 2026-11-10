package primitive

// MatchedRules returns the rules that matched the email and granted its
// delivery, from Understanding.Rules. It returns nil when the delivery was not
// granted by a rule or the email carries no understanding. Entries without a
// rule ID are skipped. Use MatchedRulesFor to keep only one rule's entries.
//
// It reads the same from the event HandleWebhook returns and the ReceivedEmail
// Receive returns:
//
//	for _, rule := range email.Analysis.MatchedRules() {
//		fmt.Println(rule.ID, rule.Name, rule.Explanation)
//	}
func (a EmailAnalysis) MatchedRules() []UnderstandingRule {
	return a.matchedRules(func(UnderstandingRule) bool { return true })
}

// MatchedRulesFor returns the entries of MatchedRules whose rule ID is ruleID.
//
//	isApplicant := len(event.Email.Analysis.MatchedRulesFor(applicantsRuleID)) > 0
func (a EmailAnalysis) MatchedRulesFor(ruleID string) []UnderstandingRule {
	return a.matchedRules(func(rule UnderstandingRule) bool { return rule.ID == ruleID })
}

func (a EmailAnalysis) matchedRules(keep func(UnderstandingRule) bool) []UnderstandingRule {
	if a.Understanding == nil {
		return nil
	}
	var matched []UnderstandingRule
	for _, rule := range a.Understanding.Rules {
		if rule.ID != "" && keep(rule) {
			matched = append(matched, rule)
		}
	}
	return matched
}
