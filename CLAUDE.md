## Tests

- Bug fixes get no new tests by default. Find the root cause, make the smallest fix,
  and run the existing tests to check it. That includes not adding cases to existing
  test files. Add a regression test only if I ask for one or the project's CLAUDE.md
  requires it.
- A throwaway script to reproduce a bug is fine while debugging, but delete it before
  you finish.
- New features may get tests: a few for the main behaviour and the edge cases that
  matter. No tests for trivial code, framework behaviour, or mocks of everything.
- When a fix has no test, don't mention it or offer to add one. I'll ask if I want one.
