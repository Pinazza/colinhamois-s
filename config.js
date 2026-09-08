/* ==================================================================
   CONFIGURAÇÃO DA COLINHA
   Este é o único arquivo que precisa ser editado para a campanha.
   ================================================================== */
window.COLINHA_CONFIG = {

  /* ---------------------------- Identidade ---------------------------- */

  // Aparece na aba do navegador
  titulo: 'Minha Colinha - Moises Selerges 1355',

  // Aparece no rodapé do santinho (dentro da imagem gerada)
  site: 'seusite.com.br',

  // Para onde vai o link "Voltar para a página principal"
  urlVoltar: '/',

  // Usado no nome do arquivo da imagem salva e na chave de memória do navegador
  slug: 'colinha-moises-selerges-1355',

  // Texto legal obrigatório do material de campanha (fica na vertical, na lateral).
  // Deixe em branco ('') para não exibir.
  // >>> FALTA O CNPJ DA CAMPANHA <<<  (nome de registro no TSE: MOISES SELERGES JUNIOR)
  textoLegal: 'ELEIÇÃO 2026 MOISES SELERGES JUNIOR DEPUTADO FEDERAL - CNPJ 00.000.000/0001-00',

  /* ------------------------------ Cores ------------------------------- */

  cores: {
    azul: '#0b4a9e',      // quadradinhos dos números, textos e botões
    verde: '#29a738',     // faixa "COMO VOTAR" e botão CONFIRMA
    amarelo: '#ffce00',   // número do candidato fixo e detalhes
    fundoCard: '#e4e4db', // fundo do santinho
  },

  /* ------------------------- Artes (opcionais) ------------------------- */
  // Se você tem a arte pronta (Illustrator/Canva), aponte os arquivos aqui.
  // Deixando em branco, a página desenha o cabeçalho, o rodapé e o selo em CSS.

  headerImagem: '',              // ex.: 'assets/header.jpg'  (400 x 68 px)
  footerImagem: '',              // ex.: 'assets/footer.jpg'  (400 x 16 px)
  seloImagem: '',                // ex.: 'assets/selo.png'    (110 x 110 px, PNG transparente)
  seloTamanho: 110,              // lado do selo em px (0 a 130 funciona bem)

  /* -------------------------- Candidato fixo -------------------------- */
  // O candidato dono da colinha: o número já vem preenchido e em destaque,
  // e o eleitor não consegue apagar. Use null para não fixar ninguém.

  candidatoFixo: {
    cargo: 'federal',    // 'presidente' | 'governador' | 'senador1' | 'senador2' | 'federal' | 'estadual'
    numero: '1355',      // precisa ter a mesma quantidade de dígitos do cargo
    nome: 'Moises Selerges',
    partido: 'PT',
    // foto oficial do TSE; troque por uma foto de campanha em 'assets/' se preferir
    foto: 'fotos/FSP250002536738_div.jpg',
  },

  /* ---------------------------- Base de dados -------------------------- */

  // Arquivo com os candidatos (nome, partido e foto por número)
  baseCandidatos: 'candidatos.json',

  // Pasta onde estão as fotos citadas na base
  pastaFotos: 'fotos/',

  /* ------------------------- Medição de acessos ------------------------ */
  // Endpoint que grava os eventos (o painel fica em /admin).
  // Deixe '' para desligar a medição por completo.
  apiEventos: '/api/evento',
};
