import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { GlobalExceptionFilter } from './common/filters/http-exception.filter';

let cachedApp: any;

export async function createApp() {
  if (cachedApp) return cachedApp;

  cachedApp = await NestFactory.create(AppModule);

  cachedApp.setGlobalPrefix('api/v1');

  cachedApp.use(helmet({ crossOriginResourcePolicy: false }));

  cachedApp.enableCors({
    origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
      // Allow all origins in production & development
      callback(null, true);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept'],
  });

  cachedApp.use(cookieParser());

  cachedApp.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    })
  );

  cachedApp.useGlobalFilters(new GlobalExceptionFilter());

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Al Dorra Travel ERP API')
    .setDescription('Travel ERP API Backend Services')
    .setVersion('1.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(cachedApp, swaggerConfig);
  SwaggerModule.setup('api/docs', cachedApp, document);

  await cachedApp.init();

  return cachedApp;
}

// Local Execution Guard (Only runs standalone server when not in Vercel Serverless Function)
if (require.main === module || !process.env.VERCEL) {
  createApp().then(async (app) => {
    const port = process.env.PORT || 3000;
    await app.listen(port);
    console.log(`🚀 Al Dorra Travel ERP Backend listening on port ${port}`);
  });
}
