"""Run a command and restart it whenever a watched source file changes.

Used by the Celery worker/beat in Docker so code edits take effect without a
manual restart. Polling is forced via WATCHFILES_FORCE_POLLING=1 because
bind-mounted host directories do not deliver inotify events in the container.
"""
import sys

from watchfiles import Change, run_process


def python_files_only(change: Change, path: str) -> bool:
    return path.endswith(".py")


def main() -> None:
    if len(sys.argv) < 2:
        print("usage: run_with_reload.py <command> [args...]", file=sys.stderr)
        raise SystemExit(2)

    run_process(
        "/app",
        target=" ".join(sys.argv[1:]),
        target_type="command",
        watch_filter=python_files_only,
        debounce=400,
    )


if __name__ == "__main__":
    main()
