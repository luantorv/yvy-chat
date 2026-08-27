{
  description = "YVY frontend – SvelteKit UI (chat + charts)";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-26.05";
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs = { self, nixpkgs, flake-utils }:
    flake-utils.lib.eachDefaultSystem (system:
      let
        pkgs = nixpkgs.legacyPackages.${system};
      in {
        devShells.default = pkgs.mkShell {
          packages = with pkgs; [
            nodejs_22
          ];

          shellHook = ''
            echo ""
            echo "  YVY frontend dev shell"
            echo ""
            echo "  Requiere el backend corriendo (ver ../backend)"
            echo "  npm install && npm run dev"
            echo ""
          '';
        };
      }
    );
}
