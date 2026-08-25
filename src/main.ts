import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import * as cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { GlobalExceptionFilter } from './common/filters/http-exception.filter';

let app;

export async function createApp() {
  if (app) return app;

  app = await NestFactory.create(AppModule);

  app.setGlobalPrefix('api/v1');

  app.use(helmet({ crossOriginResourcePolicy: false }));

  app.enableCors({
    origin: [
      'http://localhost:5173',
      'http://127.0.0.1:5173',
      'https://el-dorra-sys.vercel.app'
    ],
    credentials: true,
  });

  app.use(cookieParser());

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    })
  );

  app.useGlobalFilters(new GlobalExceptionFilter());


  const swaggerConfig = new DocumentBuilder()
    .setTitle('Al Dorra Travel ERP API')
    .setDescription('Travel ERP API')
    .setVersion('1.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document);


  await app.init();

  return app;
}


// للتشغيل المحلي فقط
if (require.main === module) {
  createApp().then(async app => {
    await app.listen(3000);
    console.log('Server running on 3000');
  });
}