import {
  Body,
  Controller,
  Get,
  HttpException,
  HttpStatus,
  Post,
  Query,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CommentsService } from './comments.service';

@ApiTags('Comments')
@Controller('/comments')
export class CommentsController {
  constructor(private _commentsService: CommentsService) {}

  @Get('/')
  async getComments(@Query('platform') platform: string = 'fb') {
    return this._commentsService.getComments(platform);
  }

  @Get('/history')
  async getHistory(
    @Query('platform') platform: string = 'fb',
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string
  ) {
    return this._commentsService.getHistory(platform, page, pageSize);
  }

  @Post('/reply')
  async reply(
    @Body() body: { platform: string; id: string; text: string }
  ) {
    const result = await this._commentsService.reply(
      body?.platform,
      body?.id,
      body?.text
    );
    if (result && result.ok === false) {
      throw new HttpException(result, HttpStatus.INTERNAL_SERVER_ERROR);
    }
    return result;
  }

  @Post('/hide')
  async hide(
    @Body() body: { platform: string; id: string; reason?: string }
  ) {
    const result = await this._commentsService.hide(
      body?.platform,
      body?.id,
      body?.reason
    );
    if (result && result.ok === false) {
      throw new HttpException(result, HttpStatus.INTERNAL_SERVER_ERROR);
    }
    return result;
  }

  @Post('/skip')
  async skip(
    @Body() body: { platform: string; id: string; reason?: string }
  ) {
    const result = await this._commentsService.skip(
      body?.platform,
      body?.id,
      body?.reason
    );
    if (result && result.ok === false) {
      throw new HttpException(result, HttpStatus.INTERNAL_SERVER_ERROR);
    }
    return result;
  }
}
