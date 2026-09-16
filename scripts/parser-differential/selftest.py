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
  return result.status === 'valid' && input.protocol !== 'shallow-probe' ? {...result, envelope: input} : result;
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
    cases.append(
        {
            "mode": "decoded",
            "category": "calibration",
            "value": {**BASE, "protocol": "shallow-probe", "payload": [[1]]},
        }
    )
    go_source = directory / "faults.go"
    runner = (ROOT / "scripts/parser-differential/go.go").read_text()
    anchor = 'out = map[string]any{"status": r.Status}'
    assert runner.count(anchor) == 1
    runner = runner.replace(
        anchor,
        """
    if c.Mode == "decoded" && r.Status == "valid" && r.Envelope["protocol"] == "shallow-probe" {
        original := c.Value.(map[string]any)["payload"].([]any)
        r.Envelope["payload"] = append([]any(nil), original...)
    }
    """
        + anchor,
    )
    go_source.write_text(runner)
    replay = directory / "input.json"
    replay.write_text(json.dumps(cases))
    output = directory / "result"
    result = subprocess.run(
        [
            "python3",
            str(ROOT / "scripts/parser-differential/run.py"),
            "--node-module",
            str(module),
            "--go-source",
            str(go_source),
            "--replay",
            str(replay),
            "--output",
            str(output),
        ],
        check=False,
    )
    report = json.loads((output / "report.json").read_text())
    assert result.returncode == 1, report
    assert report["mismatches"] == 5, report
    assert report["invariant_failures"] == 4, report
    disagreements = json.loads((output / "mismatches.json").read_text())
    shallow = next(item for item in disagreements if item["index"] == 4)
    assert shallow["results"]["go"]["snapshot"] is False, shallow
    assert shallow["results"]["node"]["snapshot"] is True, shallow
    assert shallow["results"]["python"]["snapshot"] is True, shallow
    print(
        "Calibration passed: numeric meaning, source ownership, crash, snapshot, and Go shallow nested-array faults detected."
    )
