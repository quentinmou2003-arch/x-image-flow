# Project update and delivery

When changing the extension, keep its manifest, visible version, package metadata,
README, changelog, feature status table and user guide consistent.

The user requires every completed update to be committed and pushed to GitHub,
with a downloadable versioned ZIP attached to its GitHub Release. Provide the
download link and the local ZIP link in the final reply, not only the source tree.
ZIP root must contain manifest.json directly; do not add a duplicate outer folder.
Retain prior versions and keep the original workspace outputs/x-image-flow folder
updated alongside outputs/x-image-flow-vVERSION and its archive.

Run meaningful tests for the changed behavior. Distinguish simulated X responses,
actual Windows clipboard checks, and real logged-in X / QQ / phone validation.
The optional native helper uses only built-in Windows components, runs on demand,
and must not automate QQ or send messages. Never upload user media, credentials,
test browser profiles, registry backups or compiled test executables.

After packaging, verify archived files match the published extension sources.
After publishing, verify the Release asset name, size and digest.
