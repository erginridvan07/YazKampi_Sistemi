/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

declare module 'pdfmake/build/pdfmake' {
  const pdfMake: {
    addVirtualFileSystem: (vfs: Record<string, string>) => void
    createPdf: (doc: object) => { download: (filename: string) => void }
  }
  export default pdfMake
}

declare module 'pdfmake/build/vfs_fonts' {
  const vfs: Record<string, string>
  export default vfs
}

interface ImportMetaEnv {
  readonly VITE_FIREBASE_API_KEY: string
  readonly VITE_FIREBASE_AUTH_DOMAIN: string
  readonly VITE_FIREBASE_PROJECT_ID: string
  readonly VITE_FIREBASE_STORAGE_BUCKET: string
  readonly VITE_FIREBASE_MESSAGING_SENDER_ID: string
  readonly VITE_FIREBASE_APP_ID: string
  readonly VITE_FIREBASE_VAPID_KEY?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
