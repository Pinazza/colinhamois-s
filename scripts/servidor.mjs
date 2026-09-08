#!/usr/bin/env node
/* Servidor estático simples, só para testar a colinha na máquina.
   Uso: node scripts/servidor.mjs [porta]        (padrão: 4321)      */

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORTA = Number(process.argv[2] || process.env.PORT || 4321);

const TIPOS = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
};

const servidor = http.createServer((req, res) => {
  const url = decodeURIComponent(req.url.split('?')[0]);
  const relativo = url === '/' ? 'index.html' : url.replace(/^\/+/, '');
  const arquivo = path.join(RAIZ, relativo);

  if (!arquivo.startsWith(RAIZ)) {
    res.writeHead(403).end('403');
    return;
  }
  fs.readFile(arquivo, (erro, conteudo) => {
    if (erro) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('Não encontrado: ' + relativo);
      return;
    }
    const ext = path.extname(arquivo).toLowerCase();
    res.writeHead(200, {
      'Content-Type': TIPOS[ext] || 'application/octet-stream',
      // servidor de teste: nada de cache no codigo e na base, senao uma
      // alteracao no config.js nao aparece no navegador
      'Cache-Control': ['.html', '.css', '.js', '.json'].includes(ext) ? 'no-store' : 'no-cache',
    }).end(conteudo);
  });
});

// Se a porta estiver ocupada (outro servidor ou o preview do editor),
// avisa e tenta a proxima em vez de estourar o erro na tela.
let tentativas = 0;
servidor.on('error', (erro) => {
  if (erro.code !== 'EADDRINUSE') throw erro;
  const ocupada = PORTA + tentativas;
  tentativas++;
  if (tentativas > 10) {
    console.error(`a porta ${PORTA} e as 10 seguintes estao ocupadas.`);
    process.exit(1);
  }
  console.log(`a porta ${ocupada} ja esta em uso (talvez a colinha ja esteja aberta em http://localhost:${ocupada}).`);
  servidor.listen(PORTA + tentativas);
});

servidor.on('listening', () => {
  console.log(`colinha em http://localhost:${servidor.address().port}`);
});

servidor.listen(PORTA);
