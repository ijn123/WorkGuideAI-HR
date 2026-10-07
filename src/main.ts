import 'reflect-metadata';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
    const app = await NestFactory.create(AppModule);

    app.useGlobalPipes(
        new ValidationPipe({
            transform: true,
            whitelist: true,
            forbidNonWhitelisted: true,
        }),
    );

    app.enableShutdownHooks();

    await app.listen(3000);

    console.log('Сервер запущен: http://localhost:3000');
}

bootstrap().catch((error) => {
    console.error('Ошибка запуска сервера:', error);
    process.exit(1);
});
