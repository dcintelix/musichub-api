import { Controller, Get, Header } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { LandingPageService } from './landing-page.service';

@ApiTags('public')
@Controller('public/landing-page')
export class LandingPageController {
  constructor(private readonly landingPageService: LandingPageService) {}

  @Get()
  @Header('Cache-Control', 'public, max-age=60, stale-while-revalidate=300')
  getContent() {
    return this.landingPageService.getContent();
  }
}
