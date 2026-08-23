import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { PrismaService } from './prisma/prisma.service';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

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

  // Configuration Swagger pour la documentation de l'API
  const config = new DocumentBuilder()
    .setTitle('SteAir Pro Weather Station API')
    .setDescription('Documentation interactive de l\'API de télémétrie de la station météo SteAir Pro')
    .setVersion('1.0')
    .addApiKey({ type: 'apiKey', name: 'x-api-key', in: 'header' }, 'x-api-key')
    .addBearerAuth()
    .build();
  
  const document = SwaggerModule.createDocument(app, config);

  // Options personnalisées pour assurer le chargement des fichiers statiques Swagger sur Vercel via CDN
  const swaggerOptions = {
    customCssUrl: 'https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/4.15.5/swagger-ui.min.css',
    customJs: [
      'https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/4.15.5/swagger-ui-bundle.js',
      'https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/4.15.5/swagger-ui-standalone-preset.js',
    ],
  };

  SwaggerModule.setup('api/docs', app, document, swaggerOptions);

  // Route de santé (Health Check) à la racine (/)
  const expressApp = app.getHttpAdapter().getInstance();
  const prisma = app.get(PrismaService);

  expressApp.get('/', async (req: any, res: any) => {
    let dbStatus = 'ok';
    try {
      // Exécuter une requête simple pour s'assurer que la base répond
      await prisma.$queryRaw`SELECT 1`;
    } catch (err) {
      dbStatus = 'down';
    }

    res.status(dbStatus === 'ok' ? 200 : 500).json({
      status: dbStatus === 'ok' ? 'healthy' : 'unhealthy',
      service: 'steair-backend-api',
      timestamp: new Date().toISOString(),
      database: dbStatus,
      documentation: '/api/docs'
    });
  });

  const port = process.env.PORT || 3000;
  await app.listen(port);
  
  console.log(`======================================`);
  console.log(` SERVER RUNNING ON PORT ${port}`);
  console.log(` API Docs available at http://localhost:${port}/api/docs`);
  console.log(`======================================`);
}

bootstrap();
