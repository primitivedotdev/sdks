"""POSIX child measurement without polling or including build-process memory."""

import json
import os
import sys

pid = os.fork()
if pid == 0:
    os.execvp(sys.argv[1], sys.argv[1:])
_, status, usage = os.wait4(pid, 0)
scale = 1 if sys.platform == "darwin" else 1024
print(
    "RUNNER_METRICS " + json.dumps({"peak_rss_bytes": usage.ru_maxrss * scale}),
    file=sys.stderr,
)
raise SystemExit(os.waitstatus_to_exitcode(status))
