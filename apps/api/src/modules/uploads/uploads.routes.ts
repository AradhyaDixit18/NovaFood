import { Router } from 'express';
import multer from 'multer';
import { z } from 'zod';
import type { AppContext } from '../../context';
import { badRequest, forbidden, serviceUnavailable } from '../../lib/errors';
import { parse, send } from '../../lib/http';
import { authenticate, currentUser } from '../../middleware/auth';

const MAX_BYTES = 3 * 1024 * 1024;
const ALLOWED = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/avif']);

/** Magic-number check so a renamed executable cannot pass as an image. */
function looksLikeImage(buf: Buffer): boolean {
  const hex = buf.subarray(0, 12).toString('hex');
  return (
    hex.startsWith('ffd8ff') || // JPEG
    hex.startsWith('89504e47') || // PNG
    (hex.startsWith('52494646') && buf.subarray(8, 12).toString() === 'WEBP') ||
    buf.subarray(4, 12).toString().startsWith('ftypavi') // AVIF
  );
}

const purposeSchema = z.object({ purpose: z.enum(['avatar', 'restaurant', 'food', 'review']) });

export function createUploadsRouter(ctx: AppContext): Router {
  const router = Router();
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: MAX_BYTES, files: 1 },
    fileFilter: (_req, file, cb) => cb(null, ALLOWED.has(file.mimetype)),
  });

  router.post('/image', authenticate(ctx, { required: true }), upload.single('image'), async (req, res) => {
    if (!ctx.storage) throw serviceUnavailable('Image uploads are not configured on this server.', 'UPLOADS_DISABLED');
    const { purpose } = parse(purposeSchema, req.query);
    const user = currentUser(req);
    if ((purpose === 'restaurant' || purpose === 'food') && user.role === 'customer') throw forbidden();
    if (!req.file) throw badRequest('Attach a JPG, PNG, WebP or AVIF image in the "image" field.');
    if (!looksLikeImage(req.file.buffer)) throw badRequest('That file is not a valid image.');

    const image = await ctx.storage.uploadImage(req.file.buffer, { folder: `${purpose}/${user.id}` });
    send(res, image, 201);
  });

  return router;
}
