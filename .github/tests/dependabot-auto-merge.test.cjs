const {test} = require('node:test');
const assert = require('node:assert/strict');
const {readFileSync} = require('node:fs');
const {join} = require('node:path');

// Exercise the actual privileged workflow script, without executing its API entry point.
const workflow = readFileSync(join(__dirname, '../workflows/dependabot-auto-merge.yml'), 'utf8');
const script = workflow
    .split('          script: |\n')[1]
    .split('\n')
    .map((line) => line.slice(12))
    .join('\n');
const policy = script.slice(0, script.lastIndexOf('\nawait mergeDependabot('));
const mergeDependabot = new Function('require', `${policy}\nreturn mergeDependabot;`)(require);

function fixture() {
    const head = 'verified-head';
    const state = {
        pr: {
            number: 123,
            title: 'chore(deps-dev): update development group',
            state: 'open',
            draft: false,
            head: {
                sha: head,
                ref: 'dependabot/npm_and_yarn/development-123',
                repo: {full_name: 'gravity-ui/onboarding'},
            },
            base: {ref: 'main'},
            user: {login: 'dependabot[bot]'},
        },
        commits: [
            {
                sha: head,
                author: {login: 'dependabot[bot]'},
                commit: {verification: {verified: true}},
            },
        ],
        files: [
            {filename: 'package.json', status: 'modified'},
            {filename: 'package-lock.json', status: 'modified'},
        ],
        before: {
            scripts: {test: 'jest'},
            devDependencies: {jest: '^30.0.0'},
            peerDependencies: {react: '^18'},
        },
        after: {
            scripts: {test: 'jest'},
            devDependencies: {jest: '^30.1.0'},
            peerDependencies: {react: '^18'},
        },
        dependencies: [
            {
                updateType: 'version-update:semver-minor',
                packageEcosystem: 'npm_and_yarn',
                directory: '/',
                dependencyGroup: 'development',
                dependencyType: 'direct:development',
            },
        ],
        runs: [
            {
                id: 1,
                head_sha: head,
                head_branch: 'dependabot/npm_and_yarn/development-123',
                head_repository: {full_name: 'gravity-ui/onboarding'},
                event: 'pull_request',
                path: '.github/workflows/ci.yml',
                pull_requests: [{number: 123}],
                status: 'completed',
                conclusion: 'success',
            },
        ],
        jobs: ['Verify Files', 'Tests', 'Audit'].map((name) => ({
            name,
            status: 'completed',
            conclusion: 'success',
        })),
        reviews: [],
        actions: [],
        reads: 0,
    };
    const github = {
        rest: {
            pulls: {
                get: async () => {
                    state.reads += 1;
                    if (state.mutateOnRead) state.mutateOnRead(state);
                    return {data: structuredClone(state.pr)};
                },
                listCommits: 'commits',
                listFiles: 'files',
                listReviews: 'reviews',
                createReview: async (args) => {
                    state.actions.push(['approve', args]);
                },
                merge: async (args) => {
                    state.actions.push(['merge', args]);
                    return {data: {merged: true}};
                },
            },
            repos: {
                getCommit: async () => ({data: {parents: [{sha: 'base'}]}}),
                getContent: async ({ref}) => ({
                    data: {
                        type: 'file',
                        content: Buffer.from(
                            JSON.stringify(ref === head ? state.after : state.before),
                        ).toString('base64'),
                    },
                }),
            },
            actions: {listWorkflowRuns: 'runs', listJobsForWorkflowRun: 'jobs'},
        },
        paginate: async (key) => structuredClone(state[key]),
    };
    const context = {
        repo: {owner: 'gravity-ui', repo: 'onboarding'},
        payload: {pull_request: structuredClone(state.pr)},
    };
    return {
        state,
        run: () =>
            mergeDependabot({
                github,
                context,
                core: {info() {}},
                dependencies: state.dependencies,
                attempts: 1,
                pause: async () => {},
            }),
    };
}

test('valid grouped minor update merges only its validated SHA after all CI jobs succeed', async () => {
    const {state, run} = fixture();
    await run();
    assert.deepEqual(
        state.actions.map(([name]) => name),
        ['approve', 'merge'],
    );
    assert.equal(state.actions[0][1].commit_id, 'verified-head');
    assert.equal(state.actions[1][1].sha, 'verified-head');
    assert.equal(state.actions[1][1].commit_message, '');
});

const rejected = {
    major: (s) => {
        s.dependencies[0].updateType = 'version-update:semver-major';
    },
    'mixed group contains major': (s) => {
        s.dependencies.push({...s.dependencies[0], updateType: 'version-update:semver-major'});
    },
    'empty metadata': (s) => {
        s.dependencies = [];
    },
    'unknown version metadata': (s) => {
        s.dependencies[0].updateType = '';
    },
    'github actions update': (s) => {
        s.dependencies[0].packageEcosystem = 'github_actions';
    },
    'production routine update': (s) => {
        s.dependencies[0].dependencyType = 'direct:production';
    },
    'unrecognized group': (s) => {
        s.dependencies[0].dependencyGroup = 'other';
    },
    'second commit': (s) => {
        s.commits.push(s.commits[0]);
    },
    'human commit': (s) => {
        s.commits[0].author.login = 'human';
    },
    'unverified commit': (s) => {
        s.commits[0].commit.verification.verified = false;
    },
    'workflow change': (s) => {
        s.files.push({filename: '.github/workflows/ci.yml', status: 'modified'});
    },
    'renamed manifest': (s) => {
        s.files[0].status = 'renamed';
    },
    'script change': (s) => {
        s.after.scripts.test = 'echo hacked';
    },
    'overrides added': (s) => {
        s.after.overrides = {jest: '*'};
    },
    'peer change': (s) => {
        s.after.peerDependencies.react = '^19';
    },
    'new dependency': (s) => {
        s.after.devDependencies.evil = '1.0.0';
    },
    'foreign repository': (s) => {
        s.pr.head.repo.full_name = 'attacker/onboarding';
    },
    'head changes before CI': (s) => {
        s.mutateOnRead = (t) => {
            if (t.reads === 2) t.pr.head.sha = 'new-head';
        };
    },
    'head changes after CI': (s) => {
        s.mutateOnRead = (t) => {
            if (t.reads === 3) t.pr.head.sha = 'new-head';
        };
    },
};
for (const [name, mutate] of Object.entries(rejected)) {
    test(`no approval/merge: ${name}`, async () => {
        const {state, run} = fixture();
        mutate(state);
        await run();
        assert.deepEqual(state.actions, []);
    });
}
for (const [name, mutate] of Object.entries({
    'failed CI': (s) => {
        s.runs[0].conclusion = 'failure';
    },
    'missing Audit': (s) => {
        s.jobs.pop();
    },
    'skipped Audit': (s) => {
        s.jobs[2].conclusion = 'skipped';
    },
    'missing CI': (s) => {
        s.runs = [];
    },
    'wrong CI head': (s) => {
        s.runs[0].head_sha = 'old-head';
    },
    'wrong CI workflow': (s) => {
        s.runs[0].path = '.github/workflows/other.yml';
    },
    'wrong CI branch': (s) => {
        s.runs[0].head_branch = 'another-branch';
    },
    'foreign CI head repository': (s) => {
        s.runs[0].head_repository.full_name = 'attacker/onboarding';
    },
    'latest CI fails despite old success': (s) => {
        s.runs.push({...s.runs[0], id: 2, conclusion: 'failure'});
    },
})) {
    test(`blocks merge: ${name}`, async () => {
        const {state, run} = fixture();
        mutate(state);
        await assert.rejects(run());
        assert.deepEqual(state.actions, []);
    });
}
test('security group permits production patch/minor updates', async () => {
    const {state, run} = fixture();
    Object.assign(state.dependencies[0], {
        dependencyGroup: 'security',
        dependencyType: 'direct:production',
    });
    await run();
    assert.equal(state.actions.at(-1)[0], 'merge');
});

test('CI run with empty pull_requests is identified by its exact head, branch and repository', async () => {
    const {state, run} = fixture();
    state.runs[0].pull_requests = [];
    await run();
    assert.equal(state.actions.at(-1)[0], 'merge');
});
