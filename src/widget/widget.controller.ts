// src/widget/widget.controller.ts
import {
  Controller, Get, Post, Param, Body, Res,
  HttpCode, HttpStatus, NotFoundException,
} from '@nestjs/common';
import type { Response } from 'express';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { IsString, IsOptional, MinLength, MaxLength } from 'class-validator';
import { PrismaService } from '../prisma/prisma.service';
import { AssistantChatService } from '../assistant/chat/assistant-chat.service';
import { AssistantSessionService } from '../assistant/session/assistant-session.service';

class WidgetChatDto {
  @IsString() @MinLength(1) @MaxLength(4000)
  message: string;

  @IsString() @MinLength(1) @MaxLength(200)
  userId: string;
}

@ApiTags('Widget (público)')
@Controller('widget')
export class WidgetController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly chatService: AssistantChatService,
    private readonly sessionService: AssistantSessionService,
  ) {}

  // ── Config pública del asistente ─────────────────────────────────────────

  @Get(':projectSlug/config')
  @ApiOperation({ summary: 'Config pública del asistente (sin auth)' })
  async getConfig(@Param('projectSlug') slug: string) {
    const config = await this.resolveConfig(slug);

    // Solo exponer campos públicos — nunca el systemPrompt
    return {
      personaName:    config.personaName,
      welcomeMessage: config.welcomeMessage,
      isEnabled:      config.isEnabled,
      groqModel:      config.groqModel,
    };
  }

  // ── Chat del widget ───────────────────────────────────────────────────────

  @Post(':projectSlug/chat')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Enviar mensaje al asistente (sin auth, userId anónimo)' })
  async chat(
    @Param('projectSlug') slug: string,
    @Body() dto: WidgetChatDto,
  ) {
    const config = await this.resolveConfig(slug);

    return this.chatService.chat({
      projectSlug: slug,
      organizationId: config.organizationId,
      userId: dto.userId,
      message: dto.message,
      channel: 'widget',
    });
  }

  // ── Historial de sesión ───────────────────────────────────────────────────

  @Get(':projectSlug/session/:userId')
  @ApiOperation({ summary: 'Recuperar historial de sesión (sin auth)' })
  async getSession(
    @Param('projectSlug') slug: string,
    @Param('userId') userId: string,
  ) {
    const config = await this.resolveConfig(slug);

    const session = await this.sessionService.findByUser(
      config.id,
      config.organizationId,
      userId,
    );

    return { success: true, data: session ?? null };
  }

  // ── Snippet JS embeddable ─────────────────────────────────────────────────

  @Get(':projectSlug/snippet.js')
  @ApiOperation({ summary: 'Script JS embeddable para incrustar el widget en cualquier web' })
  async getSnippet(
    @Param('projectSlug') slug: string,
    @Res() res: Response,
  ) {
    const config = await this.resolveConfig(slug);
    const appUrl  = process.env.APP_URL ?? 'http://localhost:3000';

    const snippet = this.buildSnippet({
      projectSlug:    slug,
      apiUrl:         `${appUrl}/api/v1`,
      personaName:    config.personaName,
      welcomeMessage: config.welcomeMessage ?? '¡Hola! ¿En qué puedo ayudarte?',
    });

    res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.send(snippet);
  }

  // ── Helper: resolver config por slug (sin organizationId) ────────────────

  private async resolveConfig(slug: string) {
    // Busca el proyecto por slug en cualquier organización (el slug es único por org)
    // Para el widget no se requiere auth — el slug actúa como identificador público
    const project = await this.prisma.project.findFirst({
      where: { slug, isActive: true },
      include: { assistantConfigs: true },
    });

    if (!project) throw new NotFoundException(`Proyecto "${slug}" no encontrado`);

    const config = project.assistantConfigs[0];
    if (!config) throw new NotFoundException('Este proyecto no tiene asistente configurado');
    if (!config.isEnabled) throw new NotFoundException('El asistente no está disponible');

    return config;
  }

  // ── Snippet JS ────────────────────────────────────────────────────────────

  private buildSnippet(opts: {
    projectSlug: string;
    apiUrl: string;
    personaName: string;
    welcomeMessage: string;
  }): string {
    return `
(function() {
  var API_URL      = '${opts.apiUrl}';
  var PROJECT_SLUG = '${opts.projectSlug}';
  var PERSONA_NAME = '${opts.personaName.replace(/'/g, "\\'")}';
  var WELCOME_MSG  = '${opts.welcomeMessage.replace(/'/g, "\\'")}';

  // Generar userId anónimo persistido en localStorage
  function getUserId() {
    var key = 'chatia_uid_' + PROJECT_SLUG;
    var uid = localStorage.getItem(key);
    if (!uid) {
      uid = 'anon_' + Math.random().toString(36).slice(2) + Date.now().toString(36);
      localStorage.setItem(key, uid);
    }
    return uid;
  }

  // Crear el widget
  var style = document.createElement('style');
  style.textContent = [
    '#chatia-widget { position:fixed; bottom:24px; right:24px; z-index:9999; font-family:system-ui,sans-serif; }',
    '#chatia-bubble { width:56px; height:56px; border-radius:50%; background:#6366f1; border:none; cursor:pointer; color:#fff; font-size:24px; display:flex; align-items:center; justify-content:center; box-shadow:0 4px 12px rgba(0,0,0,.2); }',
    '#chatia-box { display:none; flex-direction:column; width:340px; height:480px; background:#fff; border-radius:16px; box-shadow:0 8px 32px rgba(0,0,0,.15); overflow:hidden; position:absolute; bottom:68px; right:0; }',
    '#chatia-box.open { display:flex; }',
    '#chatia-header { background:#6366f1; color:#fff; padding:14px 16px; font-weight:600; font-size:15px; }',
    '#chatia-messages { flex:1; overflow-y:auto; padding:12px; display:flex; flex-direction:column; gap:8px; }',
    '.chatia-msg { max-width:80%; padding:8px 12px; border-radius:12px; font-size:14px; line-height:1.5; }',
    '.chatia-msg.user { background:#6366f1; color:#fff; align-self:flex-end; border-bottom-right-radius:4px; }',
    '.chatia-msg.bot  { background:#f1f5f9; color:#1e293b; align-self:flex-start; border-bottom-left-radius:4px; }',
    '#chatia-input-row { display:flex; padding:10px; gap:8px; border-top:1px solid #e2e8f0; }',
    '#chatia-input { flex:1; border:1px solid #e2e8f0; border-radius:8px; padding:8px 12px; font-size:14px; outline:none; }',
    '#chatia-send { background:#6366f1; color:#fff; border:none; border-radius:8px; padding:8px 14px; cursor:pointer; font-size:14px; }',
    '.chatia-typing { color:#94a3b8; font-size:13px; font-style:italic; align-self:flex-start; padding:4px 12px; }'
  ].join('');
  document.head.appendChild(style);

  var widget = document.createElement('div');
  widget.id = 'chatia-widget';
  widget.innerHTML = [
    '<button id="chatia-bubble" title="Abrir chat">💬</button>',
    '<div id="chatia-box">',
    '  <div id="chatia-header">' + PERSONA_NAME + '</div>',
    '  <div id="chatia-messages"></div>',
    '  <div id="chatia-input-row">',
    '    <input id="chatia-input" placeholder="Escribí tu mensaje..." />',
    '    <button id="chatia-send">Enviar</button>',
    '  </div>',
    '</div>'
  ].join('');
  document.body.appendChild(widget);

  var box      = document.getElementById('chatia-box');
  var messages = document.getElementById('chatia-messages');
  var input    = document.getElementById('chatia-input');
  var opened   = false;

  function addMsg(text, role) {
    var div = document.createElement('div');
    div.className = 'chatia-msg ' + role;
    div.textContent = text;
    messages.appendChild(div);
    messages.scrollTop = messages.scrollHeight;
  }

  function setTyping(on) {
    var el = document.getElementById('chatia-typing-indicator');
    if (on && !el) {
      var t = document.createElement('div');
      t.id = 'chatia-typing-indicator';
      t.className = 'chatia-typing';
      t.textContent = PERSONA_NAME + ' está escribiendo...';
      messages.appendChild(t);
      messages.scrollTop = messages.scrollHeight;
    } else if (!on && el) {
      el.remove();
    }
  }

  async function sendMessage() {
    var text = input.value.trim();
    if (!text) return;
    input.value = '';
    addMsg(text, 'user');
    setTyping(true);

    try {
      var res = await fetch(API_URL + '/widget/' + PROJECT_SLUG + '/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, userId: getUserId() })
      });
      var data = await res.json();
      setTyping(false);
      addMsg(data.response || 'Error al obtener respuesta', 'bot');
    } catch(e) {
      setTyping(false);
      addMsg('Error de conexión. Intentá de nuevo.', 'bot');
    }
  }

  document.getElementById('chatia-bubble').addEventListener('click', function() {
    opened = !opened;
    box.classList.toggle('open', opened);
    if (opened && messages.children.length === 0) {
      addMsg(WELCOME_MSG, 'bot');
    }
  });

  document.getElementById('chatia-send').addEventListener('click', sendMessage);

  input.addEventListener('keydown', function(e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  });
})();
`.trim();
  }
}
