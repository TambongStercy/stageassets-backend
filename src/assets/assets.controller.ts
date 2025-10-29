import {
  Controller,
  Post,
  UploadedFile,
  UseInterceptors,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { AssetsService } from './assets.service';

@Controller('assets')
export class AssetsController {
  constructor(private readonly assetsService: AssetsService) {}

  @Post('upload')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: {
        fileSize: parseInt(process.env.MAX_FILE_SIZE || '10485760'), // 10MB default
      },
    }),
  )
  async uploadFile(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }

    const { filePath, fileUrl } = await this.assetsService.saveFile(
      file,
      'submissions',
    );

    // Validate if it's an image
    let dimensions: { width?: number; height?: number } = {};
    if (file.mimetype.startsWith('image/')) {
      dimensions = await this.assetsService.validateImage(file);
    }

    return {
      fileName: file.originalname,
      fileUrl,
      filePath,
      fileSize: file.size,
      mimeType: file.mimetype,
      ...dimensions,
    };
  }
}
