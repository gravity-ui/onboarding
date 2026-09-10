import assert from 'node:assert/strict';
import {execFileSync, spawnSync} from 'node:child_process';
import {mkdtempSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {test} from 'node:test';
import {fileURLToPath} from 'node:url';

import {validateCommitMessage} from './check-commit-message.mjs';

const scriptPath = fileURLToPath(new URL('./check-commit-message.mjs', import.meta.url));

function run(...args) {
    return spawnSync(process.execPath, [scriptPath, ...args], {encoding: 'utf8'});
}

test('accepts every supported type, scopes, breaking markers and Unicode subjects', () => {
    for (const type of [
        'build',
        'chore',
        'ci',
        'docs',
        'feat',
        'fix',
        'perf',
        'refactor',
        'revert',
        'style',
        'test',
    ]) {
        assert.equal(validateCommitMessage(`${type}: update dependencies`), undefined);
    }
    for (const message of [
        'feat!: change public API',
        'fix(core)!: handle missing data',
        'docs(api docs): update examples',
        'fix: исправить зависимость 🛠️',
        'chore: $(touch /tmp/should-not-exist) `id` $HOME; echo hello',
        'revert: undo previous change',
        `fix: ${'a'.repeat(95)}`,
    ]) {
        assert.equal(validateCommitMessage(message), undefined, message);
    }
});

test('rejects unsupported headers, malformed scopes, whitespace, bodies and trailers', () => {
    for (const message of [
        '',
        'update dependencies',
        'Fix: update dependencies',
        'unknown: update dependencies',
        'fix:update dependencies',
        'fix: ',
        'fix:  subject',
        'fix: subject ',
        'fix: subject\t',
        'fix(): subject',
        'fix( ): subject',
        'fix( core): subject',
        'fix(core ): subject',
        'fix((core)): subject',
        'fix(core: subject',
        'fix(core)!!: subject',
        'fix: subject\n',
        'fix: subject\r',
        'fix: subject\r\n',
        'fix: subject\n\nbody',
        'fix: subject\n\nCo-Authored-By: A <a@example.com>',
        'fix: Co-Authored-By: A <a@example.com>',
        'fix: co-authored-by: A <a@example.com>',
        'fix: subject\u2028body',
        'fix: subject\u2029body',
        'fix: subject\u0000',
        'Merge branch main',
        'Revert "fix: previous change"',
        `fix: ${'a'.repeat(96)}`,
    ]) {
        assert.equal(typeof validateCommitMessage(message), 'string', JSON.stringify(message));
    }
});

test('CLI accepts text as literal data, including shell-like syntax', () => {
    const result = run('--text', 'fix(core)!: handle $(false) `false`; $HOME and Unicode ✓');
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stdout, '');
    assert.equal(result.stderr, '');
});

test('CLI rejects malformed text and unsupported arguments without a stack trace', () => {
    for (const args of [
        [],
        ['--text'],
        ['--file'],
        ['--unknown', 'fix: subject'],
        ['--text', 'fix: subject', 'extra'],
        ['--text', ''],
        ['--text', 'fix: subject\n'],
        ['--text', 'not a conventional commit'],
    ]) {
        const result = run(...args);
        assert.equal(result.status, 1, JSON.stringify(args));
        assert.equal(result.stdout, '');
        assert.ok(result.stderr.trim().length > 0);
        assert.equal(result.stderr.trim().split('\n').length, 1);
    }
});

test('hook files normalize Git whitespace and comments but reject substantive extra lines', (t) => {
    const directory = mkdtempSync(join(tmpdir(), 'onboarding commit checker '));
    t.after(() => rmSync(directory, {recursive: true, force: true}));
    const path = join(directory, 'commit message with spaces');

    for (const ending of ['', '\n', '\r\n', '\n\n', ' \n']) {
        writeFileSync(path, `fix(scope)!: исправить ошибку${ending}`);
        const result = run('--file', path);
        assert.equal(result.status, 0, result.stderr);
        assert.equal(readFileSync(path, 'utf8'), 'fix(scope)!: исправить ошибку\n');
    }

    for (const message of [
        '',
        '\n',
        'fix: subject\nbody\n',
        'fix: subject\n\nCo-Authored-By: A <a@example.com>\n',
    ]) {
        writeFileSync(path, message);
        const result = run('--file', path);
        assert.equal(result.status, 1, JSON.stringify(message));
        assert.ok(result.stderr.trim().length > 0);
        assert.equal(readFileSync(path, 'utf8'), message);
    }

    const missing = run('--file', join(directory, 'missing'));
    assert.equal(missing.status, 1);
    assert.match(missing.stderr, /Cannot read commit message file \(ENOENT\)/u);

    writeFileSync(join(directory, '--message'), 'fix: filename is data\n');
    const optionLikeFilename = spawnSync(process.execPath, [scriptPath, '--file', '--message'], {
        cwd: directory,
        encoding: 'utf8',
    });
    assert.equal(optionLikeFilename.status, 0, optionLikeFilename.stderr);
});

test('real Git commits handle custom comments, -m and verbose diffs without accepting bodies', (t) => {
    const directory = mkdtempSync(join(tmpdir(), 'onboarding git hook '));
    t.after(() => rmSync(directory, {recursive: true, force: true}));
    const git = (...args) =>
        execFileSync('git', ['-C', directory, ...args], {encoding: 'utf8', stdio: 'pipe'});
    const quote = (value) => `'${value.replaceAll("'", "'\\''")}'`;

    git('init', '-q');
    git('config', 'user.name', 'Commit checker test');
    git('config', 'user.email', 'commit-checker@example.test');
    git('config', 'commit.gpgsign', 'false');
    git('config', 'core.hooksPath', '.git/hooks');
    writeFileSync(
        join(directory, '.git/hooks/commit-msg'),
        `#!/bin/sh\n${quote(process.execPath)} ${quote(scriptPath)} --file "$1"\n`,
        {mode: 0o755},
    );
    const editorPath = join(directory, 'commit editor.mjs');
    const editorMessagePath = join(directory, 'editor-message');
    writeFileSync(editorMessagePath, 'fix: edited subject\n');
    writeFileSync(
        editorPath,
        [
            "import {readFileSync, writeFileSync} from 'node:fs';",
            'const path = process.argv[2];',
            "const original = readFileSync(path, 'utf8');",
            `writeFileSync(${JSON.stringify(join(directory, 'editor-input'))}, original);`,
            `writeFileSync(path, readFileSync(${JSON.stringify(editorMessagePath)}, 'utf8') + original);`,
        ].join('\n'),
    );
    git('config', 'core.editor', `${quote(process.execPath)} ${quote(editorPath)}`);

    for (const commentChar of ['#', ';']) {
        git('config', 'core.commentChar', commentChar);
        git('commit', '--allow-empty');
        assert.equal(git('log', '-1', '--format=%B'), 'fix: edited subject\n\n');
        git('commit', '--allow-empty', '-m', `fix: subject\n\n${commentChar} ignored comment`);
        assert.equal(git('log', '-1', '--format=%B'), 'fix: subject\n\n');

        for (const configuredVerbose of [false, true]) {
            git('config', 'commit.verbose', String(configuredVerbose));
            writeFileSync(join(directory, 'staged.txt'), `${commentChar} ${configuredVerbose}\n`);
            git('add', 'staged.txt');
            git('commit', ...(configuredVerbose ? [] : ['--verbose']));
            const editorInput = readFileSync(join(directory, 'editor-input'), 'utf8');
            assert.ok(
                editorInput.includes(
                    `${commentChar} ------------------------ >8 ------------------------`,
                ),
            );
            assert.match(editorInput, /diff --git a\/staged\.txt b\/staged\.txt/u);
            assert.equal(git('log', '-1', '--format=%B'), 'fix: edited subject\n\n');
        }
        git('config', 'commit.verbose', 'false');

        const marker = `${commentChar} ------------------------ >8 ------------------------`;
        const invalidMessages = [
            `fix: subject\n\nA substantive body\n${marker}\ndiff --git a/file b/file\n`,
            'fix: subject\n\nnot-a-comment ------------------------ >8 ------------------------\nbody\n',
        ];
        const messagePath = join(directory, 'scissors-message');
        for (const message of invalidMessages) {
            writeFileSync(messagePath, message);
            const invalidResult = spawnSync(process.execPath, [scriptPath, '--file', messagePath], {
                cwd: directory,
                encoding: 'utf8',
            });
            assert.equal(invalidResult.status, 1, invalidResult.stderr);
            assert.match(invalidResult.stderr, /exactly one line/u);
            assert.equal(readFileSync(messagePath, 'utf8'), message);
        }

        const bodyPrefix = 'fix: subject\n\nA substantive body\n';
        writeFileSync(editorMessagePath, bodyPrefix);
        writeFileSync(join(directory, 'staged.txt'), `${commentChar} rejected body\n`);
        git('add', 'staged.txt');
        const previousHead = git('rev-parse', 'HEAD');
        const invalidVerbose = spawnSync('git', ['-C', directory, 'commit', '--verbose'], {
            encoding: 'utf8',
        });
        const editorInput = readFileSync(join(directory, 'editor-input'), 'utf8');
        assert.equal(invalidVerbose.status, 1, invalidVerbose.stderr);
        assert.match(invalidVerbose.stderr, /exactly one line/u);
        assert.match(editorInput, /diff --git a\/staged\.txt b\/staged\.txt/u);
        assert.equal(git('rev-parse', 'HEAD'), previousHead);
        assert.equal(
            readFileSync(join(directory, '.git/COMMIT_EDITMSG'), 'utf8'),
            bodyPrefix + editorInput,
        );
        writeFileSync(editorMessagePath, 'fix: edited subject\n');
    }

    const body = 'fix: subject\n\nA substantive body';
    const previousHead = git('rev-parse', 'HEAD');
    const result = spawnSync('git', ['-C', directory, 'commit', '--allow-empty', '-m', body], {
        encoding: 'utf8',
    });
    assert.equal(result.status, 1, result.stderr);
    assert.match(result.stderr, /exactly one line/u);
    assert.equal(git('rev-parse', 'HEAD'), previousHead);
    assert.equal(readFileSync(join(directory, '.git/COMMIT_EDITMSG'), 'utf8'), `${body}\n`);
});
