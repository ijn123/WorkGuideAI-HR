import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
    const app = await NestFactory.create(AppModule);

    app.enableShutdownHooks();

    await app.listen(3000);

    console.log('Сервер запущен: http://localhost:3000');
}

bootstrap().catch((error) => {
    console.error('Ошибка запуска сервера:', error);
    process.exit(1);
});
