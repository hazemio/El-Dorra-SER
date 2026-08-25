import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder, SwaggerCustomOptions } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { GlobalExceptionFilter } from './common/filters/http-exception.filter';

let cachedApp: any;

export async function createApp() {
  if (cachedApp) return cachedApp;

  cachedApp = await NestFactory.create(AppModule);

  cachedApp.setGlobalPrefix('api/v1');

  // تعطيل CSP لضمان تحميل واجهة Swagger بسلاسة
  cachedApp.use(
    helmet({
      crossOriginResourcePolicy: false,
      contentSecurityPolicy: false,
    })
  );

  // إعداد قائمة الـ Origins المسموح بها مع دعم متغير البيئة FRONTEND_URL
  const allowedOrigins = [
    process.env.FRONTEND_URL,
    'https://el-dorra-sys.vercel.app',
    'http://localhost:5173',
    'http://localhost:3000',
  ].filter(Boolean) as string[];

  cachedApp.enableCors({
    origin: (origin: string, callback: (err: Error | null, allow?: boolean) => void) => {
      // السماح بالطلبات التي لا تحتوي على Origin (مثل Postman أو Mobile Apps) أو الموجودة بالقائمة
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(null, true); // Fallback لتجنب حظر الـ Preflight أثناء الـ testing
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Requested-With',
      'Accept',
      'X-CSRF-Token',
      'Accept-Version',
      'Content-Length',
      'Content-MD5',
      'Date',
      'X-Api-Version',
    ],
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

  // تحميل ملفات Swagger UI عبر CDN لتجنب أخطاء 404 على Serverless
  const customOptions: SwaggerCustomOptions = {
    customCssUrl:
      'https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/5.11.0/swagger-ui.min.css',
    customJs: [
      'https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/5.11.0/swagger-ui-bundle.js',
      'https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/5.11.0/swagger-ui-standalone-preset.js',
    ],
  };

  SwaggerModule.setup('api/v1/docs', cachedApp, document, customOptions);

  await cachedApp.init();

  return cachedApp;
}

// Local Execution Guard
if (require.main === module || !process.env.VERCEL) {
  createApp().then(async (app) => {
    const port = process.env.PORT || 3000;
    await app.listen(port);
    console.log(`🚀 Al Dorra Travel ERP Backend listening on port ${port}`);
  });
}
