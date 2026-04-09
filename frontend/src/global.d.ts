/// <reference types="react" />
/// <reference types="react-dom" />

declare module 'react/jsx-runtime' {
  export * from 'react';
}

interface ImportMetaEnv {
  readonly VITE_API_URL: string
  // Add other environment variables here as needed
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

declare global {
  namespace JSX {
    interface IntrinsicElements {
      [elemName: string]: any;
    }
  }
}
