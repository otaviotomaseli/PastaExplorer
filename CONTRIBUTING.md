# Contribuindo com PastaExplorer

Obrigado por querer contribuir! Este guia ajuda a manter o projeto consistente e seguro.

## Fluxo

1. Fork + clone
2. Crie uma branch: `git checkout -b feat/minha-feature` ou `fix/bug`
3. Instale deps: `pip install -r requirements.txt`
4. Teste local: `python app.py` e verifique login, 2FA e operações de arquivo
5. Commit semântico: `feat:`, `fix:`, `docs:`, `refactor:`
6. Push e abra PR descrevendo o que mudou e por que

## Padrões

- **Segurança primeiro:** nunca commit `.env` ou `instance/auth.json` (já no `.gitignore`)
- **Código:** Python com Flask, JS vanilla. Evite adicionar build complexo sem necessidade
- **Estilo:** mantenha CSS com variáveis `var(--*)` para tema claro/escuro
- **Testes manuais:** teste em Windows e Linux se possível (drives vs `/`)

## Reportar bugs / Sugerir features

Abra uma Issue com template. Inclua SO, passos para reproduzir e logs.

## Código de Conduta

Seja respeitoso. PRs que quebram segurança (ex: expor senha em texto) serão recusados.
