const basePath = process.env.PAGES_BASE_PATH || "";

export default function imageLoader({ src }: { src: string }) {
  return `${basePath}${src}`;
}
