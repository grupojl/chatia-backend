import { Test, TestingModule } from '@nestjs/testing';
import { AiConfigService } from './ai-config.service';

describe('AiConfigService', () => {
  let service: AiConfigService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [AiConfigService],
    }).compile();

    service = module.get<AiConfigService>(AiConfigService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
