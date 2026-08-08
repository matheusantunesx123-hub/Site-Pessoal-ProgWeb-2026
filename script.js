// ============================================================
// CONFIGURAÇÃO DA API DO TMDB
// ============================================================
// 1. Crie uma conta gratuita em https://www.themoviedb.org/
// 2. Vá em Configurações > API e solicite uma chave (aprovação
//    costuma ser quase instantânea para uso pessoal/não-comercial)
// 3. Cole abaixo o seu "API Read Access Token" (v4 auth)
// ============================================================

const TMDB_API_KEY = dcd47c0c799d5f1d53ef2611a309ed68

// Lista de filmes e séries que você quer mostrar (edite como quiser)
// tipo: "movie" para filme, "tv" para série
const TITULOS = [
    { nome: "O Senhor dos Anéis: O Retorno do Rei", tipo: "movie" },
    { nome: "Matrix", tipo: "movie" },
    { nome: "Jogos Vorazes", tipo: "movie" },
    { nome: "De Volta Para o Futuro", tipo: "movie" },
    { nome: "Breaking Bad", tipo: "tv" },
    { nome: "Stranger Things", tipo: "tv" }
];

const TMDB_BASE_URL = "https://api.themoviedb.org/3";
const TMDB_IMG_BASE = "https://image.tmdb.org/t/p/w500";

async function buscarTitulo(nome, tipo) {
    const url = `${TMDB_BASE_URL}/search/${tipo}?query=${encodeURIComponent(nome)}&language=pt-BR`;

    const resposta = await fetch(url, {
        headers: {
            Authorization: `Bearer ${TMDB_API_KEY}`,
            accept: "application/json"
        }
    });

    if (!resposta.ok) {
        throw new Error(`Erro ao buscar "${nome}": ${resposta.status}`);
    }

    const dados = await resposta.json();
    return dados.results && dados.results.length > 0 ? dados.results[0] : null;
}

function criarCard(resultado, item) {
    const card = document.createElement("div");
    card.className = "card-filme";

    const tituloTexto = resultado ? (resultado.title || resultado.name) : item.nome;

    const titulo = document.createElement("h2");
    titulo.textContent = tituloTexto;
    card.appendChild(titulo);

    const img = document.createElement("img");
    if (resultado && resultado.poster_path) {
        img.src = `${TMDB_IMG_BASE}${resultado.poster_path}`;
        img.alt = `Pôster de ${tituloTexto}`;
    } else {
        img.alt = `Pôster não encontrado para ${item.nome}`;
    }
    card.appendChild(img);

    const dataLancamento = resultado && (resultado.release_date || resultado.first_air_date);
    if (dataLancamento) {
        const ano = document.createElement("p");
        ano.textContent = dataLancamento.split("-")[0];
        card.appendChild(ano);
    }

    const selo = document.createElement("span");
    selo.className = "selo-tipo";
    selo.textContent = item.tipo === "tv" ? "Série" : "Filme";
    card.appendChild(selo);

    return card;
}

async function montarTitulos() {
    const container = document.getElementById("filme-lista");
    const status = document.getElementById("filme-status");

    if (!TMDB_API_KEY || TMDB_API_KEY === dcd47c0c799d5f1d53ef2611a309ed68) {
        status.textContent = "Configure sua chave da API do TMDB no arquivo script.js para exibir os filmes e séries.";
        return;
    }

    container.innerHTML = "";

    for (const item of TITULOS) {
        try {
            const resultado = await buscarTitulo(item.nome, item.tipo);
            container.appendChild(criarCard(resultado, item));
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
// ARRASTAR O CARROSSEL NA HORIZONTAL (mouse e touch)
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

    // Mouse
    container.addEventListener("mousedown", (e) => {
        comecarArraste(e.pageX);
        e.preventDefault();
    });
    window.addEventListener("mousemove", (e) => moverArraste(e.pageX));
    window.addEventListener("mouseup", pararArraste);

    // Touch (celular/tablet)
    container.addEventListener("touchstart", (e) => {
        comecarArraste(e.touches[0].pageX);
    });
    container.addEventListener("touchmove", (e) => moverArraste(e.touches[0].pageX));
    container.addEventListener("touchend", pararArraste);
}

document.addEventListener("DOMContentLoaded", montarTitulos);
