{
  description = "YvY-Chat – entorno de desarrollo (frontend SvelteKit + backend RAG)";

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
            echo "  YvY-Chat dev shell"
            echo ""
            echo "  Backend:  cd backend  && npm install && npm run dev"
            echo "  Frontend: cd frontend && npm install && npm run dev"
            echo ""
            echo "  O levantá todo el stack (Ollama incluido) con:"
            echo "    docker compose up"
            echo ""
          '';
        };
      }
    );
}
