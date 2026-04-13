{
  description = "gatecheck development environment";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixpkgs-unstable";
  };

  outputs =
    { nixpkgs, ... }:
    let
      systems = [
        "x86_64-linux"
        "aarch64-linux"
        "x86_64-darwin"
        "aarch64-darwin"
      ];
      forAllSystems =
        f:
        nixpkgs.lib.genAttrs systems (
          system:
          f (
            import nixpkgs {
              inherit system;
              config.allowUnfreePredicate = pkg: builtins.elem (nixpkgs.lib.getName pkg) [ "codeql" ];
            }
          )
        );
    in
    {
      devShells = forAllSystems (pkgs: {
        default = pkgs.mkShell {
          packages = [
            # Runtime & package manager
            pkgs.nodejs
            pkgs.pnpm

            # Security scanning
            pkgs.codeql
            pkgs.gitleaks
          ];

          shellHook = ''
            echo "gatecheck dev shell"
            echo "  node      $(node --version)"
            echo "  pnpm      $(pnpm --version)"
            echo "  codeql    $(codeql version --format=terse 2>/dev/null)"
            echo "  gitleaks  $(gitleaks version 2>/dev/null)"
          '';
        };
      });
    };
}
