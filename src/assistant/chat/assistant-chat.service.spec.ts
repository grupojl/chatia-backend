// src/assistant/chat/assistant-chat.service.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { AssistantChatService } from './assistant-chat.service';
import { AssistantConfigService } from '../config/assistant-config.service';
import { AssistantSessionService } from '../session/assistant-session.service';
import { GroqService } from '../../groq/groq.service';
import { EventsGateway } from '../../events/events.gateway';
import { PrismaService } from '../../prisma/prisma.service';

const mockConfig = {
  id: 'config-1', projectId: 'proj-1', organizationId: 'org-1',
  personaName: 'Sofía', systemPrompt: 'Sos un asistente de prueba.',
  groqModel: 'llama-3.3-70b-versatile', temperature: 0.7, maxTokens: 1024,
  contextWindow: 10, welcomeMessage: null,
  fallbackMessage: 'No puedo responder en este momento.',
  useFaqFallback: false, faqKbId: null, isEnabled: true,
  createdAt: new Date(), updatedAt: new Date(),
};

const mockSession = {
  id: 'session-1', assistantConfigId: 'config-1', organizationId: 'org-1',
  externalUserId: 'user-123', channel: 'api', history: [], metadata: {},
  createdAt: new Date(), updatedAt: new Date(), lastMessageAt: null,
};

describe('AssistantChatService', () => {
  let service: AssistantChatService;

  const mockConfigSvc = {
    findByProjectSlug: jest.fn().mockResolvedValue(mockConfig),
  };
  const mockSessionSvc = {
    getOrCreate: jest.fn().mockResolvedValue(mockSession),
    appendMessage: jest.fn().mockResolvedValue({}),
    getHistory: jest.fn().mockResolvedValue([]),
    findByUser: jest.fn(),
    deleteByUser: jest.fn(),
  };
  const mockGroq = {
    chat: jest.fn().mockResolvedValue({
      content: 'Hola, soy Sofía. ¿En qué puedo ayudarte?',
      tokensUsed: 42,
      model: 'llama-3.3-70b-versatile',
    }),
  };
  const mockEvents = { emitToAgent: jest.fn() };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AssistantChatService,
        { provide: AssistantConfigService, useValue: mockConfigSvc },
        { provide: AssistantSessionService, useValue: mockSessionSvc },
        { provide: GroqService, useValue: mockGroq },
        { provide: EventsGateway, useValue: mockEvents },
        { provide: PrismaService, useValue: {} },
      ],
    }).compile();

    service = module.get<AssistantChatService>(AssistantChatService);
    jest.clearAllMocks();
    mockConfigSvc.findByProjectSlug.mockResolvedValue(mockConfig);
    mockSessionSvc.getOrCreate.mockResolvedValue(mockSession);
    mockSessionSvc.getHistory.mockResolvedValue([]);
    mockGroq.chat.mockResolvedValue({
      content: 'Hola, soy Sofía. ¿En qué puedo ayudarte?',
      tokensUsed: 42, model: 'llama-3.3-70b-versatile',
    });
  });

  it('debe estar definido', () => {
    expect(service).toBeDefined();
  });

  it('retorna respuesta de Groq correctamente', async () => {
    const result = await service.chat({
      projectSlug: 'shopbot', organizationId: 'org-1',
      userId: 'user-123', message: 'Hola', channel: 'api',
    });
    expect(result.response).toBe('Hola, soy Sofía. ¿En qué puedo ayudarte?');
    expect(result.tokensUsed).toBe(42);
    expect(result.sessionId).toBe('session-1');
    expect(result.usedFaqFallback).toBe(false);
  });

  it('crea sesión nueva cuando no existe', async () => {
    await service.chat({
      projectSlug: 'shopbot', organizationId: 'org-1',
      userId: 'new-user', message: 'Hola',
    });
    expect(mockSessionSvc.getOrCreate).toHaveBeenCalledWith(
      'config-1', 'org-1', 'new-user', 'api',
    );
  });

  it('respeta contextWindow al armar historial', async () => {
    await service.chat({
      projectSlug: 'shopbot', organizationId: 'org-1',
      userId: 'user-123', message: 'test',
    });
    expect(mockSessionSvc.getHistory).toHaveBeenCalledWith('session-1', 10);
  });

  it('devuelve fallbackMessage cuando el asistente está deshabilitado', async () => {
    mockConfigSvc.findByProjectSlug.mockResolvedValue({
      ...mockConfig, isEnabled: false, fallbackMessage: 'Fuera de servicio',
    });
    const result = await service.chat({
      projectSlug: 'shopbot', organizationId: 'org-1',
      userId: 'user-123', message: 'Hola',
    });
    expect(result.response).toBe('Fuera de servicio');
    expect(mockGroq.chat).not.toHaveBeenCalled();
  });

  it('marca usedFaqFallback cuando hay baja confianza y useFaqFallback=true', async () => {
    mockConfigSvc.findByProjectSlug.mockResolvedValue({
      ...mockConfig, useFaqFallback: true,
    });
    mockGroq.chat.mockResolvedValue({
      content: 'No tengo esa información.',
      tokensUsed: 10, model: 'llama-3.3-70b-versatile',
    });
    const result = await service.chat({
      projectSlug: 'shopbot', organizationId: 'org-1',
      userId: 'user-123', message: '¿Precio del depto?',
    });
    expect(result.usedFaqFallback).toBe(true);
  });
});
