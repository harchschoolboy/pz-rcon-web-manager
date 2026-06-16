/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

// Injected at build time via vite.config.ts `define`
declare const __BUILD_TIME__: string
