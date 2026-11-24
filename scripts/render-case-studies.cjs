const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const read = name => fs.readFileSync(path.join(root, name), 'utf8');
const layout = read('_layouts/portfolio.html');
const baseURI = 'https://iamshruthi.com/';
const media = html => html.replaceAll('__PORTFOLIO_MEDIA__/', '/assets/media/');
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
for (const [slug, project] of Object.entries(projects)) {
  const custom = slug === 'lives-lived-well' || slug === 'nutripaw';
  const content = custom ? JSON.parse(media(read('assets/case-studies/' + slug + '.json'))) : null;
  const html = projectDocument(project, template, content);
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
  const frontMatter = `---\nlayout: portfolio\ncase_study: true\ntitle: ${project.title} — Shruthi Gurunathan\n---\n`;
  fs.writeFileSync(path.join(root, slug, 'index.html'), frontMatter + text.join('\n') + '\n');
}
