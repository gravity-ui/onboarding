# Dependency maintenance

Dependabot opens pull requests only for security fixes. Both npm and GitHub Actions
set `open-pull-requests-limit: 0`, which disables ordinary version-update PRs without
disabling security updates. The schedule remains because GitHub requires it in the
configuration; it does not enable version-update PRs while that limit is zero.
Development security patch/minor updates are grouped. Security fixes that require a
major upgrade still receive a PR for manual review.

Eligible npm security updates are merged automatically after the CI workflow passes. The
merge workflow reads GitHub API data without checking out or executing PR code. It
accepts one signed Dependabot commit changing only the dependency manifests, with
patch/minor metadata in the security group for every update. Metadata must identify development
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

## Development tooling

`.nvmrc` defines the development Node version used by CI and the release action.
Keep local checks on that version when changing tools or their lockfile.

`eslint.config.js` preserves the base and TypeScript rules previously
enabled through Gravity's shared configuration. The local config lets this project
use supported ESLint versions without installing the shared preset's unused plugin
trees. React, accessibility and security presets were never enabled here.

`npm run lint` runs ESLint and a separate Prettier check over the same maintained
JavaScript/TypeScript files. `eslint-config-prettier` disables conflicting style
rules; no formatter plugin is loaded into ESLint. `npm run format` applies formatting,
and the staged-file hook runs ESLint fixes followed by Prettier. Generated `dist`
and `coverage` files stay outside these checks.

Import checks use `eslint-plugin-import-x`; JSDoc checks replace the removed core
`valid-jsdoc` rule. The built-in import resolver covers this project's relative
TypeScript imports. Add a matching resolver if TypeScript path aliases are introduced.
Preserve effective rules when updating this config, including explicit options whose
defaults changed between ESLint majors.

## Commit headers

The commit hook and CI pull-request title check use the dependency-free
`scripts/check-commit-message.mjs`. The supported format is one header, at most 100
UTF-16 code units: `type(scope)!: subject`. Scope and `!` are optional; type, scope
when present, and subject must be nonempty. Types are `build`, `chore`, `ci`, `docs`,
`feat`, `fix`, `perf`, `refactor`, `revert`, `style` and `test`.

The file mode removes Git's verbose/scissors block, uses Git's comment/whitespace
cleanup, validates the result and writes back the accepted single-line message.
This supports the normal Git editor template and the configured comment character.
Pull-request titles are checked as supplied.
Bodies, footers, multiline messages and control characters are rejected. Other
extended commitlint rules and exemptions for generated merge/revert/fixup messages
are not part of this smaller contract.

CI also reruns after pull-request edits, so correcting a title refreshes the check.
`npm run test:tooling` checks this CLI and the Dependabot merge policy with Node's
built-in test runner.

`npm run size` retains bundle-size checks using size-limit. The optional `--why`
visualizer is not installed.

## Tests and coverage

Tests run on Vitest with jsdom. `npm test` first checks all test and helper types
with TypeScript, then runs the tests and size checks. This includes compile-time
assertions such as `@ts-expect-error`; Vitest transpilation alone cannot verify them.
`npm run typecheck` checks the library, and `npm run typecheck:tests` checks the
complete test project and its Vitest configuration.

`npm run test-watch` uses Vitest's built-in watch type checker. The regular test
and CI commands use standalone TypeScript so they also catch errors in helpers.

`npm run test:coverage` runs the same checks with V8 coverage and writes text, JSON,
LCOV/HTML and Clover reports to `coverage/`. CI runs this command. Coverage includes
runtime source files and excludes tests, helpers and stories; percentages therefore
measure the library that is published.

Builds clear `dist` before compiling so previously emitted test helpers cannot
remain in a package. Test-only globals are configured for test files, not the
library. Controller diagnostics use the configured logger in every environment.

Vitest and Vite bundle some internal dependencies. Their lockfile entries do not
enumerate all bundled code; keep the parent tools updated when assessing security
advisories.
