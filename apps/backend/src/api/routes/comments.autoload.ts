import { NestFactory } from '@nestjs/core';
import { CommentsModule } from './comments.module';

const originalCreate = NestFactory.create.bind(NestFactory);

// @ts-ignore
NestFactory.create = async function (moduleCls: any, ...args: any[]) {
  try {
    const existingImports = Reflect.getMetadata('imports', moduleCls) || [];
    if (!existingImports.includes(CommentsModule)) {
      Reflect.defineMetadata(
        'imports',
        [...existingImports, CommentsModule],
        moduleCls
      );
      console.log(
        '[CommentsAutoload] Successfully registered CommentsModule into root module imports'
      );
    }
  } catch (err: any) {
    console.error(
      '[CommentsAutoload] Failed to hook CommentsModule into root module:',
      err?.message || err
    );
  }
  return originalCreate(moduleCls, ...args);
};

console.log('[CommentsAutoload] Comments inbox pre-loader ready');
