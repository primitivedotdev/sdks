package primitive

// MatchedRules returns the rules that matched the email and granted its
// delivery, from Understanding.Rules. It returns nil when the delivery was not
// granted by a rule or the email carries no understanding. Entries without a
// rule ID are skipped. Pass a rule ID to keep only the entries for that rule;
// only the first ID passed is used.
//
// It reads the same from the event HandleWebhook returns and the ReceivedEmail
// Receive returns:
//
//	for _, rule := range email.Analysis.MatchedRules() {
//		fmt.Println(rule.ID, rule.Name, rule.Explanation)
//	}
//	isApplicant := len(event.Email.Analysis.MatchedRules(applicantsRuleID)) > 0
func (a EmailAnalysis) MatchedRules(ruleID ...string) []UnderstandingRule {
	if a.Understanding == nil {
		return nil
	}
	var matched []UnderstandingRule
	for _, rule := range a.Understanding.Rules {
		if rule.ID == "" || (len(ruleID) > 0 && rule.ID != ruleID[0]) {
			continue
		}
		matched = append(matched, rule)
	}
	return matched
}
