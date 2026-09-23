const projetos = [
  { nome: "projeto-ia", ext: "py", descricao: "Modelo aplicado a um problema real...", tags: ["python", "ml", "sql"] },
  { nome: "projeto-python", ext: "py", descricao: "Automação e análise de dados...", tags: ["python", "git"] },
  { nome: "projeto-web", ext: "js", descricao: "Aplicação web full-stack...", tags: ["javascript", "linux"] },
];

function criarCardHTML(p) {
  const tags = p.tags.map(t => `<span class="tag">${t}</span>`).join("");
  return `
    <div class="card">
      <p class="card-title"><span class="dot"></span>${p.nome}<span class="ext">.${p.ext}</span></p>
      <p class="desc">${p.descricao}</p>
      <div class="tags">${tags}</div>
    </div>`;
}

function renderizarProjetos() {
  const container = document.getElementById("projetos-lista");
  container.innerHTML = projetos.map(criarCardHTML).join("");
}

renderizarProjetos();