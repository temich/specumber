# Contributing

## Working on a change

```sh
npm install
npm run check
```

`check` is what CI runs: the types, the lint, the formatting, and the tests.

## The tests

`npm run test:unit` runs what can be tested in one process — tag parsing, and the like.

`npm run test:features` is the suite that matters. Each scenario writes a project into `tmp/`,
links this one into its `node_modules`, runs `cucumber-js` over it in a child process, and reads
what came back out of the run: the output, the exit code, and the Cucumber messages. Nothing is
stubbed, so a scenario that passes is a statement about the Cucumber that is installed.

The suite runs twice. `test:features` compiles the projects under test with the standard
decorators of TypeScript 5 and later; `test:features:legacy` compiles them with
`experimentalDecorators`. Both have to pass — a project must not need a tsconfig of ours.

`types/usage.ts` is the interface written out as a project would write it, type-checked against
the built declarations under each of those two settings. It is checked, never run.

## Commits

Commit messages follow [conventional commits](https://www.conventionalcommits.org) — `commit-msg`
lints them locally, and they decide the next released version: `fix:` a patch, `feat:` a minor.
A `!` or a `BREAKING CHANGE:` footer also releases a minor while the package is pre-1.0.

Branch off `dev`, and open a pull request back into it. A pull request needs a passing `check`
run, an approving review, and every review thread resolved. Squash merges are off: the commits
are what the release notes are written from.

## Dependency bumps

Dependabot opens its bumps against `dev` weekly. Minor and patch bumps merge themselves: the
`dependabot` workflow approves each one and arms auto-merge, so a bump lands the moment `check`
goes green — and never lands without it. A major bump waits for a review and a merge by hand, as
does any bump whose commit message does not name its update type.

The approval comes from the Actions token, so _Allow GitHub Actions to create and approve pull
requests_ has to stay on in the repository settings. To keep a bump out, close it, or comment
`@dependabot ignore this major version` on it — that stops the next one as well.

## Releasing

Merge `dev` into `release` through a pull request. That is the whole release procedure —
`semantic-release` reads the commits since the last tag, and then tags, publishes to npm, and
writes the GitHub Release. Nothing is published from a laptop, and no version number is edited by
hand.

Both branches reject force-pushes and deletion, as do the `v*` tags: a released version can never
be moved or removed.
