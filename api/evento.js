/* ==================================================================
   POST /api/evento
   Grava um evento de uso da colinha no Supabase.

   Recebe: { campanha, tipo, sessao, numeros }
   Não grava IP nem user-agent: a intenção de voto é dado sensível, e o
   painel só precisa de contagem. O id de sessão é aleatório, criado no
   navegador, e não identifica ninguém.
   ================================================================== */

import { lerConfig, chamarSupabase } from './_supabase.js';

const TIPOS = ['acesso', 'salvou', 'compartilhou', 'parcial'];

// quantidade de dígitos de cada cargo, igual à urna
const CARGOS = {
  presidente: 2,
  governador: 2,
  senador1: 3,
  senador2: 3,
  federal: 4,
  estadual: 5,
};

function validar(corpo) {
  if (!corpo || typeof corpo !== 'object') return 'corpo inválido';
  if (!TIPOS.includes(corpo.tipo)) return 'tipo inválido';
  if (typeof corpo.sessao !== 'string' || !/^[a-z0-9]{8,40}$/.test(corpo.sessao)) return 'sessao inválida';
  if (typeof corpo.campanha !== 'string' || !/^[a-z0-9-]{1,60}$/.test(corpo.campanha)) return 'campanha inválida';

  const numeros = corpo.numeros == null ? {} : corpo.numeros;
  if (typeof numeros !== 'object' || Array.isArray(numeros)) return 'numeros inválidos';

  const chaves = Object.keys(numeros);
  if (chaves.length > Object.keys(CARGOS).length) return 'numeros demais';
  for (const chave of chaves) {
    const digitos = CARGOS[chave];
    if (!digitos) return `cargo desconhecido: ${chave}`;
    const valor = numeros[chave];
    if (typeof valor !== 'string' || valor.length !== digitos || !/^\d+$/.test(valor)) {
      return `número inválido em ${chave}`;
    }
  }
  return null;
}

async function lerCorpo(req) {
  // O Vercel já entrega req.body em JSON quando o content-type é
  // application/json; o sendBeacon pode chegar como texto.
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') {
    try { return JSON.parse(req.body); } catch { return null; }
  }
  let bruto = '';
  for await (const parte of req) {
    bruto += parte;
    if (bruto.length > 2000) return null; // payload absurdo: descarta
  }
  try { return JSON.parse(bruto); } catch { return null; }
}

export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') {
      res.setHeader('Allow', 'POST');
      return res.status(405).json({ erro: 'use POST' });
    }

    const cfg = lerConfig();
    if (cfg.erro) {
      console.warn('[colinha] medição desligada:', cfg.erro);
      return res.status(503).json({ erro: cfg.erro });
    }

    const corpo = await lerCorpo(req);
    const problema = validar(corpo);
    if (problema) return res.status(400).json({ erro: problema });

    const r = await chamarSupabase(cfg, '/rest/v1/colinha_eventos', {
      method: 'POST',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({
        campanha: corpo.campanha,
        tipo: corpo.tipo,
        sessao: corpo.sessao,
        numeros: corpo.numeros || {},
      }),
    });

    if (r.falhou) {
      console.error('[colinha] não gravou o evento:', r.motivo);
      return res.status(502).json({ erro: 'não foi possível gravar o evento', detalhe: r.motivo });
    }

    return res.status(204).end();
  } catch (e) {
    console.error('[colinha] erro inesperado no evento:', e);
    return res.status(500).json({ erro: 'erro inesperado', detalhe: e.message });
  }
}
