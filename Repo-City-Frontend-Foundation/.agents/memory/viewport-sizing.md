---
name: Absolute viewport sizing
description: A layout constraint for full-screen render boundaries inside the Repo City shell.
---

Full-screen render boundaries that are positioned absolutely should carry an explicit viewport-sized minimum height in addition to inset positioning.

**Why:** The world placeholder initially rendered its surrounding controls but collapsed the viewport content because the absolute section did not establish a reliable height in the preview layout.

**How to apply:** Keep the future world engine root viewport-sized and behind the UI shell; do not rely on `inset: 0` alone when the parent uses only a minimum height.