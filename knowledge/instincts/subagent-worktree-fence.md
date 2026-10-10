---
id: subagent-worktree-fence
trigger: 'when you orchestrate subagents or workflow agents from a Claude desktop app session that runs in a git worktree'
confidence: 0.85
domain: workflow
source: host-project-promotion
---

# A subagent writes only in its own worktree or in the session worktree

## Action

Plan every shared step for the fence that the desktop app puts on each subagent: a hook refuses Edit, Write and git commands that target any other worktree.

- Run the shared steps (merge, screenshots, land) in the session worktree, where every subagent may write.
- A reviewer of a lane worktree calls `EnterWorktree` with the lane path first.
- A worker that takes over earlier work merges the old branch by name. The parent commits stray uncommitted files on that branch first; the parent's own shell is not fenced.
- A land step pushes with `git push origin HEAD:main`; the parent moves the main checkout forward and removes the lane worktrees.
- Before you reuse a saved report, read it for "the hook refused" notes: one frames report was saved as done with nothing taken.

## Why

An agent told to write in a worktree made by another agent cannot, and it reports the refusal in its notes, not as a failure. A pipeline that does not plan for the fence loses whole steps silently.
