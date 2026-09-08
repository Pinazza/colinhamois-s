# Colinha de votação — Moises Selerges 1355

Ferramenta de "colinha" (santinho digital) para eleição geral: o eleitor digita o número
de cada cargo, a página mostra o nome, o partido e a foto do candidato, e no fim ele salva
a colinha como imagem 4:5 (pronta para o feed/story) ou compartilha o link.

**Moises Selerges (deputado federal, 1355, PT)** fica fixo na linha de deputado federal, com
o número em destaque e sem possibilidade de apagar. Os outros cinco cargos são livres.

Tem também um **painel de acessos** em `/admin`.

Página estática, sem build e sem dependência de servidor: HTML + CSS + um JS.
A imagem é gerada no próprio navegador com [html2canvas](https://html2canvas.hertzen.com/).

```
index.html         estrutura da página
styles.css         layout do santinho (400 x 500 = 4:5)
config.js          << o único arquivo que a campanha precisa editar
app.js             motor: monta as linhas, busca na base, exporta a imagem, conta acesso
candidatos.json    base de candidatos (nome, partido e foto por número)
fotos/             fotos citadas na base
assets/            artes opcionais (cabeçalho, rodapé, selo)
admin.html         painel de acessos (/admin)
api/
  evento.js        grava um evento de uso (POST /api/evento)
  painel.js        devolve os números do painel (GET /api/painel, pede senha)
supabase.sql       tabela e função de agregação, para rodar uma vez no Supabase
scripts/
  gerar-base.mjs   gera o candidatos.json a partir dos dados abertos do TSE
  servidor.mjs     servidor estático para testar na máquina
```

## Rodando na máquina

```bash
node scripts/servidor.mjs
```

Depois abra `http://localhost:4321`. Esse servidor é só de arquivos: ele **não** roda as
funções de `api/`, então na máquina a medição não grava e o painel não abre — para testar
o painel de verdade use `vercel dev` ou o próprio deploy. Se a porta já estiver ocupada (o preview do editor
usa essa mesma), o script avisa e sobe na próxima — o endereço aparece no terminal.
Para escolher a porta: `node scripts/servidor.mjs 4500`.
(Abrir o `index.html` direto pelo Windows Explorer não funciona: o navegador bloqueia a
leitura do `candidatos.json` em `file://`.)

## Configurando a campanha

Tudo em [`config.js`](config.js):

| Campo | Para que serve |
| --- | --- |
| `titulo` | título da aba do navegador |
| `site` | endereço mostrado no rodapé da imagem |
| `urlVoltar` | destino do link "Voltar para a página principal" (vazio esconde o link) |
| `slug` | nome do arquivo da imagem salva |
| `textoLegal` | texto legal/CNPJ que aparece na vertical, na lateral |
| `cores` | azul (números), verde (faixa e CONFIRMA), amarelo (destaque), fundo do card |
| `headerImagem`, `footerImagem`, `seloImagem` | artes prontas; em branco, a página desenha em CSS |
| `seloTamanho` | lado do selo, em px |
| `candidatoFixo` | cargo, número, nome, partido e foto de quem é dono da colinha (`null` desliga) |
| `pastaFotos` | pasta das fotos da base |

O `cargo` do candidato fixo aceita `presidente`, `governador`, `senador1`, `senador2`,
`federal` ou `estadual`, e o número precisa ter a quantidade de dígitos daquele cargo
(2, 2, 3, 3, 4 e 5, respectivamente).

### Artes

Sem imagens configuradas, o cabeçalho ("COMO VOTAR"), a faixa de baixo e o selo são
desenhados em CSS com as cores do config — dá para publicar assim. Para usar a arte da
campanha, exporte nas medidas do card (largura 400) e aponte no config:

- `assets/header.jpg` — 400 x 68 px (ou o dobro, para telas retina)
- `assets/footer.jpg` — 400 x 16 px
- `assets/selo.png` — 110 x 110 px, PNG com fundo transparente

Nomes muito longos na linha de GOVERNADOR e PRESIDENTE podem passar por baixo do selo;
se acontecer, diminua o `seloTamanho`.

## A base de candidatos

O `candidatos.json` do repositório já é a base **real de São Paulo**, gerada em 08/09/2026
a partir dos dados abertos do TSE: 13 presidentes, 7 governadores, 15 senadores,
1128 deputados federais e 1429 estaduais — 2592 candidatos, todos com foto oficial
(271 KB de JSON e 22 MB em `fotos/`).

### Refazendo a base (outro estado, ou dados mais novos)

1. Baixe do dataset "Candidatos 2026" (<https://dadosabertos.tse.jus.br>):
   - `cdn.tse.jus.br/estatistica/sead/odsele/consulta_cand/consulta_cand_2026.zip`
     (3 MB, traz todos os estados) → use o `consulta_cand_2026_<UF>.csv` e o
     `consulta_cand_2026_BR.csv`, que é o do presidente
   - `cdn.tse.jus.br/estatistica/sead/eleicoes/eleicoes2026/fotos/foto_cand2026_<UF>_div.zip`
     (SP tem 15 MB) e o `foto_cand2026_BR_div.zip` (279 KB)
2. Descompacte e rode:

```bash
node scripts/gerar-base.mjs --csv consulta_cand_2026_SP.csv --csv consulta_cand_2026_BR.csv --fotos ./foto_cand2026_SP_div --fotos ./foto_cand2026_BR_div --uf SP
```

Se for baixar por linha de comando, mande cabeçalho de navegador (user-agent e referer):
o CDN do TSE responde 403 para requisições "cruas". Pelo navegador funciona direto.

O script converte o nome de urna para caixa alta e baixa, copia para `fotos/` só as fotos
dos candidatos que entraram na base e escreve o `candidatos.json` no formato:

```json
{
  "presidente": { "13": { "nome": "Nome de Urna", "partido": "SIGLA", "foto": "FBR28....jpg" } },
  "governador": { "...": {} },
  "senador":    { "...": {} },
  "federal":    { "...": {} },
  "estadual":   { "...": {} }
}
```

Opções: `--saida <arquivo>`, `--todos`, `--sem-fotos` (só o JSON).

Se a base de um cargo estiver vazia, aquele cargo continua funcionando como colinha
(o número aparece nos quadradinhos), só não mostra nome nem foto.

Dois detalhes da base de 2026 que valem saber:

- **Situação da candidatura ainda não existe.** Enquanto os registros não são julgados, o
  TSE manda `DS_SITUACAO_CANDIDATURA = #NE` para todo mundo. Por isso o script não exige
  "APTO": ele descarta apenas quem já tem situação ruim declarada (inapto, indeferido,
  cassado, renúncia). Depois do julgamento, vale refazer a base para tirar os indeferidos.
- **Números repetidos.** Quando há substituição de candidato, o registro antigo continua no
  arquivo com o mesmo número. O script fica com a inscrição mais recente e lista os casos no
  fim da execução (foram 4 em SP) para conferência no divulgacandcontas.tse.jus.br.


## Painel de acessos (`/admin`)

O painel mostra, no período escolhido (7, 30, 90 dias ou 1 ano):

- **acessos** e **pessoas** (navegadores diferentes), com o número de hoje;
- **colinhas montadas** e **imagens salvas / links compartilhados**;
- **acessos por dia**, em barras, com os mesmos números em tabela;
- **ranking dos números que os eleitores digitaram**, por cargo, com nome e partido
  resolvidos pela própria base. O número fixo do Moises Selerges não entra na contagem: ali
  só aparece o que o eleitor preencheu.

### O que é guardado (e o que não é)

Cada evento grava só: data, campanha, tipo (`acesso`, `salvou`, `compartilhou`, `parcial`),
um id de sessão aleatório criado no navegador e os números preenchidos.
**Não** grava IP, user-agent, localização nem nada que identifique o eleitor — intenção de
voto é dado sensível na LGPD, e para contar acesso não é preciso saber quem é. O rodapé da
página avisa o eleitor que a contagem é anônima.

### Como ligar

1. No Supabase, abra o SQL Editor e rode o [`supabase.sql`](supabase.sql) uma vez
   (cria a tabela `colinha_eventos`, os índices e a função `colinha_painel`).
2. No projeto da Vercel, em Settings → Environment Variables:

   | variável | valor |
   | --- | --- |
   | `SUPABASE_URL` | `https://<projeto>.supabase.co` |
   | `SUPABASE_SERVICE_KEY` | a chave **service_role** do projeto |
   | `ADMIN_SENHA` | a senha que você escolher para o painel |

3. Redeploy. O painel passa a abrir em `https://<seu-dominio>/admin`.

A `service_role` só é usada no servidor, dentro de `api/`, e a tabela fica com RLS
ligado e sem policy nenhuma — ou seja, ninguém alcança os dados pelo navegador.
Enquanto as variáveis não existirem, a colinha funciona normal e a medição fica desligada
(o endpoint responde 503 e o front ignora).

Para desligar a contagem de propósito, é só deixar `apiEventos: ''` no `config.js`.

## Publicando

A colinha em si é estática, mas o painel precisa das funções em `api/` — então o deploy
natural é a **Vercel** (zero config: ela serve a pasta e transforma `api/*.js` em funções).
Sem as funções, a colinha continua funcionando; só a medição e o painel ficam de fora.

Detalhes que valem conferir antes de publicar:

- **Fotos no mesmo domínio.** A imagem é gerada com `canvas`; foto vinda de outro
  domínio sem CORS sai em branco. Por isso as fotos ficam em `fotos/`.
- **Peso.** A base de um estado grande passa de 300 KB e as fotos podem somar dezenas de
  MB. Vale servir com gzip e, se precisar, comprimir as fotos (elas aparecem em 40 x 55 px).
- **Texto legal.** Preencha o `textoLegal` com o CNPJ da campanha antes de divulgar.

## Como o eleitor usa

1. Toca nos quadradinhos e digita o número (o campo já abre o teclado numérico).
2. Confere o nome e a foto que aparecem — o número que vale é o da urna.
3. **SALVAR IMAGEM**: no celular abre o compartilhamento nativo (WhatsApp, galeria); no
   desktop baixa o PNG 1200 x 1500. No iPhone a imagem é exibida para "pressionar e
   segurar" e salvar.
4. **COMPARTILHAR LINK**: o link leva os números já preenchidos (`#federal=1234&...`),
   então quem abrir vê a mesma colinha.

Os números digitados também ficam salvos no navegador do próprio eleitor, para ele não
perder a colinha se fechar a página.
