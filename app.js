/* ==================================================================
   Colinha de votação — motor da página
   Monta as linhas dos cargos, busca o candidato pelo número na base
   e exporta o santinho como imagem 4:5.
   ================================================================== */
(function () {
  'use strict';

  var CFG = Object.assign({
    titulo: 'Minha Colinha',
    site: '',
    urlVoltar: '/',
    slug: 'colinha',
    textoLegal: '',
    cores: {},
    headerImagem: '',
    footerImagem: '',
    seloImagem: '',
    candidatoFixo: null,
    baseCandidatos: 'candidatos.json',
    pastaFotos: 'fotos/',
    apiEventos: ''
  }, window.COLINHA_CONFIG || {});

  // Ordem dos cargos igual à da urna, com a quantidade de dígitos de cada um
  var CARGOS = [
    { key: 'federal',    label: 'DEPUTADO FEDERAL',  base: 'federal',    digitos: 4 },
    { key: 'estadual',   label: 'DEPUTADO ESTADUAL', base: 'estadual',   digitos: 5 },
    { key: 'senador1',   label: 'SENADOR (1º VOTO)', base: 'senador',    digitos: 3 },
    { key: 'senador2',   label: 'SENADOR (2º VOTO)', base: 'senador',    digitos: 3 },
    { key: 'governador', label: 'GOVERNADOR',        base: 'governador', digitos: 2 },
    { key: 'presidente', label: 'PRESIDENTE',        base: 'presidente', digitos: 2 }
  ];

  var CHAVE_MEMORIA = 'colinha:' + CFG.slug;
  var ICONE_VAZIO = '👤'; // silhueta, quando ainda não há candidato
  var ICONE_ERRO = '❓';        // interrogação, quando o número não existe

  var base = {};
  var linhas = {};   // key -> { input, boxes, info, foto, cargo }
  var fixo = normalizarFixo(CFG.candidatoFixo);

  function $(id) { return document.getElementById(id); }

  function normalizarFixo(c) {
    if (!c || !c.cargo || !c.numero) return null;
    var f = Object.assign({}, c);
    f.cargo = String(f.cargo) === 'senador' ? 'senador1' : String(f.cargo);
    f.numero = String(f.numero).replace(/\D/g, '');
    return f.numero ? f : null;
  }

  /* ------------------------------ Config ------------------------------ */

  function aplicarConfig() {
    document.title = CFG.titulo || 'Minha Colinha';

    var raiz = document.documentElement.style;
    if (CFG.cores.azul) raiz.setProperty('--blue-brand', CFG.cores.azul);
    if (CFG.cores.verde) raiz.setProperty('--green-brand', CFG.cores.verde);
    if (CFG.cores.amarelo) raiz.setProperty('--yellow-brand', CFG.cores.amarelo);
    if (CFG.cores.fundoCard) raiz.setProperty('--bg-card', CFG.cores.fundoCard);

    var voltar = $('btn-voltar');
    if (CFG.urlVoltar) voltar.setAttribute('href', CFG.urlVoltar);
    else voltar.style.display = 'none';

    $('legal-vertical').textContent = CFG.textoLegal || '';
    $('footer-site').textContent = CFG.site || '';

    if (CFG.headerImagem) {
      var header = $('top-header');
      header.style.backgroundImage = 'url("' + CFG.headerImagem + '")';
      header.classList.add('tem-imagem');
    }
    if (CFG.footerImagem) {
      $('bottom-bar').style.backgroundImage = 'url("' + CFG.footerImagem + '")';
    }

    montarSelo();
  }

  function montarSelo() {
    var selo = $('badge');
    if (CFG.seloTamanho) {
      document.documentElement.style.setProperty('--badge-size', parseInt(CFG.seloTamanho, 10) + 'px');
    }
    if (!CFG.seloImagem && !fixo) { selo.classList.add('vazio'); return; }
    $('santinho').classList.add('com-selo');

    if (CFG.seloImagem) {
      var img = document.createElement('img');
      img.src = CFG.seloImagem;
      img.alt = fixo ? fixo.nome : 'Selo da campanha';
      img.setAttribute('crossorigin', 'anonymous');
      selo.appendChild(img);
      return;
    }

    var cargoDoFixo = CARGOS.filter(function (c) { return c.key === fixo.cargo; })[0];
    var arte = document.createElement('div');
    arte.className = 'badge-art';
    arte.innerHTML =
      '<span class="b-nome"></span>' +
      '<span class="b-numero"></span>' +
      '<span class="b-cargo"></span>';
    arte.querySelector('.b-nome').textContent = fixo.nome || '';
    arte.querySelector('.b-numero').textContent = fixo.numero;
    arte.querySelector('.b-cargo').textContent = cargoDoFixo ? cargoDoFixo.label : '';
    selo.appendChild(arte);
  }

  /* --------------------------- Linhas da urna -------------------------- */

  function criarCaixaFoto() {
    var box = document.createElement('div');
    box.className = 'photo-box';
    box.innerHTML = '<span class="search-icon"></span>';
    box.querySelector('.search-icon').textContent = ICONE_VAZIO;
    return box;
  }

  function definirFoto(box, src) {
    if (!src) { limparFoto(box, ICONE_VAZIO); return; }
    var img = document.createElement('img');
    img.setAttribute('crossorigin', 'anonymous');
    img.alt = '';
    img.onerror = function () { limparFoto(box, ICONE_VAZIO); };
    box.classList.add('com-foto');
    box.innerHTML = '';
    box.appendChild(img);
    img.src = src;
  }

  function limparFoto(box, icone) {
    box.classList.remove('com-foto');
    box.innerHTML = '<span class="search-icon"></span>';
    box.querySelector('.search-icon').textContent = icone;
  }

  function criarLinha(cargo) {
    var linha = document.createElement('div');
    linha.className = 'candidate-row';

    var foto = criarCaixaFoto();
    linha.appendChild(foto);

    var info = document.createElement('div');
    info.className = 'info-area';
    linha.appendChild(info);

    var titulo = document.createElement('div');
    titulo.className = 'role-header';
    titulo.innerHTML = '<span class="c-cargo"></span><span class="c-info"></span>';
    titulo.querySelector('.c-cargo').textContent = cargo.label;
    info.appendChild(titulo);

    var acao = document.createElement('div');
    acao.className = 'action-row';
    info.appendChild(acao);

    var container = document.createElement('div');
    container.className = 'digit-container';
    acao.appendChild(container);

    var eFixo = fixo && fixo.cargo === cargo.key;
    var boxes = [];
    for (var i = 0; i < cargo.digitos; i++) {
      var caixa = document.createElement('div');
      caixa.className = 'digit-box' + (eFixo ? ' box-destaque' : '');
      container.appendChild(caixa);
      boxes.push(caixa);
    }

    var confirma = document.createElement('div');
    confirma.className = 'btn-confirma';
    confirma.textContent = 'CONFIRMA';
    acao.appendChild(confirma);

    var input = null;
    if (eFixo) {
      preencherFixo(cargo, boxes, titulo.querySelector('.c-info'), foto);
    } else {
      input = document.createElement('input');
      input.type = 'tel';
      input.className = 'hidden-input';
      input.id = 'input-' + cargo.key;
      input.maxLength = cargo.digitos;
      input.autocomplete = 'off';
      input.setAttribute('inputmode', 'numeric');
      input.setAttribute('aria-label', cargo.label);
      container.appendChild(input);
    }

    linhas[cargo.key] = {
      cargo: cargo,
      input: input,
      boxes: boxes,
      info: titulo.querySelector('.c-info'),
      foto: foto,
      fixo: !!eFixo
    };

    return linha;
  }

  function preencherFixo(cargo, boxes, info, foto) {
    if (fixo.numero.length !== cargo.digitos) {
      console.warn('[colinha] o número do candidato fixo tem ' + fixo.numero.length +
        ' dígito(s), mas ' + cargo.label + ' usa ' + cargo.digitos + '.');
    }
    boxes.forEach(function (caixa, i) {
      caixa.textContent = fixo.numero[i] || '';
    });
    escreverNome(info, fixo.nome, fixo.partido);
    definirFoto(foto, fixo.foto);
  }

  function escreverNome(info, nome, partido) {
    info.innerHTML = '';
    if (!nome) return;
    info.appendChild(document.createTextNode('| '));
    var elNome = document.createElement('span');
    elNome.className = 'c-nome';
    elNome.textContent = nome;
    info.appendChild(elNome);
    if (partido) {
      info.appendChild(document.createTextNode(' '));
      var elPartido = document.createElement('span');
      elPartido.className = 'c-partido';
      elPartido.textContent = partido;
      info.appendChild(elPartido);
    }
  }

  function montarLinhas() {
    var alvo = $('linhas');
    CARGOS.forEach(function (cargo) { alvo.appendChild(criarLinha(cargo)); });

    CARGOS.forEach(function (cargo) {
      var linha = linhas[cargo.key];
      if (!linha.input) return;
      var input = linha.input;

      input.addEventListener('focus', function () { marcarFoco(linha, true); });
      input.addEventListener('blur', function () { marcarFoco(linha, false); });
      input.addEventListener('input', function (e) {
        var val = String(e.target.value).replace(/\D/g, '').slice(0, cargo.digitos);
        e.target.value = val;
        aplicarNumero(cargo.key, val);
        marcarFoco(linha, true);
        salvarMemoria();
      });
    });
  }

  function marcarFoco(linha, focado) {
    var preenchidos = linha.input ? linha.input.value.length : 0;
    linha.boxes.forEach(function (caixa) { caixa.classList.remove('current'); });
    if (focado && preenchidos < linha.boxes.length) {
      linha.boxes[preenchidos].classList.add('current');
    }
  }

  /* -------------------------- Busca na base --------------------------- */

  function aplicarNumero(key, val) {
    var linha = linhas[key];
    if (!linha || linha.fixo) return;

    var cargo = linha.cargo;
    val = String(val || '').replace(/\D/g, '').slice(0, cargo.digitos);
    if (linha.input && linha.input.value !== val) linha.input.value = val;

    linha.boxes.forEach(function (caixa, i) {
      caixa.textContent = val[i] || '';
    });

    if (val.length < cargo.digitos) {
      escreverNome(linha.info, '', '');
      limparFoto(linha.foto, ICONE_VAZIO);
      return;
    }

    var tabela = base[cargo.base] || {};
    var candidato = tabela[val];

    if (candidato) {
      escreverNome(linha.info, candidato.nome, candidato.partido);
      definirFoto(linha.foto, candidato.foto ? CFG.pastaFotos + candidato.foto : '');
      return;
    }

    // Sem base carregada para o cargo, o número vale por si (não acusa erro)
    if (!Object.keys(tabela).length) {
      escreverNome(linha.info, '', '');
      limparFoto(linha.foto, ICONE_VAZIO);
      return;
    }

    linha.info.innerHTML = '';
    linha.info.appendChild(document.createTextNode('| '));
    var erro = document.createElement('span');
    erro.className = 'c-erro';
    erro.textContent = 'Número não encontrado';
    linha.info.appendChild(erro);
    limparFoto(linha.foto, ICONE_ERRO);
  }

  function carregarBase() {
    return fetch(CFG.baseCandidatos, { cache: 'no-cache' })
      .then(function (r) {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.json();
      })
      .then(function (dados) {
        base = dados || {};
        // Renumera o que já estava preenchido, agora com nome e foto
        CARGOS.forEach(function (cargo) {
          var linha = linhas[cargo.key];
          if (linha.input && linha.input.value) aplicarNumero(cargo.key, linha.input.value);
        });
      })
      .catch(function (e) {
        console.warn('[colinha] não foi possível ler ' + CFG.baseCandidatos + ':', e.message);
      });
  }

  /* ------------------------ Memória e link ---------------------------- */

  function estadoAtual() {
    var estado = {};
    CARGOS.forEach(function (cargo) {
      var linha = linhas[cargo.key];
      if (linha.input && linha.input.value) estado[cargo.key] = linha.input.value;
    });
    return estado;
  }

  function aplicarEstado(estado) {
    if (!estado) return;
    CARGOS.forEach(function (cargo) {
      if (estado[cargo.key]) aplicarNumero(cargo.key, estado[cargo.key]);
    });
  }

  function salvarMemoria() {
    try {
      localStorage.setItem(CHAVE_MEMORIA, JSON.stringify(estadoAtual()));
    } catch (e) { /* navegação privada, sem problema */ }
  }

  function lerMemoria() {
    try {
      return JSON.parse(localStorage.getItem(CHAVE_MEMORIA) || 'null');
    } catch (e) { return null; }
  }

  function lerLink() {
    var hash = location.hash.replace(/^#/, '');
    if (!hash) return null;
    var estado = {};
    var achou = false;
    new URLSearchParams(hash).forEach(function (valor, chave) {
      if (linhas[chave]) { estado[chave] = valor; achou = true; }
    });
    return achou ? estado : null;
  }

  function linkDaColinha() {
    var estado = estadoAtual();
    var params = new URLSearchParams(estado).toString();
    var url = location.origin + location.pathname;
    return params ? url + '#' + params : url;
  }

  /* ---------------------------- Medição ------------------------------- */
  /* Conta acesso e números digitados de forma anônima. Não guarda IP nem
     nada que identifique o eleitor: só um id de sessão aleatório do próprio
     navegador. Se a API não estiver configurada, não faz nada. */

  var CHAVE_SESSAO = 'colinha:sessao:' + CFG.slug;
  var numerosJaEnviados = '';

  function novaSessao() {
    var bytes = new Uint8Array(12);
    if (window.crypto && window.crypto.getRandomValues) window.crypto.getRandomValues(bytes);
    else for (var i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
    var texto = '';
    for (var j = 0; j < bytes.length; j++) texto += ('0' + bytes[j].toString(16)).slice(-2);
    return texto;
  }

  function sessao() {
    var id;
    try { id = localStorage.getItem(CHAVE_SESSAO); } catch (e) { id = null; }
    if (!id || !/^[a-z0-9]{8,40}$/.test(id)) {
      id = novaSessao();
      try { localStorage.setItem(CHAVE_SESSAO, id); } catch (e) { /* navegação privada */ }
    }
    return id;
  }

  function enviarEvento(tipo, comNumeros) {
    if (!CFG.apiEventos) return;

    var numeros = comNumeros ? estadoAtual() : {};
    if (comNumeros) {
      var assinatura = JSON.stringify(numeros);
      if (assinatura === '{}') return;
      if (tipo === 'parcial' && assinatura === numerosJaEnviados) return;
      numerosJaEnviados = assinatura;
    }

    var json = JSON.stringify({ campanha: CFG.slug, tipo: tipo, sessao: sessao(), numeros: numeros });

    try {
      if (tipo === 'parcial' && navigator.sendBeacon) {
        navigator.sendBeacon(CFG.apiEventos, new Blob([json], { type: 'application/json' }));
        return;
      }
      fetch(CFG.apiEventos, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: json,
        keepalive: true
      }).catch(function () { /* medição nunca atrapalha a colinha */ });
    } catch (e) { /* idem */ }
  }

  /* ---------------------------- Exportação ---------------------------- */

  function salvarImagem() {
    enviarEvento('salvou', true);
    var btn = $('btn-salvar');
    var textoOriginal = btn.textContent;
    btn.textContent = 'GERANDO IMAGEM...';
    btn.disabled = true;

    if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
    var alvo = $('santinho');
    alvo.querySelectorAll('.digit-box.current').forEach(function (c) { c.classList.remove('current'); });
    alvo.classList.add('capturando');

    function terminar() {
      alvo.classList.remove('capturando');
      btn.textContent = textoOriginal;
      btn.disabled = false;
    }

    html2canvas(alvo, {
      scale: 3,
      backgroundColor: CFG.cores.fundoCard || '#e4e4db',
      useCORS: true,
      logging: false
    }).then(function (canvas) {
      alvo.classList.remove('capturando');
      var nomeArquivo = CFG.slug + '.png';

      if (canvas.toBlob && navigator.canShare) {
        canvas.toBlob(function (blob) {
          var arquivo = new File([blob], nomeArquivo, { type: 'image/png' });
          if (navigator.canShare({ files: [arquivo] })) {
            navigator.share({ files: [arquivo], title: CFG.titulo })
              .then(terminar)
              .catch(function () { baixar(canvas, nomeArquivo, terminar); });
          } else {
            baixar(canvas, nomeArquivo, terminar);
          }
        }, 'image/png');
      } else {
        baixar(canvas, nomeArquivo, terminar);
      }
    }).catch(function (e) {
      console.error('[colinha]', e);
      alert('Não foi possível gerar a imagem. Tente novamente.');
      terminar();
    });
  }

  function baixar(canvas, nomeArquivo, terminar) {
    var ehIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
    var dados = canvas.toDataURL('image/png', 1.0);

    if (ehIOS) {
      // No iPhone o download direto não funciona: mostra a imagem para segurar e salvar
      var tela = document.createElement('div');
      tela.className = 'ios-save';
      tela.innerHTML =
        '<h2>Pressione e segure a imagem para salvar 👇</h2>' +
        '<p>Depois de salvar, você pode voltar para a colinha.</p>' +
        '<img alt="Minha colinha">' +
        '<br><a>Voltar para a colinha</a>';
      tela.querySelector('img').src = dados;
      tela.querySelector('a').href = location.href;
      document.body.innerHTML = '';
      document.body.appendChild(tela);
      return;
    }

    var link = document.createElement('a');
    link.download = nomeArquivo;
    link.href = dados;
    link.click();
    if (terminar) terminar();
  }

  function compartilhar() {
    enviarEvento('compartilhou', true);
    var url = linkDaColinha();
    if (navigator.share) {
      navigator.share({
        title: CFG.titulo,
        text: 'Monte a sua colinha e não erre o número na urna.',
        url: url
      }).catch(function () { /* cancelado */ });
      return;
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(url).then(function () {
        alert('Link da colinha copiado!');
      }).catch(function () { prompt('Copie o link da sua colinha:', url); });
      return;
    }
    prompt('Copie o link da sua colinha:', url);
  }

  function limpar() {
    CARGOS.forEach(function (cargo) {
      if (linhas[cargo.key].input) aplicarNumero(cargo.key, '');
    });
    salvarMemoria();
    if (location.hash) history.replaceState(null, '', location.pathname);
  }

  /* ------------------------------ Início ------------------------------ */

  aplicarConfig();
  montarLinhas();
  aplicarEstado(lerLink() || lerMemoria());
  carregarBase();

  // Se alguém abrir um link compartilhado com a página já aberta
  window.addEventListener('hashchange', function () {
    var estado = lerLink();
    if (estado) { aplicarEstado(estado); salvarMemoria(); }
  });

  enviarEvento('acesso', false);

  // quem preenche e sai sem salvar também conta
  window.addEventListener('pagehide', function () { enviarEvento('parcial', true); });
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'hidden') enviarEvento('parcial', true);
  });

  $('btn-salvar').addEventListener('click', salvarImagem);
  $('btn-compartilhar').addEventListener('click', compartilhar);
  $('btn-limpar').addEventListener('click', limpar);
})();
