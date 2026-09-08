/* ==================================================================
   GET /api/painel?dias=30&campanha=<slug>
   Devolve os números do painel já agregados pelo banco.
   Protegido pela senha em ADMIN_SENHA (header "x-senha").
   ================================================================== */

import { timingSafeEqual } from 'node:crypto';
import { lerConfig, chamarSupabase } from './_supabase.js';

function senhaConfere(recebida, esperada) {
  const a = Buffer.from(String(recebida || ''), 'utf8');
  const b = Buffer.from(String(esperada || ''), 'utf8');
  if (a.length !== b.length) return false;      // timingSafeEqual exige tamanhos iguais
  return timingSafeEqual(a, b);
}

export default async function handler(req, res) {
  try {
    if (req.method !== 'GET') {
      res.setHeader('Allow', 'GET');
      return res.status(405).json({ erro: 'use GET' });
    }

    const esperada = process.env.ADMIN_SENHA;
    if (!esperada) return res.status(503).json({ erro: 'defina ADMIN_SENHA nas variáveis de ambiente' });

    const cfg = lerConfig();
    if (cfg.erro) return res.status(503).json({ erro: cfg.erro });

    if (!senhaConfere(req.headers['x-senha'], esperada)) {
      return res.status(401).json({ erro: 'senha incorreta' });
    }

    const dias = Math.min(Math.max(parseInt(req.query.dias, 10) || 30, 1), 365);
    const campanha = typeof req.query.campanha === 'string' && /^[a-z0-9-]{1,60}$/.test(req.query.campanha)
      ? req.query.campanha
      : null;

    const r = await chamarSupabase(cfg, '/rest/v1/rpc/colinha_painel', {
      method: 'POST',
      body: JSON.stringify({ dias, camp: campanha }),
    });

    if (r.falhou) {
      console.error('[colinha] painel falhou:', r.motivo);
      return res.status(502).json({ erro: 'não foi possível ler os dados', detalhe: r.motivo });
    }

    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json(r.dados);
  } catch (e) {
    console.error('[colinha] erro inesperado no painel:', e);
    return res.status(500).json({ erro: 'erro inesperado no painel', detalhe: e.message });
  }
}
