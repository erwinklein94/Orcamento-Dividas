# Painel de Dívidas — Família Klein

Site estático pronto para publicação no GitHub Pages.

## Arquivos

- `index.html` — aplicação completa em um único arquivo.
- `.nojekyll` — evita processamento pelo Jekyll no GitHub Pages.

## Como publicar no GitHub Pages

1. Crie um repositório no GitHub.
2. Envie `index.html` e `.nojekyll` para a raiz do repositório.
3. No GitHub, abra **Settings > Pages**.
4. Em **Build and deployment**, escolha **Deploy from a branch**.
5. Selecione a branch principal (`main`) e a pasta `/root`.
6. Salve. O GitHub Pages publicará o site.

## Privacidade

Este arquivo contém dados financeiros pessoais dentro do próprio HTML. Se o repositório for público, qualquer pessoa com o link poderá ver os valores. O ideal é usar um repositório privado com Pages privado quando disponível, ou remover/anonimizar os dados antes de publicar.

## Observações

- Não precisa de Node, Vite, React, servidor ou build.
- Funciona como HTML/CSS/JavaScript puro.
- As fontes vêm do Google Fonts; se quiser funcionamento 100% offline, substitua por fontes do sistema.
