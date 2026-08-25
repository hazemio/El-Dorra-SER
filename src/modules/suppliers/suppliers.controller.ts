import { Controller, Get, Post, Body, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { SuppliersService } from './suppliers.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { GetUser } from '../../common/decorators/get-user.decorator';

@ApiTags('Travel - Suppliers & Airlines')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('suppliers')
export class SuppliersController {
  constructor(private readonly suppliersService: SuppliersService) {}

  @Get()
  @ApiOperation({ summary: 'Get all suppliers and airlines' })
  async findAll() {
    return this.suppliersService.findAll();
  }

  @Get('reports/payables-aging')
  @ApiOperation({ summary: 'Get payables aging and supplier debt analysis report' })
  async getPayablesAgingReport() {
    return this.suppliersService.getPayablesAgingReport();
  }

  @Get(':id/statement')
  @ApiOperation({ summary: 'Get detailed supplier ledger statement (كشف حساب مورد)' })
  async getStatement(@Param('id') id: string) {
    return this.suppliersService.getStatement(id);
  }

  @Get(':id/unpaid-tickets')
  @ApiOperation({ summary: 'Get unpaid/partially paid tickets for supplier allocation' })
  async getUnpaidTickets(@Param('id') id: string) {
    return this.suppliersService.getUnpaidTickets(id);
  }

  @Post()
  @ApiOperation({ summary: 'Create new supplier or airline' })
  async create(@Body() body: any) {
    return this.suppliersService.create(body);
  }

  @Post(':id/payments')
  @ApiOperation({ summary: 'Record payment to supplier & post automatic journal entry' })
  async recordPayment(
    @Param('id') supplierId: string,
    @Body() body: any,
    @GetUser('id') userId: string
  ) {
    return this.suppliersService.recordPayment(supplierId, body, userId);
  }
}
