import fs from "fs";
import path from "path";

const ROOT = path.resolve(import.meta.dirname, "..");

function extractSlideContainers(html) {
  const slides = [];
  const marker = '<div class="slide-container">';
  let searchFrom = 0;
  while (true) {
    const start = html.indexOf(marker, searchFrom);
    if (start === -1) break;
    let depth = 0;
    let i = start;
    let found = false;
    while (i < html.length) {
      if (html.startsWith("<div", i)) depth++;
      if (html.startsWith("</div>", i)) {
        depth--;
        if (depth === 0) {
          const slideHtml = html.slice(start, i + 6);
          const passoMatch = slideHtml.match(/Passo (\d+)\/(\d+)/);
          slides.push({
            html: slideHtml,
            passo: passoMatch ? Number(passoMatch[1]) : null,
            isGuided: !!passoMatch,
            isDivider:
              !passoMatch &&
              /font-extrabold uppercase text-brand-500/.test(slideHtml) &&
              /<h2[^>]*>[^<]*(Página de|Deploy no|Projeto)/.test(slideHtml),
          });
          searchFrom = i + 6;
          found = true;
          break;
        }
      }
      i++;
    }
    if (!found) break;
  }
  return slides;
}

function renumberSlide(slideHtml, newNum, newTotal) {
  return slideHtml.replace(/Passo \d+\/\d+/g, `Passo ${newNum}/${newTotal}`);
}

function findGuidedSlides(slides) {
  return slides.filter((s) => s.isGuided);
}

function findSlideByPasso(slides, n) {
  return slides.find((s) => s.passo === n);
}

function findInsertIndex(slides, predicate) {
  return slides.findIndex(predicate);
}

function replaceBetween(html, startMarker, endMarker, replacement) {
  const start = html.indexOf(startMarker);
  const end = html.indexOf(endMarker, start);
  if (start === -1 || end === -1) throw new Error(`Markers not found: ${startMarker} / ${endMarker}`);
  return html.slice(0, start) + replacement + html.slice(end);
}

function getSlidesDeckBounds(html) {
  const deckStart = html.indexOf('<div class="slides-deck">');
  const deckClose = html.lastIndexOf("</div>\n\n<script");
  return { deckStart, deckClose };
}

function rebuildModule(html, beforeGuided, guidedSlidesHtml, afterGuided) {
  const { deckStart, deckClose } = getSlidesDeckBounds(html);
  const deckInnerStart = html.indexOf(">", deckStart) + 1;
  const before = html.slice(0, deckInnerStart) + beforeGuided;
  const guided = guidedSlidesHtml.join("\n\n  ");
  const after = afterGuided + html.slice(deckClose);
  return before + guided + "\n\n  " + after;
}

function sliceSlidesFromModule(html, fromPasso, toPasso) {
  const slides = extractSlideContainers(html);
  return slides.filter((s) => s.passo !== null && s.passo >= fromPasso && s.passo <= toPasso);
}

function getDividerAfter(slides, titlePattern) {
  return slides.find(
    (s) => s.isDivider && new RegExp(titlePattern, "i").test(s.html)
  );
}

// --- Read files ---
const m1 = fs.readFileSync(path.join(ROOT, "modulo-1-intro-setup.html"), "utf8");
const m2 = fs.readFileSync(path.join(ROOT, "modulo-2-rotas-layouts.html"), "utf8");
const m3 = fs.readFileSync(path.join(ROOT, "modulo-3-componentes-client.html"), "utf8");
const m4 = fs.readFileSync(path.join(ROOT, "modulo-4-dados-deploy.html"), "utf8");

const m4Slides = extractSlideContainers(m4);
const m2Slides = extractSlideContainers(m2);
const m3Slides = extractSlideContainers(m3);

// Extract M4 chunks
const m4Home = sliceSlidesFromModule(m4, 1, 7);
const m4PricingDivider = getDividerAfter(m4Slides, "Página de Preços");
const m4Pricing = sliceSlidesFromModule(m4, 8, 15);
const m4ContactDivider = getDividerAfter(m4Slides, "Página de Contato");
const m4Contact = sliceSlidesFromModule(m4, 16, 20);
const m4DeployDivider = getDividerAfter(m4Slides, "Deploy no GitHub");
const m4Deploy = sliceSlidesFromModule(m4, 21, 45);

// Merge contact form slides 18+19 for M2 balance
function mergeContactFormSlides(slide18, slide19) {
  const merged = slide18.html.replace(
    /Passo \d+\/\d+ · <span class="text-brand-500">ContactForm<\/span> · estado/,
    'Passo PLACEHOLDER/20 · <span class="text-brand-500">ContactForm</span> · completo'
  );
  const fieldsTitle = slide19.html.match(/<h2[^>]*>([^<]+ContactForm[^<]*)<\/h2>/);
  const fieldsPre = slide19.html.match(/<pre[\s\S]*?<\/pre>/);
  if (fieldsPre) {
    return {
      html:
        merged.replace(/<\/div>\s*<\/div>\s*<\/div>\s*$/, "") +
        `\n      <p class="mt-4 mb-3 text-lg text-slate-300">Campos do formulário:</p>\n      <div class="mt-3 w-full overflow-hidden rounded-xl border border-slate-700 bg-slate-900 font-mono shadow-xl">\n        ${fieldsPre[0]}\n      </div>\n    </div>\n  </div>`,
    };
  }
  return { html: merged };
}

const contactMergedForm = mergeContactFormSlides(
  findSlideByPasso(m4Slides, 18),
  findSlideByPasso(m4Slides, 19)
);

// --- Build M2 guided (20 steps) ---
const M2_TOTAL = 20;
const m2GuidedBase = m2Slides.filter((s) => s.isGuided && s.passo <= 9);
const m2NewGuided = [
  ...m2GuidedBase.map((s, i) => ({
    html: renumberSlide(s.html, i + 1, M2_TOTAL),
  })),
  { html: m4PricingDivider.html },
  ...m4Pricing.map((s, i) => ({
    html: renumberSlide(s.html, 10 + i, M2_TOTAL),
  })),
  { html: m4ContactDivider.html.replace(
    "Formulário interativo com estado local e canais diretos.",
    "Complete a rota /contato com dados, canais e formulário interativo."
  ) },
  { html: renumberSlide(findSlideByPasso(m4Slides, 16).html, 18, M2_TOTAL) },
  { html: renumberSlide(findSlideByPasso(m4Slides, 17).html, 19, M2_TOTAL) },
  {
    html: renumberSlide(contactMergedForm.html.replace("PLACEHOLDER", "18"), 18, M2_TOTAL).replace(
      /Passo 18\/20/,
      "Passo 18/20"
    ),
  },
  { html: renumberSlide(findSlideByPasso(m4Slides, 20).html, 19, M2_TOTAL) },
];

// Fix numbering for M2 contact section (18-20)
m2NewGuided[m2NewGuided.length - 3] = {
  html: renumberSlide(findSlideByPasso(m4Slides, 16).html, 18, M2_TOTAL),
};
m2NewGuided[m2NewGuided.length - 2] = {
  html: renumberSlide(findSlideByPasso(m4Slides, 17).html, 19, M2_TOTAL),
};
// Rebuild contact form as 19 and page as 20
const formHtml = contactMergedForm.html.replace(/Passo PLACEHOLDER\/20/, "Passo 19/20");
m2NewGuided[m2NewGuided.length - 2] = { html: formHtml };
m2NewGuided[m2NewGuided.length - 1] = {
  html: renumberSlide(findSlideByPasso(m4Slides, 20).html, 20, M2_TOTAL),
};

// Update M2 pricing divider text
m2NewGuided[9] = {
  html: m4PricingDivider.html.replace(
    "Substitua o placeholder do M2 por planos interativos, tabela e FAQ.",
    "Evolua o placeholder de /precos (passos 3–5) com planos interativos, tabela e FAQ."
  ),
};

// --- Build M3 guided (20 steps) ---
const M3_TOTAL = 20;
const m3GuidedBase = m3Slides.filter((s) => s.isGuided && s.passo <= 11);
const m3Passo12 = findSlideByPasso(m3Slides, 12);

const m3NewGuided = [
  ...m3GuidedBase.map((s, i) => ({
    html: renumberSlide(s.html, i + 1, M3_TOTAL),
  })),
  {
    html: renumberSlide(
      m3Passo12.html
        .replace(
          '<span class="text-slate-500">// FeatureGrid e CtaSection entram no Módulo 4</span>',
          '<span class="text-slate-500">// FeatureGrid e CtaSection nos próximos passos</span>'
        )
        .replace(
          "Header e Footer continuam no <code class=\"font-mono text-sky-300\">layout.tsx</code> — a page só monta o conteúdo exclusivo da home.",
          "Header continua no layout — Footer entra no passo 17. A page monta só o conteúdo da home."
        ),
      12,
      M3_TOTAL
    ),
  },
  ...m4Home.map((s, i) => ({
    html: renumberSlide(
      s.html.replace("já existe desde o M3", "foi criado no passo 10"),
      13 + i,
      M3_TOTAL
    ),
  })),
  {
    html: `  <div class="slide-container">
    <div class="content-area flex w-full grow flex-col justify-center">
      <h2 class="slide-title mb-6 w-full border-l-8 border-brand-500 pl-4 text-left text-2xl font-bold uppercase tracking-wide text-white sm:text-3xl md:text-4xl">Passo 20/20 · Checkpoint <span class="text-brand-500">M3</span></h2>
      <ul class="space-y-4 text-lg text-slate-300">
        <li><i class="fa-solid fa-check text-brand-500"></i> Header client com nav desktop e menu mobile.</li>
        <li><i class="fa-solid fa-check text-brand-500"></i> Home completa: Hero, LogoStrip, FeatureGrid e CtaSection.</li>
        <li><i class="fa-solid fa-check text-brand-500"></i> Footer persistente no layout com links do curso.</li>
        <li><i class="fa-solid fa-check text-brand-500"></i> Dados em <code class="font-mono text-sky-300">features.ts</code> alimentando componentes.</li>
      </ul>
    </div>
  </div>`,
  },
];

// --- Build M4 guided (20 steps) - deploy only ---
const M4_TOTAL = 20;
const deployMap = [
  21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 34, 35, 36, 37, 38, 39, 40, 45,
];

const m4NewIntro = `  <div class="slide-container">
    <div class="flex w-full grow flex-col items-center justify-center text-center">
      <hr class="mb-6 h-2 w-36 border-0 bg-brand-500">
      <h2 class="mb-4 text-5xl font-extrabold uppercase text-brand-500 sm:text-6xl">Projeto guiado</h2>
      <p class="max-w-3xl text-xl text-slate-400">Módulo 4 focado em <strong class="text-white">deploy</strong>: do <code class="font-mono text-sky-300">next.config</code> até o site online no GitHub Pages — <strong class="text-white">20 passos</strong>.</p>
    </div>
  </div>`;

const m4NewGuided = [
  { html: m4NewIntro },
  { html: m4DeployDivider.html },
  ...deployMap.map((origPasso, i) => ({
    html: renumberSlide(findSlideByPasso(m4Slides, origPasso).html, i + 1, M4_TOTAL),
  })),
];

// Merge github repo 33 into slide 12 (index 13 in guided with intro+divider)
const slide12Idx = 13;
const slide33 = findSlideByPasso(m4Slides, 33);
if (slide33) {
  const extra = slide33.html.match(/<ul[\s\S]*?<\/ul>/);
  if (extra) {
    m4NewGuided[slide12Idx].html = m4NewGuided[slide12Idx].html.replace(
      "</ul>",
      extra[0].replace(/<ul[^>]*>/, "").replace(/<\/ul>/, "") + "</ul>"
    );
  }
}

// --- Reassemble M2 ---
const m2ProjetoIdx = m2Slides.findIndex((s) => s.html.includes("Projeto guiado"));
const m2CheckpointIdx = m2Slides.findIndex((s) => s.html.includes("Checkpoint") && s.html.includes("M2"));
const m2Before = m2Slides
  .slice(0, m2ProjetoIdx + 1)
  .map((s) => s.html)
  .join("\n\n  ");
const m2After = m2Slides
  .slice(m2CheckpointIdx)
  .map((s) => {
    if (s.html.includes("Checkpoint") && s.html.includes("M2")) {
      return s.html
        .replace(
          "Rotas <code class=\"font-mono text-sky-300\">/precos</code> e <code class=\"font-mono text-sky-300\">/contato</code> ativas (versão placeholder).",
          "Páginas <code class=\"font-mono text-sky-300\">/precos</code> e <code class=\"font-mono text-sky-300\">/contato</code> completas com dados e interatividade."
        )
        .replace("versão placeholder", "planos, FAQ e formulário");
    }
    return s.html;
  })
  .join("\n\n  ");

const m2ProjetoSlide = m2Slides[m2ProjetoIdx];
m2Before.replace; // used below
const m2NewHtml = rebuildModule(
  m2,
  m2Slides.slice(0, m2ProjetoIdx + 1).map((s) => s.html).join("\n\n  ") + "\n\n  ",
  m2NewGuided.map((s) => s.html),
  "\n\n  " + m2Slides.slice(m2CheckpointIdx).map((s) => {
    if (s.html.includes("Checkpoint") && s.html.includes("M2")) {
      return s.html
        .replace(
          "Rotas <code class=\"font-mono text-sky-300\">/precos</code> e <code class=\"font-mono text-sky-300\">/contato</code> ativas (versão placeholder).",
          "Páginas <code class=\"font-mono text-sky-300\">/precos</code> e <code class=\"font-mono text-sky-300\">/contato</code> com planos, tabela, FAQ e formulário."
        );
    }
    return s.html;
  }).join("\n\n  ")
);

// --- Reassemble M3 ---
const m3ProjetoIdx = m3Slides.findIndex((s) => s.html.includes("Projeto guiado"));
const m3NavIdx = m3Slides.findIndex((s) => s.html.includes("Navegação") && s.html.includes("entre módulos"));

const m3NewHtml = rebuildModule(
  m3,
  m3Slides.slice(0, m3ProjetoIdx + 1).map((s) => s.html).join("\n\n  ") + "\n\n  ",
  m3NewGuided.map((s) => s.html),
  "\n\n  " + m3Slides.slice(m3NavIdx).map((s) => {
    if (s.html.includes("Navegação") && s.html.includes("entre módulos")) {
      return s.html.replace(
        "No próximo, vamos ligar dados, otimização de imagem e deploy.",
        "No próximo módulo, publicamos o projeto no GitHub Pages."
      );
    }
    return s.html;
  }).join("\n\n  ")
);

// --- Reassemble M4 ---
const m4ProjetoIdx = m4Slides.findIndex((s) => s.html.includes("Projeto guiado"));
const m4NavIdx = m4Slides.findIndex((s) => s.html.includes("Navegação") && s.html.includes("entre módulos"));

const m4NewHtml = rebuildModule(
  m4,
  m4Slides.slice(0, m4ProjetoIdx).map((s) => s.html).join("\n\n  ") + (m4ProjetoIdx > 0 ? "\n\n  " : ""),
  m4NewGuided.map((s) => s.html),
  "\n\n  " + m4Slides.slice(m4NavIdx).map((s) => s.html).join("\n\n  ")
);

// --- Expand M1 to 20 steps ---
const m1Slides = extractSlideContainers(m1);
const m1ProjetoIdx = m1Slides.findIndex((s) => s.html.includes(">Projeto<") && s.html.includes("Parte 1 de 4"));
const m1CheckpointIdx = m1Slides.findIndex((s) => s.html.includes("Checklist final"));

const m1NewSlides = [
  ...m1Slides.slice(0, m1ProjetoIdx + 2).map((s) => s.html), // projeto + mapa
];

const m1Guided = m1Slides.filter((s) => s.isGuided);
const M1_TOTAL = 20;

const m1Extra = [
  {
    after: 1,
    html: `  <div class="slide-container">
    <div class="content-area flex w-full grow flex-col justify-center">
      <h2 class="slide-title mb-6 w-full border-l-8 border-brand-500 pl-4 text-left text-2xl font-bold uppercase tracking-wide text-white sm:text-3xl md:text-4xl">Passo 2/20 · Entender as <span class="text-brand-500">opções</span> do CLI</h2>
      <ul class="space-y-3 text-lg text-slate-400">
        <li><code class="font-mono text-sky-300">--ts</code> — TypeScript em todo o projeto.</li>
        <li><code class="font-mono text-sky-300">--tailwind</code> — Tailwind v4 já configurado.</li>
        <li><code class="font-mono text-sky-300">--app</code> — App Router (pasta <code class="font-mono text-sky-300">src/app</code>).</li>
        <li><code class="font-mono text-sky-300">--src-dir</code> — código dentro de <code class="font-mono text-sky-300">src/</code>.</li>
        <li><code class="font-mono text-sky-300">--eslint</code> — lint básico desde o início.</li>
      </ul>
    </div>
  </div>`,
  },
  {
    after: 2,
    html: `  <div class="slide-container">
    <div class="content-area flex w-full grow flex-col justify-center">
      <h2 class="slide-title mb-6 w-full border-l-8 border-brand-500 pl-4 text-left text-2xl font-bold uppercase tracking-wide text-white sm:text-3xl md:text-4xl">Passo 3/20 · Entrar na pasta e <span class="text-brand-500">instalar</span></h2>
      <div class="mt-3 w-full overflow-hidden rounded-xl border border-slate-700 bg-slate-900 font-mono shadow-xl">
        <div class="flex gap-2 border-b border-slate-700 bg-slate-800 px-4 py-2"><span class="ml-2 text-xs text-slate-500">terminal</span></div>
        <pre class="p-5 text-sm text-slate-300"><span class="text-brand-400">cd</span> fluxolab-app
<span class="text-brand-400">npm</span> install</pre>
      </div>
      <p class="mt-4 text-sm text-slate-500">O <code class="font-mono text-sky-300">npm install</code> baixa Next.js, React e Tailwind para a pasta <code class="font-mono text-sky-300">node_modules</code>.</p>
    </div>
  </div>`,
  },
  {
    after: 3,
    html: `  <div class="slide-container">
    <div class="content-area flex w-full grow flex-col justify-center">
      <h2 class="slide-title mb-6 w-full border-l-8 border-brand-500 pl-4 text-left text-2xl font-bold uppercase tracking-wide text-white sm:text-3xl md:text-4xl">Passo 4/20 · Estrutura <span class="text-brand-500">App Router</span></h2>
      <div class="mt-3 w-full overflow-hidden rounded-xl border border-slate-700 bg-slate-900 font-mono shadow-xl">
        <pre class="p-5 text-xs text-slate-300">fluxolab-app/
├── src/app/
│   ├── layout.tsx    <span class="text-slate-500">← envolve todas as páginas</span>
│   ├── page.tsx      <span class="text-slate-500">← rota /</span>
│   └── globals.css
├── public/
└── package.json</pre>
      </div>
      <p class="mt-4 text-lg text-slate-400">Cada pasta com <code class="font-mono text-sky-300">page.tsx</code> vira uma URL — veremos isso no Módulo 2.</p>
    </div>
  </div>`,
  },
  {
    after: 5,
    html: `  <div class="slide-container">
    <div class="content-area flex w-full grow flex-col justify-center">
      <h2 class="slide-title mb-6 w-full border-l-8 border-brand-500 pl-4 text-left text-2xl font-bold uppercase tracking-wide text-white sm:text-3xl md:text-4xl">Passo 8/20 · <span class="text-brand-500">page.tsx</span> vs layout</h2>
      <ul class="space-y-3 text-lg text-slate-400">
        <li><strong class="text-white">layout.tsx</strong> — shell fixo (fonte, metadata, elementos globais).</li>
        <li><strong class="text-white">page.tsx</strong> — conteúdo que muda por rota; na home é a landing.</li>
        <li>O layout recebe <code class="font-mono text-sky-300">{children}</code> e injeta o conteúdo da page.</li>
      </ul>
    </div>
  </div>`,
  },
  {
    after: 7,
    html: `  <div class="slide-container">
    <div class="content-area flex w-full grow flex-col justify-center">
      <h2 class="slide-title mb-6 w-full border-l-8 border-brand-500 pl-4 text-left text-2xl font-bold uppercase tracking-wide text-white sm:text-3xl md:text-4xl">Passo 11/20 · <span class="text-brand-500">Hot reload</span></h2>
      <p class="mb-3 text-lg text-slate-400">Com <code class="font-mono text-sky-300">npm run dev</code> rodando, salve qualquer arquivo — o navegador atualiza sozinho.</p>
      <ul class="mt-4 space-y-2 text-lg text-slate-400">
        <li>Teste: mude o título do hero e salve <code class="font-mono text-sky-300">page.tsx</code>.</li>
        <li>Erros de sintaxe aparecem no terminal e no overlay do navegador.</li>
      </ul>
    </div>
  </div>`,
  },
  {
    after: 9,
    html: `  <div class="slide-container">
    <div class="content-area flex w-full grow flex-col justify-center">
      <h2 class="slide-title mb-6 w-full border-l-8 border-brand-500 pl-4 text-left text-2xl font-bold uppercase tracking-wide text-white sm:text-3xl md:text-4xl">Passo 14/20 · Alias <span class="text-brand-500">@/</span></h2>
      <p class="mb-3 text-lg text-slate-400">O template já mapeia <code class="font-mono text-sky-300">@/</code> para <code class="font-mono text-sky-300">src/</code> — usaremos em imports como <code class="font-mono text-sky-300">@/components/Header</code>.</p>
      <div class="mt-3 w-full overflow-hidden rounded-xl border border-slate-700 bg-slate-900 font-mono shadow-xl">
        <pre class="p-5 text-xs text-slate-300">// tsconfig.json (trecho)
"paths": { "@/*": ["./src/*"] }</pre>
      </div>
    </div>
  </div>`,
  },
  {
    after: 10,
    html: `  <div class="slide-container">
    <div class="content-area flex w-full grow flex-col justify-center">
      <h2 class="slide-title mb-6 w-full border-l-8 border-brand-500 pl-4 text-left text-2xl font-bold uppercase tracking-wide text-white sm:text-3xl md:text-4xl">Passo 16/20 · Scripts do <span class="text-brand-500">package.json</span></h2>
      <ul class="space-y-2 text-lg text-slate-400">
        <li><code class="font-mono text-sky-300">npm run dev</code> — servidor local com hot reload.</li>
        <li><code class="font-mono text-sky-300">npm run build</code> — build de produção (usado no M4).</li>
        <li><code class="font-mono text-sky-300">npm run lint</code> — verifica problemas de código.</li>
      </ul>
    </div>
  </div>`,
  },
  {
    after: 11,
    html: `  <div class="slide-container">
    <div class="content-area flex w-full grow flex-col justify-center">
      <h2 class="slide-title mb-6 w-full border-l-8 border-brand-500 pl-4 text-left text-2xl font-bold uppercase tracking-wide text-white sm:text-3xl md:text-4xl">Passo 18/20 · Erros comuns no <span class="text-brand-500">setup</span></h2>
      <ul class="space-y-3 text-lg text-slate-400">
        <li><strong class="text-slate-300">Porta 3000 ocupada</strong> — feche outro <code class="font-mono text-sky-300">npm run dev</code> ou use outra porta.</li>
        <li><strong class="text-slate-300">Pasta errada</strong> — rode comandos dentro de <code class="font-mono text-sky-300">fluxolab-app</code>.</li>
        <li><strong class="text-slate-300">Typo em className</strong> — Tailwind não aplica classe com nome errado.</li>
      </ul>
    </div>
  </div>`,
  },
  {
    after: 12,
    html: `  <div class="slide-container">
    <div class="content-area flex w-full grow flex-col justify-center">
      <h2 class="slide-title mb-6 w-full border-l-8 border-brand-500 pl-4 text-left text-2xl font-bold uppercase tracking-wide text-white sm:text-3xl md:text-4xl">Passo 20/20 · Checkpoint <span class="text-brand-500">M1</span></h2>
      <ul class="space-y-4 text-lg text-slate-400">
        <li><i class="fa-solid fa-square-check text-brand-500"></i> Projeto Next.js criado com App Router.</li>
        <li><i class="fa-solid fa-square-check text-brand-500"></i> Tema global e cores de marca aplicados.</li>
        <li><i class="fa-solid fa-square-check text-brand-500"></i> Layout com Urbanist, metadata e Font Awesome.</li>
        <li><i class="fa-solid fa-square-check text-brand-500"></i> Home inicial renderizando com <code class="font-mono text-sky-300">npm run dev</code>.</li>
      </ul>
    </div>
  </div>`,
  },
];

// Build M1 guided with renumbering
const m1GuidedRenumbered = [];
let m1Step = 0;
const insertAfter = new Map(m1Extra.map((e) => [e.after, e.html]));

for (const slide of m1Guided) {
  m1Step++;
  m1GuidedRenumbered.push(renumberSlide(slide.html, m1Step, M1_TOTAL));
  if (insertAfter.has(m1Step)) {
    m1GuidedRenumbered.push(insertAfter.get(m1Step));
  }
}

// Split passo 6 (rodar projeto) - remove npm install from it since we have separate step
const idx6 = m1GuidedRenumbered.findIndex((h) => h.includes("rodar o projeto"));
if (idx6 !== -1) {
  m1GuidedRenumbered[idx6] = m1GuidedRenumbered[idx6].replace(
    /<span class="text-brand-400">npm<\/span> install\n/,
    ""
  ).replace("Entrar na pasta do app.\n        <li>Executar servidor local.</li>", "Executar servidor local.</li>");
}

// Renumber all M1 guided sequentially
let step = 0;
const m1FinalGuided = [];
for (const h of m1GuidedRenumbered) {
  if (h.includes("Passo ")) {
    step++;
    m1FinalGuided.push(h.replace(/Passo \d+\/\d+/g, `Passo ${step}/${M1_TOTAL}`));
  } else {
    m1FinalGuided.push(h);
  }
}

// Update mapa evolução in M1
const m1MapaIdx = m1Slides.findIndex((s) => s.html.includes("Mapa da evolução"));
const m1MapaUpdated = m1Slides[m1MapaIdx].html
  .replace("M4</strong> · dados, ajustes finais e deploy.", "M4</strong> · deploy no GitHub Pages.");

const m1NewHtml = rebuildModule(
  m1,
  [
    ...m1Slides.slice(0, m1MapaIdx).map((s) => s.html),
    m1MapaUpdated,
    ...m1Slides.slice(m1MapaIdx + 1, m1ProjetoIdx + 1).map((s) => s.html),
  ].join("\n\n  ") + "\n\n  ",
  m1FinalGuided,
  "\n\n  " + m1Slides.slice(m1CheckpointIdx + 1).map((s) => s.html).join("\n\n  ")
);

// Update M2 projeto intro
const m2Updated = m2NewHtml.replace(
  "Agora aplicamos no projeto FluxoLab, em passos curtos.",
  "Rotas, páginas de preços e contato — <strong class=\"text-white\">20 passos</strong> guiados."
);

// Update M3 projeto intro  
const m3ProjetoIntro = m3Slides[m3ProjetoIdx];
const m3Updated = m3NewHtml; // intro already ok

// Validate counts
function countPassos(html) {
  const matches = html.match(/Passo \d+\/(\d+)/g) || [];
  const totals = [...new Set(matches.map((m) => m.split("/")[1]))];
  const steps = (html.match(/Passo \d+\//g) || []).length;
  return { steps, totals };
}

fs.writeFileSync(path.join(ROOT, "modulo-2-rotas-layouts.html"), m2Updated);
fs.writeFileSync(path.join(ROOT, "modulo-3-componentes-client.html"), m3Updated);
fs.writeFileSync(path.join(ROOT, "modulo-4-dados-deploy.html"), m4NewHtml);
fs.writeFileSync(path.join(ROOT, "modulo-1-intro-setup.html"), m1NewHtml);

console.log("M1:", countPassos(m1NewHtml));
console.log("M2:", countPassos(m2Updated));
console.log("M3:", countPassos(m3Updated));
console.log("M4:", countPassos(m4NewHtml));
console.log("Done.");
