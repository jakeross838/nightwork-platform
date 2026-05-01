# T35 — Post-edit hook hardcoded-hex test

**Date:** 2026-04-30
**Wave:** D verification
**Hook:** `.claude/hooks/nightwork-post-edit.sh`

## Test methodology

Created a temporary file inside `src/app/design-system/__hook-test__/hex-test.tsx`
with the content:

```tsx
export const Test = () => <div className="bg-[#FF0000]">test</div>;
```

Invoked the hook with stdin JSON describing the file path:

```bash
echo '{"tool_input":{"file_path":"src/app/design-system/__hook-test__/hex-test.tsx"}}' \
  | bash .claude/hooks/nightwork-post-edit.sh
```

## Result

Exit code: 2 (rejection)

Output:
```json
{
  "decision": "block",
  "reason": "[nightwork-post-edit] [design-tokens] Hardcoded hex color (use Slate CSS vars / nw-* utilities):\n1:export const Test = () => <div className=\"bg-[#FF0000]\">test</div>;\nFix or justify (legitimate exceptions are rare). Use /nightwork-design-check or /nightwork-qa for full review. Set NIGHTWORK_HOOKS_DISABLE=1 only as a last resort."
}
```

## Verdict

**PASS** — The hook correctly rejected the hardcoded hex color `#FF0000` with
the expected `[design-tokens]` category tag and a clear remediation
instruction (use Slate CSS vars / nw-* utilities).

The test file was deleted after the test. The working tree is clean.

## Cross-reference

- Hook block 1 (lines 52-60 of `nightwork-post-edit.sh`) — hardcoded hex check
- SPEC D5 — design-token enforcement at hook level
- CLAUDE.md "Design tokens, always" — no hardcoded hex/spacing/typography rule
