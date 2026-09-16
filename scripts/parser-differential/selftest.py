"""Prove the differential harness detects intentional faults, without modifying SDKs."""

import argparse
import json
import subprocess
import tempfile
from pathlib import Path

from run import BASE, ROOT, dumps

ap = argparse.ArgumentParser(description=__doc__)
ap.add_argument(
    "--node-module", type=Path, default=ROOT / "sdk-node/dist/interactions/index.js"
)
args = ap.parse_args()
with tempfile.TemporaryDirectory(
    prefix="parser-differential-calibration-"
) as temporary:
    directory = Path(temporary)
    module = directory / "faults.mjs"
    module.write_text(
        """
import * as real from MODULE;
export function parseInteractionEnvelope(input) {
  const result = real.parseInteractionEnvelope(input);
  if(result.status === 'valid') {
    if(result.envelope.protocol === 'number-probe') result.envelope.payload = 0;
    if(result.envelope.protocol === 'copy-probe') result.source.bytes = input;
    if(result.envelope.protocol === 'crash-probe') throw new Error('injected fault');
  }
  return result;
}
export function validateInteractionEnvelope(input) {
  const result = real.validateInteractionEnvelope(input);
  return result.status === 'valid' ? {...result, envelope: input} : result;
}
""".replace("MODULE", json.dumps(args.node_module.resolve().as_uri()))
    )
    cases = []
    for protocol in ["number-probe", "copy-probe", "crash-probe"]:
        value = {**BASE, "protocol": protocol, "payload": -0.0}
        cases.append(
            {
                "mode": "bytes",
                "category": "calibration",
                "hex": dumps(value).encode().hex(),
            }
        )
    cases.append({"mode": "decoded", "category": "calibration", "value": BASE})
    replay = directory / "input.json"
    replay.write_text(json.dumps(cases))
    output = directory / "result"
    result = subprocess.run(
        [
            "python3",
            str(ROOT / "scripts/parser-differential/run.py"),
            "--node-module",
            str(module),
            "--replay",
            str(replay),
            "--output",
            str(output),
        ],
        check=False,
    )
    report = json.loads((output / "report.json").read_text())
    assert result.returncode == 1, report
    assert report["mismatches"] == 4, report
    assert report["invariant_failures"] == 3, report
    print(
        "Calibration passed: numeric meaning, source ownership, crash, and snapshot faults detected."
    )
