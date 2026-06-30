import { defineConfig } from '@apps-in-toss/web-framework/config';

export default defineConfig({
  appName: 'mirullae',
  brand: {
    displayName: '미룰래',
    primaryColor: '#9FC530',
    icon: '/assets/brand/logo.png',
  },
  web: {
    host: '0.0.0.0',
    port: 5173,
    commands: {
      dev: 'vite --host 0.0.0.0',
      build: 'vite build',
    },
  },
  permissions: [],
  outdir: 'dist',
});
