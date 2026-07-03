import { Controller, Get, Header, Param, ParseUUIDPipe, Res, UseGuards } from '@nestjs/common';
import { Response } from 'express';
import { JwtAuthGuard } from '../../shared/guards/jwt-auth.guard';
import { CurrentUser, SessionUser } from '../iam';
import { StorageService } from './storage.service';

@Controller('files')
@UseGuards(JwtAuthGuard)
export class FilesController {
  constructor(private readonly storage: StorageService) {}

  @Get(':fileId')
  async streamFile(
    @CurrentUser() user: SessionUser,
    @Param('fileId', ParseUUIDPipe) fileId: string,
    @Res() res: Response,
  ) {
    const { file, stream } = await this.storage.getAuthorizedStream(user, fileId);
    res.setHeader('Content-Type', file.mimeType);
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Disposition', `attachment; filename="${file.id}"`);
    return stream.pipe(res);
  }

  @Get(':fileId/download-url')
  @Header('Cache-Control', 'no-store')
  getDownloadUrl(@CurrentUser() user: SessionUser, @Param('fileId', ParseUUIDPipe) fileId: string) {
    return this.storage.getAuthorizedDownloadUrl(user, fileId);
  }
}
