const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const read = name => fs.readFileSync(path.join(root, name), 'utf8');
const layout = read('_layouts/portfolio.html');
const baseURI = 'https://iamshruthi.com/';
const media = html => html.replaceAll('__PORTFOLIO_MEDIA__/', baseURI + 'assets/media/');
const template = media(read('assets/case-studies/template.html'));
const router = layout.split('<script id="lives-lived-well-router">')[1].split('</script>')[0];
const buildCode = router.slice(router.indexOf('const projects='), router.indexOf('function syncTheme'));
const covers = new Map();
for (const row of layout.matchAll(/<article[^>]*data-case-page="([^"]+)"[^>]*>[\s\S]*?<\/article>/g)) {
  const src = row[0].match(/class="v160-hover-image"[^>]*src="([^"]+)"/)?.[1];
  if (src) covers.set(row[1], new URL(src, baseURI).href);
}
const document = {
  baseURI,
  querySelector(selector) {
    const slug = selector.match(/data-case-page="([^"]+)"/)?.[1];
    return covers.has(slug) ? {src: covers.get(slug)} : null;
  }
};
const {projects, projectDocument} = vm.runInNewContext(
  buildCode + '\n({projects, projectDocument})', {URL, document, caseUrl: slug => new URL(slug + '/', baseURI)}
);
const frameDirectory = path.join(root, '_includes', 'case-frames');
fs.mkdirSync(frameDirectory, {recursive: true});

function harmonyDocument(project, content, title) {
  const portfolio = read('assets/case-studies/harmony-wrapper.html');
  const slugs = Object.keys(projects).filter(slug => slug !== 'nomad-nook');
  const index = slugs.indexOf('harmony-sync');
  const linkedCase = (slug, label) => slug
    ? `<a href="${new URL(slug + '/', baseURI)}" class="next-case-study" target="_top" data-portfolio-case="${slug}"><small>${label}</small>${projects[slug].title}</a>`
    : '';
  const sharedScript = id => {
    const start = template.indexOf('<script id="' + id + '">');
    if (start === -1) throw new Error('Missing case study behavior: ' + id);
    return template.slice(start, template.indexOf('</script>', start) + '</script>'.length);
  };
  const labels = content.labels.map((label, i) =>
    `<span class="section-marquee-item"><i>0${i + 1}</i> ${label} <span>⟶</span></span>`).join('');
  const fields = {
    MOTION: ['case-home-return-priority', 'forward-portfolio-pointer', 'portfolio-case-pagination', 'health-parent-scroll-motion'].map(sharedScript).join('\n'),
    MARQUEE: labels,
    TITLE: title,
    HERO: `<h1><span>${project.number}</span>${project.title}</h1>
      <ul class="discipline-tags">${project.tags.map(tag => `<li>${tag}</li>`).join('')}</ul>
      ${content.subtitle}`,
    COVER: content.hero,
    ABOUT: content.about,
    BODY: content.body,
    PAGINATION: linkedCase(slugs[index - 1], 'Previous case study')
      + '<a class="large-button" href="' + baseURI + '" target="_top">take me home</a>'
      + linkedCase(slugs[(index + 1) % slugs.length], 'Next case study'),
  };
  return portfolio.replace(/%%([A-Z]+)%%/g, (_match, field) => fields[field]);
}

for (const [slug, project] of Object.entries(projects)) {
  const custom = slug === 'lives-lived-well' || slug === 'nutripaw' || slug === 'harmony-sync';
  const content = custom ? JSON.parse(media(read('assets/case-studies/' + slug + '.json'))) : null;
  const title = project.title + ' — Shruthi Gurunathan';
  const html = slug === 'harmony-sync'
    ? harmonyDocument(project, content, title)
    : projectDocument(project, template, content)
      .replace(/<title>[\s\S]*?<\/title>/i, '<title>' + title + '</title>');
  const srcdoc = html.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
  fs.writeFileSync(path.join(frameDirectory, slug + '.html'), srcdoc.replace(/[ \t]+$/gm, ''));
  const start = html.indexOf('<section class="case-study-hero">');
  const end = html.indexOf('<div class="case_study_pagination">', start);
  if (start < 0 || end < 0) throw new Error('Incomplete case study: ' + slug);

  // Publish a readable text version in the initial document. The portfolio
  // enhances it with the original case layout and interactive media.
  const article = html.slice(start, end).replace(/<(script|style|svg)\b[^>]*>[\s\S]*?<\/\1>/gi, '');
  const text = [...article.matchAll(/<(h[1-4]|p|figcaption)\b[^>]*>([\s\S]*?)<\/\1>/gi)]
    .map(([, tag, inner]) => {
      const copy = inner.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
      if (!copy) return '';
      const element = tag === 'figcaption' ? 'p' : tag;
      return `<${element}>${copy}</${element}>`;
    }).filter(Boolean);
  if (text.length < 3) throw new Error('Missing case study text: ' + slug);
  const frontMatter = `---\nlayout: portfolio\ncase_study: true\ncase_slug: ${slug}\ntitle: ${project.title} — Shruthi Gurunathan\n---\n`;
  fs.writeFileSync(path.join(root, slug, 'index.html'), frontMatter + text.join('\n') + '\n');
}
