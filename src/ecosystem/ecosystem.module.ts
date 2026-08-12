// src/ecosystem/ecosystem.module.ts
import { Module } from '@nestjs/common';
import { EcosystemService }    from './ecosystem.service';
import { EcosystemController } from './ecosystem.controller';

@Module({
  controllers: [EcosystemController],
  providers:   [EcosystemService],
  exports:     [EcosystemService],
})
export class EcosystemModule {}
