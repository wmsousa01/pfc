# Assets dos parceiros

Fonte-da-verdade dos arquivos originais de cada parceiro (logo, capa, brand kit).
Uma pasta por parceiro, nomeada pelo **slug** usado no site
(`/parceiros/<slug>`).

```
assets/partners/
  <slug>/
    logo.(svg|png)     # logo do parceiro (usado na página)
    cover.(png|jpg)    # capa/banner do topo da página
    brand.md           # cores, links e notas da marca
```

Estes arquivos são a cópia original/local. As versões **servidas** ficam no
Supabase Storage (bucket `partner-assets/<slug>/`), enviadas pelo painel
`/admin` ou pelo script de cadastro. Ao criar um parceiro novo:

1. Crie `assets/partners/<slug>/` e coloque os originais aqui.
2. Cadastre no `/admin` (upload de logo/capa + cores + estilo), **ou** rode um
   script de seed que sobe os assets e insere o parceiro.

## Parceiros cadastrados

- **contenta-ai** — Contenta AI (https://www.contentaai.com.br) · 1º parceiro
