import { Injectable, BadRequestException } from '@nestjs/common';
import { promises as fs } from 'fs';
import * as path from 'path';
import sharp from 'sharp';

@Injectable()
export class AssetsService {
  private readonly uploadPath =
    process.env.UPLOAD_PATH || './uploads';

  async saveFile(
    file: Express.Multer.File,
    folder: string,
  ): Promise<{ filePath: string; fileUrl: string }> {
    // Ensure upload directory exists
    const uploadDir = path.join(this.uploadPath, folder);
    await fs.mkdir(uploadDir, { recursive: true });

    // Generate unique filename
    const timestamp = Date.now();
    const ext = path.extname(file.originalname);
    const fileName = `${timestamp}-${Math.random().toString(36).substring(7)}${ext}`;
    const filePath = path.join(uploadDir, fileName);

    // Save file
    await fs.writeFile(filePath, file.buffer);

    // Return paths
    return {
      filePath,
      fileUrl: `/uploads/${folder}/${fileName}`,
    };
  }

  async validateImage(
    file: Express.Multer.File,
    minWidth?: number,
    minHeight?: number,
  ): Promise<{ width: number; height: number }> {
    try {
      const metadata = await sharp(file.buffer).metadata();

      if (minWidth && metadata.width && metadata.width < minWidth) {
        throw new BadRequestException(
          `Image width must be at least ${minWidth}px`,
        );
      }

      if (minHeight && metadata.height && metadata.height < minHeight) {
        throw new BadRequestException(
          `Image height must be at least ${minHeight}px`,
        );
      }

      return {
        width: metadata.width || 0,
        height: metadata.height || 0,
      };
    } catch (error) {
      throw new BadRequestException('Invalid image file');
    }
  }

  async deleteFile(filePath: string): Promise<void> {
    try {
      await fs.unlink(filePath);
    } catch (error) {
      // File doesn't exist or already deleted
      console.error('Error deleting file:', error);
    }
  }

  validateFileType(file: Express.Multer.File, allowedTypes: string[]): boolean {
    return allowedTypes.includes(file.mimetype);
  }

  validateFileSize(file: Express.Multer.File, maxSizeBytes: number): boolean {
    return file.size <= maxSizeBytes;
  }
}
