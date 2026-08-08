// ============================================================
// CONFIGURAÇÃO DA API DO TMDB
// ============================================================
// 1. Crie uma conta gratuita em https://www.themoviedb.org/
// 2. Vá em Configurações > API e solicite uma chave (aprovação
//    costuma ser quase instantânea para uso pessoal/não-comercial)
// 3. Cole abaixo o seu "API Read Access Token" (v4 auth) ou sua
//    "API Key" (v3 auth) — o código detecta os dois formatos.
// ============================================================

const TMDB_API_KEY = "eyJhbGciOiJIUzI1NiJ9.eyJhdWQiOiJkY2Q0N2MwYzc5OWQ1ZjFkNTNlZjI2MTFhMzA5ZWQ2OCIsIm5iZiI6MTc4NjE1NDk4OS44NzksInN1YiI6IjZhNzY4ZmVkZWQwZjkwNzc2YmJiYjUyYSIsInNjb3BlcyI6WyJhcGlfcmVhZCJdLCJ2ZXJzaW9uIjoxfQ.6Fg_360iglwt0-ExGGcUmOdB3oeD1d7zTf4y410-4co";

// Lista de filmes e séries que você quer mostrar na primeira seção (edite como quiser)
// tipo: "movie" para filme, "tv" para série
const TITULOS = [
    { nome: "O Senhor dos Anéis: O Retorno do Rei", tipo: "movie" },
    { nome: "Matrix", tipo: "movie" },
    { nome: "Jogos Vorazes", tipo: "movie" },
    { nome: "De Volta Para o Futuro", tipo: "movie" },
    { nome: "Breaking Bad", tipo: "tv" },
    { nome: "Stranger Things", tipo: "tv" }
];

// Arquivo do diário do Letterboxd (o RSS exportado, salvo no projeto).
// Sempre que quiser atualizar, baixe de novo em https://letterboxd.com/SEU_USUARIO/rss/
// e substitua o conteúdo do arquivo diario.xml.
const ARQUIVO_DIARIO = "diario.xml";

const TMDB_BASE_URL = "https://api.themoviedb.org/3";
const TMDB_IMG_BASE = "https://image.tmdb.org/t/p/w500";

// ============================================================
// BUSCA NO TMDB
// ============================================================
async function buscarTitulo(nome, tipo, ano) {
    // Detecta se é uma API Key v3 (32 caracteres, formato hexadecimal)
    // ou um Read Access Token v4 (token longo tipo JWT)
    const ehChaveV3 = /^[a-f0-9]{32}$/i.test(TMDB_API_KEY);

    let url = `${TMDB_BASE_URL}/search/${tipo}?query=${encodeURIComponent(nome)}&language=pt-BR`;
    if (ano) url += `&year=${ano}`;

    const opcoes = { headers: { accept: "application/json" } };

    if (ehChaveV3) {
        url += `&api_key=${TMDB_API_KEY}`;
    } else {
        opcoes.headers.Authorization = `Bearer ${TMDB_API_KEY}`;
    }

    const resposta = await fetch(url, opcoes);

    if (!resposta.ok) {
        throw new Error(`Erro ao buscar "${nome}": ${resposta.status}`);
    }

    const dados = await resposta.json();
    return dados.results && dados.results.length > 0 ? dados.results[0] : null;
}

function criarCard(resultado, tituloOriginal, extras = {}) {
    const card = document.createElement("div");
    card.className = "card-filme";

    const tituloTexto = resultado ? (resultado.title || resultado.name) : tituloOriginal;

    const titulo = document.createElement("h2");
    titulo.textContent = tituloTexto;
    card.appendChild(titulo);

    const img = document.createElement("img");
    if (resultado && resultado.poster_path) {
        img.src = `${TMDB_IMG_BASE}${resultado.poster_path}`;
        img.alt = `Pôster de ${tituloTexto}`;
    } else {
        img.alt = `Pôster não encontrado para ${tituloOriginal}`;
    }
    card.appendChild(img);

    const dataLancamento = resultado && (resultado.release_date || resultado.first_air_date);
    if (dataLancamento) {
        const ano = document.createElement("p");
        ano.textContent = dataLancamento.split("-")[0];
        card.appendChild(ano);
    }

    if (extras.estrelas) {
        const estrelas = document.createElement("p");
        estrelas.className = "estrelas";
        estrelas.textContent = extras.estrelas;
        card.appendChild(estrelas);
    }

    if (extras.dataAssistida) {
        const dataAssistida = document.createElement("p");
        dataAssistida.className = "data-assistida";
        dataAssistida.textContent = `Assistido em ${extras.dataAssistida}`;
        card.appendChild(dataAssistida);
    }

    if (extras.selo) {
        const selo = document.createElement("span");
        selo.className = "selo-tipo";
        selo.textContent = extras.selo;
        card.appendChild(selo);
    }

    return card;
}

// ============================================================
// SEÇÃO 1: LISTA MANUAL DE FILMES E SÉRIES
// ============================================================
async function montarTitulos() {
    const container = document.getElementById("filme-lista");
    const status = document.getElementById("filme-status");

    if (!TMDB_API_KEY || TMDB_API_KEY === "COLOQUE_SUA_CHAVE_AQUI") {
        status.textContent = "Configure sua chave da API do TMDB no arquivo script.js para exibir os filmes e séries.";
        return;
    }

    container.innerHTML = "";

    for (const item of TITULOS) {
        try {
            const resultado = await buscarTitulo(item.nome, item.tipo);
            const card = criarCard(resultado, item.nome, { selo: item.tipo === "tv" ? "Série" : "Filme" });
            container.appendChild(card);
        } catch (erro) {
            console.error(erro);
            const cardErro = document.createElement("div");
            cardErro.className = "card-filme";
            cardErro.textContent = `Não foi possível carregar "${item.nome}".`;
            container.appendChild(cardErro);
        }
    }

    ativarArraste(container);
}

// ============================================================
// SEÇÃO 2: DIÁRIO DO LETTERBOXD (lido do arquivo diario.xml)
// ============================================================

function notaParaEstrelas(nota) {
    if (!nota && nota !== 0) return "";
    const numero = parseFloat(nota);
    const cheias = Math.floor(numero);
    const meia = numero % 1 !== 0;
    return "★".repeat(cheias) + (meia ? "½" : "");
}

function dataParaBR(dataISO) {
    if (!dataISO) return "";
    const [ano, mes, dia] = dataISO.split("-");
    return `${dia}/${mes}/${ano}`;
}

function textoDaTag(item, tag) {
    const elemento = item.getElementsByTagName(tag)[0];
    return elemento ? elemento.textContent.trim() : "";
}

async function montarDiario() {
    const container = document.getElementById("diario-lista");
    const status = document.getElementById("diario-status");

    if (!TMDB_API_KEY || TMDB_API_KEY === "COLOQUE_SUA_CHAVE_AQUI") {
        status.textContent = "Configure sua chave da API do TMDB no arquivo script.js para exibir o diário.";
        return;
    }

    let textoXml;
    try {
        const resposta = await fetch(ARQUIVO_DIARIO);
        if (!resposta.ok) throw new Error(`Não foi possível abrir ${ARQUIVO_DIARIO} (${resposta.status})`);
        textoXml = await resposta.text();
    } catch (erro) {
        console.error(erro);
        status.textContent = `Não foi possível carregar o arquivo ${ARQUIVO_DIARIO}.`;
        return;
    }

    const xml = new DOMParser().parseFromString(textoXml, "text/xml");
    const itens = Array.from(xml.getElementsByTagName("item"));

    if (itens.length === 0) {
        status.textContent = "Nenhum filme encontrado no diário.";
        return;
    }

    container.innerHTML = "";

    for (const item of itens) {
        const titulo = textoDaTag(item, "letterboxd:filmTitle");
        const ano = textoDaTag(item, "letterboxd:filmYear");
        const nota = textoDaTag(item, "letterboxd:memberRating");
        const dataAssistida = textoDaTag(item, "letterboxd:watchedDate");
        const rewatch = textoDaTag(item, "letterboxd:rewatch") === "Yes";

        try {
            const resultado = await buscarTitulo(titulo, "movie", ano);
            const card = criarCard(resultado, titulo, {
                estrelas: notaParaEstrelas(nota),
                dataAssistida: dataParaBR(dataAssistida),
                selo: rewatch ? "Revi" : null
            });
            container.appendChild(card);
        } catch (erro) {
            console.error(erro);
            const cardErro = document.createElement("div");
            cardErro.className = "card-filme";
            cardErro.textContent = `Não foi possível carregar "${titulo}".`;
            container.appendChild(cardErro);
        }
    }

    ativarArraste(container);
}

// ============================================================
// ARRASTAR CARROSSEL NA HORIZONTAL (mouse e touch)
// ============================================================
function ativarArraste(container) {
    let arrastando = false;
    let posInicialX = 0;
    let scrollInicial = 0;

    const comecarArraste = (x) => {
        arrastando = true;
        container.classList.add("arrastando");
        posInicialX = x;
        scrollInicial = container.scrollLeft;
    };

    const moverArraste = (x) => {
        if (!arrastando) return;
        const delta = x - posInicialX;
        container.scrollLeft = scrollInicial - delta;
    };

    const pararArraste = () => {
        arrastando = false;
        container.classList.remove("arrastando");
    };

    container.addEventListener("mousedown", (e) => {
        comecarArraste(e.pageX);
        e.preventDefault();
    });
    window.addEventListener("mousemove", (e) => moverArraste(e.pageX));
    window.addEventListener("mouseup", pararArraste);

    container.addEventListener("touchstart", (e) => {
        comecarArraste(e.touches[0].pageX);
    });
    container.addEventListener("touchmove", (e) => moverArraste(e.touches[0].pageX));
    container.addEventListener("touchend", pararArraste);
}

document.addEventListener("DOMContentLoaded", () => {
    montarTitulos();
    montarDiario();
});
