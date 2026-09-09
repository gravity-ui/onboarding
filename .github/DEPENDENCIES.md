# Dependency maintenance

Dependabot checks npm packages and GitHub Actions weekly. Development patch/minor
updates are grouped; development security patch/minor updates have their own group. The seven-day
cooldown applies only to ordinary version updates, never security updates.

Eligible npm groups are merged automatically after the CI workflow passes. The
merge workflow reads GitHub API data without checking out or executing PR code. It
accepts one signed Dependabot commit changing only the dependency manifests, with
patch/minor metadata for every update. Security metadata must identify development
or indirect dependencies. Only existing `devDependencies` version ranges may change;
runtime `dependencies`, scripts, peer ranges, overrides, dependency names, and other
package fields require manual review. GitHub Actions updates and major upgrades
also require manual review.

Runtime security updates remain separate PRs for manual review and release handling.
Merges made with `GITHUB_TOKEN` do not trigger the push-based Release workflow, so
automatically merging runtime fixes would leave their publication pending.

The workflow approves and merges the exact validated commit after CI completes.
It does not leave a standing auto-merge request that could apply to later edits.
If CI fails and later passes on a rerun, rerun the merge workflow too. A Dependabot
rebase triggers a fresh decision automatically.

Repository settings must keep Dependabot security updates enabled and require
`Verify Files`, `Tests`, and `Audit` from GitHub Actions, with the branch up to date.
Actions must be allowed to approve pull requests. The normal review requirement
continues to apply to other PRs.

Run the full audit against the public registry used by this project:

```sh
npm audit --registry=https://registry.npmjs.org
```

Using only `--omit=dev` misses vulnerabilities in lint, test, and release tooling.
If experimenting outside the repository, specify the registry explicitly: the
project's `.npmrc` may differ from the user's default registry.

Prefer supported upstream versions and remove unused tools. An override should
be a temporary exception scoped to its parent, with an upstream issue and a clear
removal condition. Do not force one transitive major across incompatible consumers.
Recheck whether a patched version is available in the original major before
retaining an override.
