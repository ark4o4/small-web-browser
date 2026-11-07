import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function main() {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('api');
  app.useBodyParser('json', { limit: '256kb' });
  await app.listen(process.env.PORT ?? 4000);
  console.log('api on', process.env.PORT ?? 4000);
}
main();
