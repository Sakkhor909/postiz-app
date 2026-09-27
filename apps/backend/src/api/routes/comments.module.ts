import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { CommentsController } from './comments.controller';
import { CommentsService } from './comments.service';
import { AuthMiddleware } from '@gitroom/backend/services/auth/auth.middleware';
import { ApiModule } from '@gitroom/backend/api/api.module';

@Module({
  imports: [ApiModule],
  controllers: [CommentsController],
  providers: [CommentsService],
  exports: [CommentsService],
})
export class CommentsModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(AuthMiddleware).forRoutes(CommentsController);
  }
}
