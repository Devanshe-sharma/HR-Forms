/// <reference types="react" />
/// <reference types="react-dom" />

declare module 'react/jsx-runtime' {
  export * from 'react';
}

declare module '*.css';
declare module '*.scss';
declare module '*.sass';

interface ImportMetaEnv {
  readonly VITE_API_URL: string
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