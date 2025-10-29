import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
import helmet from 'helmet';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // Security
  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: 'cross-origin' }, // Allow images to be loaded from different origins
    }),
  );

  // Serve static files from uploads directory
  app.useStaticAssets(join(__dirname, '..', '..', 'uploads'), {
    prefix: '/uploads/', // Access via http://localhost:3000/uploads/...
  });

  // CORS (adjust for production)
  app.enableCors({
    origin: (origin, callback) => {
      // Allow any localhost port in development
      const isDevelopment = process.env.NODE_ENV === 'development';
      if (isDevelopment && origin?.includes('localhost')) {
        callback(null, true);
      } else if (isDevelopment && !origin) {
        // Allow requests with no origin (mobile apps, curl, etc)
        callback(null, true);
      } else if (origin === process.env.FRONTEND_URL) {
        // Allow specific frontend URL in production
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
  });

  // Global prefix
  app.setGlobalPrefix('api');

  // Validation
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const port = process.env.PORT || 3000;
  await app.listen(port);
  console.log(`🚀 Server running on http://localhost:${port}/api`);
}
bootstrap();