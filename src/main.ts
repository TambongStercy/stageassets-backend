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
      crossOriginEmbedderPolicy: false, // Allow embedding content from different origins
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          scriptSrc: ["'self'"],
          imgSrc: ["'self'", 'data:', 'blob:'],
          connectSrc: ["'self'"],
          fontSrc: ["'self'"],
          objectSrc: ["'none'"],
          mediaSrc: ["'self'"],
          frameSrc: ["'self'"],
        },
      },
    }),
  );

  // Serve static files from uploads directory with CORS headers
  app.useStaticAssets(join(__dirname, '..', '..', 'uploads'), {
    prefix: '/uploads/', // Access via http://localhost:3000/uploads/...
    setHeaders: (res, path) => {
      // Add CORS headers for all static files
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

      // Remove restrictive CSP headers for PDFs to allow iframe embedding
      if (path.endsWith('.pdf')) {
        res.setHeader('Content-Security-Policy', "frame-ancestors *");
        res.setHeader('X-Frame-Options', 'ALLOWALL');
      }

      // Set proper content type for text files
      if (path.endsWith('.txt')) {
        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      }
    },
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