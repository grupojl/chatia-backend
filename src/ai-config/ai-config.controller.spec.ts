import { Test, TestingModule } from '@nestjs/testing';
import { AiConfigController } from './ai-config.controller';
import { AiConfigService } from './ai-config.service';

describe('AiConfigController', () => {
  let controller: AiConfigController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AiConfigController],
      providers: [AiConfigService],
    }).compile();

    controller = module.get<AiConfigController>(AiConfigController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
