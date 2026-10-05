-- Align existing successful review streaks with the automatic mastery threshold.
UPDATE cards SET status = 'mastered', updated_at = CURRENT_TIMESTAMP
WHERE repetitions >= 5 AND status != 'mastered';
