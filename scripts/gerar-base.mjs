#!/usr/bin/env node
/* ==================================================================
   Gera o candidatos.json a partir dos dados abertos do TSE.

   1) Baixe em https://dadosabertos.tse.jus.br (dataset "Candidatos 2026"):
        - cdn.tse.jus.br/estatistica/sead/odsele/consulta_cand/consulta_cand_2026.zip
          -> descompacte e pegue consulta_cand_2026_<UF>.csv e consulta_cand_2026_BR.csv
             (o _BR.csv e o que tem presidente)
        - cdn.tse.jus.br/estatistica/sead/eleicoes/eleicoes2026/fotos/foto_cand2026_<UF>_div.zip
          -> descompacte numa pasta (o mesmo vale para o _BR_div.zip)
        Obs.: o CDN do TSE responde 403 sem cabecalho de navegador; baixando pelo
        navegador funciona direto.
   2) Rode:
        node scripts/gerar-base.mjs \
          --csv consulta_cand_2026_SP.csv \
          --csv consulta_cand_2026_BR.csv \
          --fotos ./foto_cand2026_SP_div \
          --fotos ./foto_cand2026_BR_div

   Opções:
     --csv <arquivo>    CSV do TSE (pode repetir)
     --fotos <pasta>    pasta com as fotos descompactadas (pode repetir)
     --uf <SP>          mantém só candidatos desta UF (além dos de âmbito nacional)
     --saida <arquivo>  padrão: candidatos.json
     --todos            inclui inaptos, cassados, renúncias e indeferidos
     --sem-fotos        não copia fotos, só gera o JSON
   ================================================================== */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// O TSE só preenche DS_SITUACAO_CANDIDATURA depois de julgar o registro: antes disso
// todo mundo vem como "#NE". Por isso a regra é tirar só quem tem situação ruim
// declarada, em vez de exigir "APTO" (que deixaria a base vazia antes do julgamento).
const SITUACAO_FORA = /^(INAPTO|INDEFERIDO|CASSAD|FALECID|REN[UÚ]NCIA|RENUNCIOU)/i;

// CD_CARGO do TSE -> chave usada na colinha
const CARGOS = {
  '1': 'presidente',
  '3': 'governador',
  '5': 'senador',
  '6': 'federal',
  '7': 'estadual',
  '8': 'estadual', // deputado distrital (DF)
};

function lerArgumentos(argv) {
  const op = { csv: [], fotos: [], uf: '', saida: 'candidatos.json', todos: false, semFotos: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--csv') op.csv.push(argv[++i]);
    else if (a === '--fotos') op.fotos.push(argv[++i]);
    else if (a === '--uf') op.uf = String(argv[++i] || '').toUpperCase();
    else if (a === '--saida') op.saida = argv[++i];
    else if (a === '--todos') op.todos = true;
    else if (a === '--sem-fotos') op.semFotos = true;
    else if (a.endsWith('.csv')) op.csv.push(a);
    else throw new Error(`argumento desconhecido: ${a}`);
  }
  if (!op.csv.length) throw new Error('informe pelo menos um --csv <arquivo do TSE>');
  return op;
}

// CSV do TSE: separador ";", campos entre aspas, codificação ISO-8859-1
function lerCsv(arquivo) {
  const texto = fs.readFileSync(arquivo).toString('latin1');
  const linhas = [];
  let campo = '';
  let linha = [];
  let dentroDeAspas = false;

  for (let i = 0; i < texto.length; i++) {
    const c = texto[i];
    if (dentroDeAspas) {
      if (c === '"') {
        if (texto[i + 1] === '"') { campo += '"'; i++; }
        else dentroDeAspas = false;
      } else campo += c;
      continue;
    }
    if (c === '"') dentroDeAspas = true;
    else if (c === ';') { linha.push(campo); campo = ''; }
    else if (c === '\n') { linha.push(campo); linhas.push(linha); linha = []; campo = ''; }
    else if (c !== '\r') campo += c;
  }
  if (campo.length || linha.length) { linha.push(campo); linhas.push(linha); }

  const cabecalho = linhas.shift().map((h) => h.trim().toUpperCase());
  return linhas
    .filter((l) => l.length > 1)
    .map((l) => Object.fromEntries(cabecalho.map((h, i) => [h, (l[i] || '').trim()])));
}

function tituloDeUrna(texto) {
  return texto
    .toLocaleLowerCase('pt-BR')
    .replace(/(^|[\s'"(\-/])([\p{L}])/gu, (_, antes, letra) => antes + letra.toLocaleUpperCase('pt-BR'))
    .replace(/\b(Da|De|Do|Das|Dos|E)\b/g, (p) => p.toLocaleLowerCase('pt-BR'));
}

function indexarFotos(pastas) {
  const indice = new Map();
  for (const pasta of pastas) {
    if (!fs.existsSync(pasta)) {
      console.warn(`! pasta de fotos não encontrada: ${pasta}`);
      continue;
    }
    for (const nome of fs.readdirSync(pasta)) {
      if (!/\.jpe?g$/i.test(nome)) continue;
      // padrão do TSE: F<UF><SQ_CANDIDATO>_div.jpg
      const casou = nome.match(/^F[A-Z]{2}(\d+)_div\.jpe?g$/i);
      if (casou) indice.set(casou[1], path.join(pasta, nome));
    }
  }
  return indice;
}

function main() {
  const op = lerArgumentos(process.argv.slice(2));
  const indiceFotos = op.semFotos ? new Map() : indexarFotos(op.fotos);
  if (!op.semFotos) console.log(`fotos disponíveis: ${indiceFotos.size}`);

  const base = { presidente: {}, governador: {}, senador: {}, federal: {}, estadual: {} };
  const pastaFotos = path.join(RAIZ, 'fotos');
  const contagem = { lidos: 0, usados: 0, comFoto: 0, repetidos: 0 };

  const escolhidos = new Map(); // "cargo|numero" -> candidatura escolhida
  const conflitos = new Map();  // "cargo|numero" -> lista de nomes concorrentes

  for (const arquivo of op.csv) {
    const registros = lerCsv(arquivo);
    console.log(`${path.basename(arquivo)}: ${registros.length} registros`);

    for (const r of registros) {
      contagem.lidos++;
      const cargo = CARGOS[r.CD_CARGO];
      if (!cargo) continue;
      if (op.uf && r.SG_UF && !['BR', op.uf].includes(r.SG_UF.toUpperCase())) continue;
      if (!op.todos && SITUACAO_FORA.test(r.DS_SITUACAO_CANDIDATURA || '')) continue;

      const numero = (r.NR_CANDIDATO || '').replace(/\D/g, '');
      const nome = r.NM_URNA_CANDIDATO || r.NM_CANDIDATO || '';
      if (!numero || !nome) continue;

      const atual = {
        cargo,
        numero,
        nome: tituloDeUrna(nome),
        partido: (r.SG_PARTIDO || '').toUpperCase(),
        sq: r.SQ_CANDIDATO || '',
      };

      const chave = `${cargo}|${numero}`;
      const anterior = escolhidos.get(chave);
      if (!anterior) { escolhidos.set(chave, atual); continue; }

      // Duas candidaturas com o mesmo número: acontece quando houve substituição
      // e o registro antigo continua no arquivo. Fica a inscrição mais recente
      // (SQ_CANDIDATO maior) e o caso é avisado no fim, para conferir no
      // divulgacandcontas.tse.jus.br.
      contagem.repetidos++;
      const nomes = conflitos.get(chave) || [`${anterior.nome} (${anterior.partido})`];
      nomes.push(`${atual.nome} (${atual.partido})`);
      conflitos.set(chave, nomes);
      if (Number(atual.sq) > Number(anterior.sq)) escolhidos.set(chave, atual);
    }
  }

  for (const c of escolhidos.values()) {
    let foto = '';
    const origem = indiceFotos.get(c.sq);
    if (origem) {
      foto = path.basename(origem);
      fs.mkdirSync(pastaFotos, { recursive: true });
      fs.copyFileSync(origem, path.join(pastaFotos, foto));
      contagem.comFoto++;
    }
    base[c.cargo][c.numero] = { nome: c.nome, partido: c.partido, foto };
    contagem.usados++;
  }

  const saida = path.isAbsolute(op.saida) ? op.saida : path.join(RAIZ, op.saida);
  fs.writeFileSync(saida, JSON.stringify(base, null, 1) + '\n', 'utf8');

  console.log('');
  for (const cargo of Object.keys(base)) {
    console.log(`  ${cargo.padEnd(11)} ${Object.keys(base[cargo]).length}`);
  }
  console.log('');
  console.log(`registros lidos: ${contagem.lidos}`);
  console.log(`candidatos na base: ${contagem.usados} (${contagem.comFoto} com foto)`);
  console.log(`arquivo gerado: ${saida}`);

  if (conflitos.size) {
    console.log('');
    console.log(`atenção: ${conflitos.size} número(s) com mais de uma candidatura no arquivo do TSE.`);
    console.log('ficou a inscrição mais recente; confira no divulgacandcontas.tse.jus.br:');
    for (const [chave, nomes] of conflitos) {
      const [cargo, numero] = chave.split('|');
      const escolhido = escolhidos.get(chave);
      console.log(`  ${cargo} ${numero}: ${nomes.join(' / ')}  ->  ficou ${escolhido.nome}`);
    }
  }
}

try {
  main();
} catch (e) {
  console.error(`erro: ${e.message}`);
  process.exit(1);
}
