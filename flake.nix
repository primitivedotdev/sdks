{
  description = "Primitive SDKs";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs =
    { nixpkgs, flake-utils, ... }:
    flake-utils.lib.eachDefaultSystem (
      system:
      let
        pkgs = import nixpkgs { inherit system; };
      in
      {
        devShells.default = pkgs.mkShell {
          packages = with pkgs; [
            basedpyright
            biome
            git
            gnumake
            go
            jq
            nil
            nix
            nixd
            nixfmt
            nodejs_22
            pnpm
            python3
            python3Packages.build
            python3Packages.datamodel-code-generator
            python3Packages.hatchling
            python3Packages.pytest
            python3Packages.twine
            ripgrep
            ruff
            typescript-language-server
            uv
          ];

          shellHook = ''
            echo "primitive-sdks dev shell active"
          '';
        };
      }
    );
}
