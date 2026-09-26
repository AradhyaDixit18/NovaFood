import { v2 as cloudinary, type UploadApiResponse } from 'cloudinary';

export interface UploadedImage {
  url: string;
  publicId: string;
  width: number;
  height: number;
}

export interface StorageProvider {
  uploadImage(buffer: Buffer, options: { folder: string }): Promise<UploadedImage>;
}

export class CloudinaryStorage implements StorageProvider {
  constructor(config: { cloudName: string; apiKey: string; apiSecret: string }) {
    cloudinary.config({
      cloud_name: config.cloudName,
      api_key: config.apiKey,
      api_secret: config.apiSecret,
      secure: true,
    });
  }

  uploadImage(buffer: Buffer, options: { folder: string }): Promise<UploadedImage> {
    return new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          folder: `novafood/${options.folder}`,
          resource_type: 'image',
          // Normalise huge uploads on ingest; delivery URLs add format/quality negotiation.
          transformation: [{ width: 1600, height: 1600, crop: 'limit' }],
        },
        (error, result?: UploadApiResponse) => {
          if (error || !result) return reject(error ?? new Error('Upload failed'));
          resolve({ url: result.secure_url, publicId: result.public_id, width: result.width, height: result.height });
        },
      );
      stream.end(buffer);
    });
  }
}
