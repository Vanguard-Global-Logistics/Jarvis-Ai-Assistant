# The other instrument: red-green

For correctness work — security, boundaries, credentials, persistence, money —
this replaces Gauntlet entirely. Do not run both and do not substitute one.

```
1. Write the guard.
2. Write the test that asserts the guard holds.
3. DELIBERATELY BREAK the guard.
4. Run the suite. CONFIRM IT GOES RED. If it stays green, the test is decoration.
5. Restore. Confirm green.
6. Record which breaks were tried and how many checks each one turned red.
```

**Step 3 is the whole method.** A test written alongside a guard, never run
against a broken one, asserts only that the code does what it does.

## Why a critic is the wrong tool here

**A critic can be persuaded; a failing test cannot.** A blind critic reading a
permission engine produces an opinion. A test that deliberately breaks the rule
produces a fact.

**"Better than a real-world equivalent" is the wrong bar for a boundary.** The
real-world equivalent of most permission checks is a permission check that has
been quietly wrong for years.

**A critic cannot see an absence.** If the strongest property of a design is that
some dangerous method _does not exist at all_, no amount of "which is better?"
surfaces it. A test that probes for the absence does.

## Step 6 is the part people skip

Recording which breaks were tried is what makes the verification auditable later.
"Tests pass" is not evidence; "I inverted the level comparison and 4 checks went
red, I truncated the audit log and 2 went red, I edited a level in place and 1
went red" is.

## And it still is not an approval

Red-green proves the property holds. It does not make the person who wrote it a
valid approver of their own security work. Where a project requires an
independent review, get one — from a different context and preferably a different
model.
