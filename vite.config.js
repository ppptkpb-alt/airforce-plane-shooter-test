import { defineConfig } from 'vite';

// ฝัง JS ที่ build แล้วลงใน index.html → dist/ เหลือไฟล์เดียว เปิดผ่าน file:// ได้ (ดับเบิลคลิก / play.bat)
// เบราว์เซอร์บล็อก module script แยกไฟล์บน file:// แต่ inline module script ใช้ได้
function inlineSingleFile() {
  return {
    name: 'inline-single-file',
    enforce: 'post',
    generateBundle(_, bundle) {
      const html = Object.values(bundle).find((f) => f.type === 'asset' && f.fileName.endsWith('.html'));
      if (!html) return;
      let source = String(html.source);
      for (const chunk of Object.values(bundle)) {
        if (chunk.type !== 'chunk') continue;
        const tag = new RegExp(`<script type="module"[^>]*src="[^"]*${chunk.fileName}"[^>]*></script>`);
        const code = chunk.code.replace(/<\/script/gi, '<\\/script');
        source = source.replace(tag, () => `<script type="module">\n${code}</script>`);
        delete bundle[chunk.fileName];
      }
      html.source = source;
    },
  };
}

export default defineConfig({
  base: './',
  build: {
    modulePreload: false,
  },
  plugins: [inlineSingleFile()],
});
