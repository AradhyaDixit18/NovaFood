/** Adds Cloudinary delivery optimisations (format, quality, width) to an uploaded image URL. */
export function optimizedImage(url: string | null | undefined, width: number): string | undefined {
  if (!url) return undefined;
  if (!url.includes('res.cloudinary.com') || !url.includes('/upload/')) return url;
  return url.replace('/upload/', `/upload/f_auto,q_auto,c_fill,w_${width}/`);
}
