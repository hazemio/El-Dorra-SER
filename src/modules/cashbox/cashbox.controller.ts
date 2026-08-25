import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { CashboxService } from './cashbox.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@ApiTags('Finance - Cashbox')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('cashbox')
export class CashboxController {
  constructor(private readonly cashboxService: CashboxService) {}

  @Get()
  @ApiOperation({ summary: 'Get branch cashbox balances' })
  async findAll() {
    return this.cashboxService.findAll();
  }
}
