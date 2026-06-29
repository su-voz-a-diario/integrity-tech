import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

@Global() // Hace que PrismaService esté disponible de manera global sin necesidad de importar DatabaseModule en cada sub-módulo.
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class DatabaseModule {}
