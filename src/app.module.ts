// src/app.module.ts
import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule } from '@nestjs/throttler';
import { FirebaseModule } from './firebase/firebase.module';
import { ConfigModule } from '@nestjs/config';

import { AppController } from './app.controller';
import { AppService } from './app.service';

// Infraestructura
import { AgentsModule } from './agents/agents.module';
import { PrismaModule } from './prisma/prisma.module';
import { QueueModule } from './queue/queue.module';
import { EventsModule } from './events/events.module';

// Config tipada + validación
import {
  appConfig, dbConfig, groqConfig,
  redisConfig, metaConfig, firebaseConfig,
} from './config/app.config';
import { validationSchema } from './config/validation.schema';

// Módulos existentes
import { ChannelsModule } from './channels/channel.module';
import { GroqModule } from './groq/groq.module';
import { LangGraphModule } from './langgraph/langgraph.module';
import { ConversationsModule } from './conversations/conversations.module';
import { WebhooksModule } from './webhooks/webhooks.module';
import { MessagesModule } from './messages/messages.module';
import { ContactsModule } from './contacts/contacts.module';
import { AiConfigModule } from './ai-config/ai-config.module';
import { ChannelAccountsModule } from './channel-accounts/channel-accounts.module';
import { NotificationsModule } from './notifications/notifications.module';
import { AnalyticsModule } from './analytics/analytics.module';

// Sprint 1+
import { ProjectsModule } from './projects/projects.module';
import { CommonModule } from './common/common.module';
import { OrganizationsModule } from './organizations/organizations.module';
import { HealthModule } from './health/health.module';
import { AssistantModule } from './assistant/assistant.module';
import { WidgetModule } from './widget/widget.module';
import { FaqModule } from './faq/faq.module';

// Guards
import { TenantThrottlerGuard } from './common/guards/tenant-throttler.guard';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [appConfig, dbConfig, groqConfig, redisConfig, metaConfig, firebaseConfig],
      validationSchema,
      validationOptions: { abortEarly: false },
    }),
    ThrottlerModule.forRoot([
      { name: 'default', ttl: 60_000, limit: 60 },
      { name: 'burst',   ttl: 5_000,  limit: 20 },
    ]),
    PrismaModule,
    FirebaseModule,
    AgentsModule,
    QueueModule,
    EventsModule,
    ChannelsModule,
    GroqModule,
    LangGraphModule,
    ConversationsModule,
    WebhooksModule,
    MessagesModule,
    ContactsModule,
    AiConfigModule,
    ChannelAccountsModule,
    NotificationsModule,
    AnalyticsModule,
    CommonModule,
    OrganizationsModule,
    HealthModule,
    ProjectsModule,
    AssistantModule,
    FaqModule,
    WidgetModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    { provide: APP_GUARD, useClass: TenantThrottlerGuard },
  ],
})
export class AppModule {}
