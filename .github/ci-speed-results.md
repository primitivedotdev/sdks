# CI critical-path experiment, 27 October 2026

The target is elapsed time until all required checks finish. Improving a job that finishes early does not shorten the merge wait.

## Same-source CLI comparison

Source: `94b9540ec8c95d95d8d3af2524710b3bd0fd057e`, Node 22, identical CLI code and build/test commands.

| Matching work | Two cores | Four cores |
| --- | --- | --- |
| CLI checks (build, lint, types, unit tests) | 5:18 | 2:22 |
| CLI package build | 1:02 | 0:39 |
| CLI dependency isolation | 0:02 | 0:01 |
| Packed CLI smoke suite | 3:39 | 1:32 |
| Build + isolation + smoke | 4:43 | 2:12 |

[Two-core run](https://github.com/primitivedotdev/sdks/actions/runs/40592817705), [four-core comparison](https://github.com/primitivedotdev/sdks/actions/runs/40592817670). All compared jobs passed.

Checks were 55% shorter; matching packaging work was 53% shorter. Their allocated core-seconds decreased from 1,202 to 1,096 (9%). This is a compute proxy, not an invoice calculation.

Full job execution, including setup and cleanup, was 5:38 versus 2:40 for CLI checks and 5:12 versus 2:31 for packaging. The two-core packaging job additionally ran a two-second isolation-script fixture test that the experiment omitted. The matching-work table excludes that extra test and setup; full job times are contextual observations rather than perfectly matched workloads.

These are single controlled observations. Queueing, cache state and other checks can determine a future PR's critical path. Node 24 and coverage are verified by the final workflow, but were not part of this paired experiment.

## Resulting changes

- CLI checks and packaging use four cores; other language jobs retain two.
- CLI packaging builds the SDK dependency once and reuses compiled output for dependency isolation and packing.
- Node SDK checks collect coverage during their single test-suite run. Packing and isolation reuse the preceding build.
- Standalone isolation targets retain prepack behavior. Reuse requires a dist directory and built files in the pack manifest. Existing installed-package smoke assertions remain.
- One-shot smoke targets order isolation after their builds even with parallel make.
- The temporary comparison workflow was removed after measurement.

The initial two-core Node jobs took 3:18 (Node 22) and 2:57 (Node 24), which would become the next limit after accelerating the CLI. Avoiding their repeated tests and prepack builds addresses that critical-path shift without adding cores to those jobs.
