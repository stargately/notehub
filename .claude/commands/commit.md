---
description: Prepares a commit message from staged (or unstaged) changes without running git commit.
argument-hint: [optional context...]
allowed-tools: Bash(git diff:*)
---

# Task: Prepare a Conventional Commit Message

Based on the following code changes instead of our previous conversations, please generate a concise and descriptive commit message that follows the Conventional Commits specification.

Provide only the commit message itself, without any introduction or explanation.

* !!Important!! Do NOT run `git commit` or `git add`. Only output the prepared commit message for the user to review and use manually.

* If it contains frontend changes, then briefly describe UI before / after the change.
* !!Important!! Never mention `Generated with Claude Code` or `Co-Authored-By`
* !!Important!! Dont mention test details like `Tests: All 2594 tests passing` in commit message because of course those test should pass.
* !!Important!! Focus on the essence of the change. Describe the primary work (the fix, feature, or refactor), not auxiliary work like adding tests, formatting, or linting. For example, if the diff contains a bug fix and its tests, the commit message should describe the bug fix — tests are expected, not noteworthy.

## Staged Changes:

```
!git diff --cached
```

## Unstaged Changes:

```
!git diff
```

## Optional User Context:

$ARGUMENTS
