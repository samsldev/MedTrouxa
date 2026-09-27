import { Controller, Get, Module, NotFoundException, Param, Query } from '@nestjs/common';
import { legalDoc } from './legal';
import { Public } from '../common/auth';

/**
 * Configuração remota dos apps nativos.
 * `minVersion`: versões abaixo disso mostram a tela de "atualize o app" (use ao quebrar compatibilidade da API).
 */
@Controller('app')
class MobileController {
  @Public() @Get('config')
  config() {
    return {
      minVersion: process.env.MOBILE_MIN_VERSION ?? '1.0.0',
      storeUrls: {
        ios: process.env.MOBILE_APP_STORE_URL ?? null,
        android: process.env.MOBILE_PLAY_STORE_URL ?? null,
      },
      supportEmail: process.env.CONTACT_EMAIL ?? null,
    };
  }
}

/** Textos legais (site e apps). */
@Controller('legal')
class LegalController {
  @Public() @Get(':doc')
  get(@Param('doc') doc: string, @Query('platform') platform?: string) {
    if (doc !== 'termos' && doc !== 'privacidade') throw new NotFoundException();
    return legalDoc(doc, platform === 'app' ? 'app' : 'web');
  }
}

@Module({ controllers: [MobileController, LegalController] })
export class MobileModule {}
