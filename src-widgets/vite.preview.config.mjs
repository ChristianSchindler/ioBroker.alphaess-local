// Standalone preview of the widget (no vis-2 needed): npx vite --config vite.preview.config.mjs
import react from '@vitejs/plugin-react';
export default { root: 'preview', plugins: [react()], server: { port: 4174 }, build: { target: 'esnext' } };
