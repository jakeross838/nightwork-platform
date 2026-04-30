# CHOSEN-DIRECTION.md

**Status:** TBD — direction not yet picked at CP2.

**Direction:** TBD

**Reference:** PHILOSOPHY.md (3 directions side-by-side: Helm + Brass §2, Specimen §3, Site Office §4)

**Reasoning:** Pending Jake's pick at Strategic Checkpoint #2.

---

This file is the marker that locks the picked direction across the
playground, the design skills, the patterns catalogue, and the Forbidden
list. Until Jake picks at CP2, the file contains the TBD placeholder.

To pick: visit `/design-system/philosophy` while authenticated as a
platform admin. The page surfaces a "Pick this direction" button per
direction. Clicking the button POSTs to
`/api/design-system/pick-direction`, which verifies platform_admin via
`requirePlatformAdmin()`, then writes the picked direction's name + Jake's
user ID + ISO timestamp + propagation note over this file.

Switching direction post-lock requires a new Strategic Checkpoint per
PHILOSOPHY.md §7.4.
