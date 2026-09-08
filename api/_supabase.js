/* ==================================================================
   Acesso ao Supabase pelas funções.
   Arquivos com _ na frente não viram rota na Vercel.

   Aqui mora a parte chata: ler as variáveis de ambiente sem confiar
   nelas, normalizar a URL (falta de https://, barra sobrando, espaço
   colado) e nunca deixar um erro de rede virar 500 sem explicação.
   ================================================================== */

export function lerConfig() {
  var bruta = (process.env.SUPABASE_URL || '').trim().replace(/^["']|["']$/g, '');
  var chave = (process.env.SUPABASE_SERVICE_KEY || '').trim().replace(/^["']|["']$/g, '');

  if (!bruta) return { erro: 'falta a variável SUPABASE_URL' };
  if (!chave) return { erro: 'falta a variável SUPABASE_SERVICE_KEY' };

  // quem cola só o host ("abc.supabase.co") não deveria ser punido com erro 500
  var comEsquema = /^https?:\/\//i.test(bruta) ? bruta : 'https://' + bruta;

  var url;
  try {
    url = new URL(comEsquema);
  } catch (e) {
    return { erro: 'SUPABASE_URL não é uma URL válida: "' + bruta + '"' };
  }

  if (!/^https?:$/.test(url.protocol)) {
    return { erro: 'SUPABASE_URL precisa começar com https:// (veio "' + bruta + '")' };
  }
  if (/^sb_/.test(bruta) || /^eyJ/.test(bruta)) {
    return { erro: 'SUPABASE_URL parece ter recebido uma chave em vez do endereço do projeto' };
  }
  // new URL() aceita host com caractere estranho; um domínio de verdade tem ponto
  if (!/^[a-z0-9-]+(\.[a-z0-9-]+)+$/i.test(url.hostname)) {
    return { erro: 'SUPABASE_URL tem um domínio estranho: "' + url.hostname + '"' };
  }

  return { base: url.origin, chave: chave };
}

/* Chama a REST do Supabase e devolve sempre um objeto — nunca lança. */
export async function chamarSupabase(cfg, caminho, opcoes) {
  var alvo = cfg.base + caminho;
  var resposta;

  try {
    resposta = await fetch(alvo, {
      method: (opcoes && opcoes.method) || 'GET',
      headers: Object.assign({
        apikey: cfg.chave,
        Authorization: 'Bearer ' + cfg.chave,
        'Content-Type': 'application/json',
      }, (opcoes && opcoes.headers) || {}),
      body: opcoes && opcoes.body,
    });
  } catch (e) {
    // DNS errado, projeto pausado, rede fora: erro de transporte, não de dado
    return { falhou: true, motivo: 'não consegui alcançar ' + alvo + ' (' + e.message + ')' };
  }

  var texto = '';
  try { texto = await resposta.text(); } catch (e) { /* corpo vazio serve */ }

  if (!resposta.ok) {
    return {
      falhou: true,
      status: resposta.status,
      motivo: 'o Supabase respondeu ' + resposta.status + ': ' + texto.slice(0, 300),
    };
  }

  if (!texto) return { dados: null };

  try {
    return { dados: JSON.parse(texto) };
  } catch (e) {
    return { falhou: true, motivo: 'resposta do Supabase não era JSON: ' + texto.slice(0, 200) };
  }
}
