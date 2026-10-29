import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// 개발 서버(npm run dev)에서도 /api/* 가 동작하도록 Vercel 함수를 그대로 연결합니다.
function localApi(env) {
  const routes = { '/api/toilets': './api/toilets.js', '/api/nearby': './api/nearby.js' };
  return {
    name: 'local-api',
    configureServer(server) {
      for (const [route, file] of Object.entries(routes)) {
        server.middlewares.use(route, async (req, res) => {
          process.env.TOILET_API_KEY = env.TOILET_API_KEY || '';
          process.env.KAKAO_REST_API_KEY = env.KAKAO_REST_API_KEY || '';
          const { default: handler } = await import(/* @vite-ignore */ `${file}?t=${Date.now()}`);
          req.query = Object.fromEntries(new URL(req.url, 'http://localhost').searchParams);
          res.status = (code) => {
            res.statusCode = code;
            return res;
          };
          res.json = (body) => {
            res.setHeader('Content-Type', 'application/json; charset=utf-8');
            res.end(JSON.stringify(body));
          };
          await handler(req, res);
        });
      }
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return { plugins: [react(), localApi(env)] };
});
