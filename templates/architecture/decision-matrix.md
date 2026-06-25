# Decision Matrix — <name>

Weighted scoring of candidate architectures against the ASRs from
`architecture-decision.md` §2. Keep weights and scores honest: a score you can't
justify from a requirement or a cited source is an assumption — label it.

## Weights

Weights sum to 100. They encode the client's priorities, not the team's habits.

| ASR | Weight |
| --- | ------ |
| (asr 1) | |
| (asr 2) | |
| (asr 3) | |
| **Total** | 100 |

## Scores

Rate each option 1 (poor fit) to 5 (excellent fit). Weighted = score × weight / 100.

| ASR (weight) | Option A | Option B | Option C |
| ------------ | -------- | -------- | -------- |
| (asr 1, w) | | | |
| (asr 2, w) | | | |
| (asr 3, w) | | | |
| **Weighted total** | | | |

## Reading it

- The highest weighted total is a *signal*, not the verdict — a single
  disqualifying constraint (e.g. compliance, lock-in) can override the score.
- Note any score that hinges on an unconfirmed assumption; resolve those before
  accepting the decision.
- If two options are within a few points, prefer the more reversible one and the
  one that better fits team skills and operability.
