import { Body, Controller, Get, Module, Param, Post, Query } from '@nestjs/common';
import { connect, DB } from './db';
import { NavService } from './nav.service';
import { SitesService } from './sites.service';

@Controller()
class ApiController {
  constructor(private sites: SitesService, private nav: NavService) {}
  @Get('people') people() { return this.sites.people(); }
  @Get('sites') list() { return this.sites.list(); }
  @Post('sites') publish(@Body() b: any) { return this.sites.publish(b); }
  @Get('search') search(@Query('q') q: string) { return this.sites.search(q); }
  @Get('people/:id/history')
  async history(@Param('id') id: string, @Query('limit') limit: string, @Query('before') before: string) {
    await this.nav.assertPerson(id);
    return this.sites.history(id, limit, before);
  }
  @Get('people/:id/nav') view(@Param('id') id: string) { return this.nav.view(id); }
  @Post('people/:id/nav/go') go(@Param('id') id: string, @Body() b: any) { return this.nav.go(id, b); }
  @Post('people/:id/nav/back') back(@Param('id') id: string, @Body() b: any) { return this.nav.back(id, b); }
  @Post('people/:id/nav/forward') forward(@Param('id') id: string, @Body() b: any) { return this.nav.forward(id, b); }
  @Post('people/:id/nav/scroll') scroll(@Param('id') id: string, @Body() b: any) { return this.nav.scroll(id, b); }
}

@Module({
  controllers: [ApiController],
  providers: [{ provide: DB, useFactory: connect }, NavService, SitesService],
})
export class AppModule {}
