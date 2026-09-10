import {execFileSync} from 'node:child_process';
import {readFileSync, writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';

const headerPattern =
    /^(build|chore|ci|docs|feat|fix|perf|refactor|revert|style|test)(?:\(([^()]+)\))?!?: (.+)$/u;

// Return an error message, or undefined for a valid one-line Conventional Commit.
export function validateCommitMessage(message) {
    if (typeof message !== 'string' || message.length === 0) {
        return 'Commit message must not be empty.';
    }
    if (/[\r\n\u2028\u2029]/u.test(message)) {
        return 'Commit message must contain exactly one line.';
    }
    if (/\p{Cc}/u.test(message)) {
        return 'Commit message must not contain control characters.';
    }
    if (message.length > 100) {
        return 'Commit message must be at most 100 characters.';
    }
    if (/co-authored-by:/iu.test(message)) {
        return 'Co-Authored-By trailers are not allowed.';
    }
    const match = headerPattern.exec(message);
    if (!match) {
        return 'Expected type(scope)!: subject (scope and ! are optional).';
    }
    const [, , scope, subject] = match;
    if (scope !== undefined && (scope.trim() !== scope || scope.trim().length === 0)) {
        return 'Scope must be nonempty with no surrounding whitespace.';
    }
    if (subject.trim() !== subject || subject.trim().length === 0) {
        return 'Subject must be nonempty with no surrounding whitespace.';
    }
    return undefined;
}

function stripGitComments(message) {
    return execFileSync('git', ['stripspace', '--strip-comments'], {
        input: message,
        encoding: 'utf8',
    });
}

function normalizeGitMessage(message) {
    let content = message;
    // Verbose commits append a diff after Git's scissors comment. Only truncate a marker
    // that Git recognizes as a comment with the configured comment character or string.
    for (const marker of message.matchAll(
        /^.+ ------------------------ >8 ------------------------\r?$/gmu,
    )) {
        if (stripGitComments(`${marker[0]}\n`) === '') {
            content = message.slice(0, marker.index);
            break;
        }
    }
    return stripGitComments(content).replace(/\n$/u, '');
}

function main(args) {
    const [mode, value] = args;
    if (args.length !== 2 || !['--file', '--text'].includes(mode)) {
        process.stderr.write(
            'Usage: node scripts/check-commit-message.mjs --file PATH | --text TITLE\n',
        );
        return 1;
    }

    let message = value;
    if (mode === '--file') {
        try {
            message = readFileSync(value, 'utf8');
        } catch (error) {
            process.stderr.write(
                `Cannot read commit message file (${error.code ?? 'unknown error'}).\n`,
            );
            return 1;
        }
        try {
            // Commit hooks receive editor comments before Git's cleanup. Let Git honor its
            // comment character and normalize whitespace, then validate the resulting message.
            message = normalizeGitMessage(message);
        } catch {
            process.stderr.write('Cannot normalize commit message with git stripspace.\n');
            return 1;
        }
    }

    const error = validateCommitMessage(message);
    if (error) {
        process.stderr.write(`${error}\n`);
        return 1;
    }
    if (mode === '--file') {
        try {
            // Commit exactly what was validated, including when git commit -m preserves comments.
            // Invalid input is never written back. --text always validates its argument verbatim.
            writeFileSync(value, `${message}\n`);
        } catch (writeError) {
            process.stderr.write(
                `Cannot write commit message file (${writeError.code ?? 'unknown error'}).\n`,
            );
            return 1;
        }
    }
    return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
    process.exitCode = main(process.argv.slice(2));
}
