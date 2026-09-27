import { Controller, Get, Module } from '@nestjs/common';
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
      supportEmail: process.env.SUPPORT_EMAIL ?? null,
    };
  }
}

@Module({ controllers: [MobileController] })
export class MobileModule {}
