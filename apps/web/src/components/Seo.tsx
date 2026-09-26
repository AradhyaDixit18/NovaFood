import { SITE_URL } from '../lib/env';

/**
 * React 19 hoists <title>, <meta> and <link> rendered anywhere into <head>, so pages declare
 * their own metadata and structured data without a helmet library.
 */
export function Seo({ title, description, path, image, jsonLd, noindex }: { title: string; description?: string; path?: string; image?: string; jsonLd?: object; noindex?: boolean }) {
  const full = title.includes('NovaFood') ? title : `${title} · NovaFood`;
  const url = path ? `${SITE_URL}${path}` : undefined;
  return (
    <>
      <title>{full}</title>
      {description ? <meta name="description" content={description} /> : null}
      <meta property="og:title" content={full} />
      {description ? <meta property="og:description" content={description} /> : null}
      {url ? <meta property="og:url" content={url} /> : null}
      {url ? <link rel="canonical" href={url} /> : null}
      {image ? <meta property="og:image" content={image} /> : null}
      {noindex ? <meta name="robots" content="noindex" /> : null}
      {jsonLd ? <script type="application/ld+json">{JSON.stringify(jsonLd)}</script> : null}
    </>
  );
}
