import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { ExpressAdapter } from '@nestjs/platform-express';
import * as express from 'express';

// Instance Express partagée pour le mode Serverless Vercel
const server = express();

export const createServer = async (expressInstance) => {
  const app = await NestFactory.create(
    AppModule,
    new ExpressAdapter(expressInstance),
  );

  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';

  // Configuration Sécurité
  app.use(helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
  }));

  // Rate Limiting
  app.use(
    rateLimit({
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 100,
      message: { error: 'Trop de requêtes, veuillez réessayer plus tard.' },
      standardHeaders: true,
      legacyHeaders: false,
    }),
  );

  // Configuration CORS
  app.enableCors({
    origin: frontendUrl,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-api-key'],
  });

  // Validation globale des DTOs
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    transform: true,
    forbidNonWhitelisted: true,
  }));

  await app.init();
};

// Mode Standard persistant (Local / Render)
if (!process.env.VERCEL) {
  const port = process.env.PORT || 3000;
  NestFactory.create(AppModule).then(async (app) => {
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    
    app.use(helmet({
      contentSecurityPolicy: false,
      crossOriginEmbedderPolicy: false,
    }));

    app.use(
      rateLimit({
        windowMs: 15 * 60 * 1000,
        max: 100,
        message: { error: 'Trop de requêtes, veuillez réessayer plus tard.' },
        standardHeaders: true,
        legacyHeaders: false,
      }),
    );

    app.enableCors({
      origin: frontendUrl,
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'x-api-key'],
    });

    app.useGlobalPipes(new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }));

    await app.listen(port);
    console.log(`======================================`);
    console.log(` SERVER RUNNING PERSISTENT ON PORT ${port}`);
    console.log(`======================================`);
  });
}

// Initialisation du handler Vercel
createServer(server);
export default server;
