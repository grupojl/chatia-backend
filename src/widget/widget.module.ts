// src/widget/widget.module.ts
import { Module } from '@nestjs/common';
import { WidgetController } from './widget.controller';
import { AssistantModule } from '../assistant/assistant.module';

@Module({
  imports: [AssistantModule],
  controllers: [WidgetController],
})
export class WidgetModule {}
