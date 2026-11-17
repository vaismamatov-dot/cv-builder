// Next.js handles Link routes; public files and workers need the repository prefix.
export const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '';
export function publicPath(path: string) { return `${basePath}${path.startsWith('/') ? path : `/${path}`}`; }
