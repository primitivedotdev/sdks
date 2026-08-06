import { Config } from "@remotion/cli/config";

Config.setVideoImageFormat("jpeg");
Config.setOverwriteOutput(true);
// Note: CRF is set per-codec via the --crf flag where supported (the gif codec
// rejects it), so it is intentionally not configured globally here. H.264
// defaults to CRF 18, which is what these marketing renders want.
