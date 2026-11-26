# Project update and delivery

When changing the extension, keep its manifest, visible version, package metadata,
README, changelog, feature status table and user guide consistent.

The user requires every completed update to be committed and pushed to GitHub,
with a downloadable versioned ZIP attached to its GitHub Release. Provide the
download link and the local ZIP link in the final reply, not only the source tree.
ZIP root must contain manifest.json directly; do not add a duplicate outer folder.
Local delivery retention (user updated this preference on 2026-11-26): keep only
the newest downloadable package for each edition (stable, collector lab and Via).
After a successful verified update, remove older local packages and redundant
extracted copies from the workspace outputs folder. Keep the canonical stable
outputs/x-image-flow folder and any Chrome installation path currently in use.
The configured collector directory outputs/x-image-flow-lab-v2.4.0.12 is a fixed
installation path, not an old version: it contains the newest lab files and must
stay in place to preserve the extension ID, OAuth and local library. Update it
in place while preserving its OAuth manifest fields. A newer numbered extracted
copy is unnecessary when the latest ZIP and the active installation are retained.
Do not delete source repositories, user media, browser storage or directory links.
Verify resolved cleanup targets are immediate children of outputs before removal.
Historical GitHub Releases remain available; local cleanup does not authorize
removing remote releases. This replaces the former instruction to retain local
prior versions.

Run meaningful tests for the changed behavior. Distinguish simulated X responses,
actual Windows clipboard checks, and real logged-in X / QQ / phone validation.
The optional native helper uses only built-in Windows components, runs on demand,
and must not automate QQ or send messages. Never upload user media, credentials,
test browser profiles, registry backups or compiled test executables.

After packaging, verify archived files match the published extension sources.
After publishing, verify the Release asset name, size and digest.
