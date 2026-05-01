// src/langgraph/langgraph.module.ts
import { Module } from '@nestjs/common';
import { LangGraphEngine } from './langgraph.engine';
import { GroqModule } from '../groq/groq.module';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [GroqModule, PrismaModule],
  providers: [LangGraphEngine],
  exports: [LangGraphEngine],
})
export class LangGraphModule {}