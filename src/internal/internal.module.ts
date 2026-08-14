// src/internal/internal.module.ts
import { Module }             from '@nestjs/common';
import { InternalController } from './internal.controller';
import { AssistantModule }    from '../assistant/assistant.module';
import { ProjectsModule }     from '../projects/projects.module';

@Module({
  imports: [
    AssistantModule,
    ProjectsModule,
  ],
  controllers: [InternalController],
})
export class InternalModule {}
