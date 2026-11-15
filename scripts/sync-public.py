#!/usr/bin/env python3
"""Publish sanitized private main history to the Glidepath public repository."""

from __future__ import annotations

import os
import re
import subprocess
import sys

SOURCE_BRANCH = "main"
PUBLIC_BRANCH = "public-main"
PUBLIC_REMOTE = "public-origin"
PUBLIC_NAME = "GlidepathRH"
PUBLIC_EMAIL = "glidepath@atomicmail.io"
PUSH_BATCH_SIZE = 4


def redact(data: bytes) -> bytes:
    return re.sub(rb"(https?://)[^/@\s]+@", rb"\1<redacted>@", data)


def run(*args: str, input_data: bytes | None = None) -> bytes:
    environment = os.environ.copy()
    environment["GIT_TERMINAL_PROMPT"] = "0"
    environment["GCM_INTERACTIVE"] = "never"
    completed = subprocess.run(
        list(args),
        input=input_data,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        env=environment,
    )
    if completed.returncode:
        sys.stderr.buffer.write(redact(completed.stderr))
        raise SystemExit(completed.returncode)
    return completed.stdout


def rewritten_identity(line: bytes) -> bytes:
    match = re.match(rb"^(author|committer|tagger) .*? ([-]?\d+ [+-]\d{4})\n$", line)
    if not match:
        return line
    return (
        match.group(1)
        + b" "
        + PUBLIC_NAME.encode()
        + b" <"
        + PUBLIC_EMAIL.encode()
        + b"> "
        + match.group(2)
        + b"\n"
    )


def scrub_message(payload: bytes) -> bytes:
    return re.sub(rb"(?im)^co-authored-by:[^\r\n]*(?:\r?\n|$)", b"", payload)


def is_private_path(line: bytes) -> bool:
    if not line.startswith((b"M ", b"D ", b"R ", b"C ")):
        return False
    paths = line.strip().split()[1:]
    for path in paths:
        normalized = path.strip(b'"')
        if normalized == b"technical-docs" or normalized.startswith(b"technical-docs/"):
            return True
        if normalized == b"our-progress.md":
            return True
        name = normalized.rsplit(b"/", 1)[-1]
        if name == b".env" or (
            name.startswith(b".env.") and not name.endswith(b".example")
        ):
            return True
    return False


def rewrite_export(stream: bytes) -> bytes:
    output = bytearray()
    cursor = 0
    record_kind: bytes | None = None
    while cursor < len(stream):
        newline = stream.find(b"\n", cursor)
        if newline == -1:
            output.extend(stream[cursor:])
            break
        line = stream[cursor : newline + 1]
        cursor = newline + 1
        if is_private_path(line):
            continue
        if line == b"blob\n":
            record_kind = b"blob"
        elif line.startswith(b"commit "):
            record_kind = b"commit"
        elif line.startswith(b"tag "):
            record_kind = b"tag"
        if line.startswith(b"data "):
            try:
                size = int(line[5:-1])
            except ValueError as error:
                raise RuntimeError(f"Unexpected fast-export data directive: {line!r}") from error
            payload = stream[cursor : cursor + size]
            cursor += size
            if record_kind in (b"commit", b"tag"):
                payload = scrub_message(payload)
                output.extend(f"data {len(payload)}\n".encode())
            else:
                output.extend(line)
            output.extend(payload)
            if cursor < len(stream) and stream[cursor : cursor + 1] == b"\n":
                output.extend(b"\n")
                cursor += 1
            continue
        if line in (b"commit refs/heads/main\n", b"reset refs/heads/main\n"):
            output.extend(line.replace(b"refs/heads/main", f"refs/heads/{PUBLIC_BRANCH}".encode()))
        else:
            output.extend(rewritten_identity(line))
    return bytes(output)


def fetch_public_main() -> str | None:
    main_ref = run("git", "ls-remote", "--heads", PUBLIC_REMOTE, "refs/heads/main")
    if not main_ref.strip():
        other_refs = run("git", "ls-remote", "--heads", PUBLIC_REMOTE)
        if other_refs.strip():
            raise RuntimeError("Public remote has branches but no main; refusing to replace it")
        return None
    run(
        "git",
        "fetch",
        "--no-tags",
        PUBLIC_REMOTE,
        "+refs/heads/main:refs/remotes/public-origin/main",
    )
    return run("git", "rev-parse", "--verify", "refs/remotes/public-origin/main").decode().strip()


def main() -> None:
    run("git", "rev-parse", "--verify", SOURCE_BRANCH)
    source_commit = run("git", "rev-parse", SOURCE_BRANCH).decode().strip()
    exported = run("git", "fast-export", "--show-original-ids", SOURCE_BRANCH)
    run("git", "fast-import", "--force", input_data=rewrite_export(exported))
    public_commit = run("git", "rev-parse", f"refs/heads/{PUBLIC_BRANCH}").decode().strip()

    remote_tip = fetch_public_main()
    commits = run("git", "rev-list", "--reverse", "--first-parent", PUBLIC_BRANCH).decode().splitlines()
    next_index = commits.index(remote_tip) + 1 if remote_tip and remote_tip in commits else 0
    batch_size = PUSH_BATCH_SIZE

    while next_index < len(commits):
        batch = commits[next_index : next_index + batch_size]
        options = ("--force",) if remote_tip not in commits else ()
        try:
            run("git", "push", PUBLIC_REMOTE, f"{batch[-1]}:refs/heads/main", *options)
        except SystemExit:
            remote_tip = fetch_public_main()
            if remote_tip and remote_tip in commits:
                next_index = commits.index(remote_tip) + 1
            if batch_size == 1:
                raise
            batch_size = max(1, batch_size // 2)
            continue
        next_index += len(batch)
        remote_tip = batch[-1]

    print(f"Published sanitized {PUBLIC_BRANCH} to {PUBLIC_REMOTE}/main.")
    print(f"Private source commit: {source_commit}")
    print(f"Synchronized public commit: {public_commit}")


if __name__ == "__main__":
    main()
