import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ReportsService } from './reports.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { Permissions } from '../../common/decorators/permissions.decorator';

@ApiTags('Reports')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('sales')
  @Permissions('reports.view')
  @ApiOperation({ summary: 'Get Sales Performance Report' })
  async getSalesReport() {
    return this.reportsService.getSalesReport();
  }

  @Get('profit')
  @Permissions('reports.view')
  @ApiOperation({ summary: 'Get Income Statement & Net Profit Report' })
  async getProfitReport() {
    return this.reportsService.getProfitReport();
  }

  @Get('cash-flow')
  @Permissions('reports.view')
  @ApiOperation({ summary: 'Get Cash Flow Report' })
  async getCashFlowReport() {
    return this.reportsService.getCashFlowReport();
  }

  @Get('trial-balance')
  @Permissions('reports.view')
  @ApiOperation({ summary: 'Get Trial Balance Report (ميزان المراجعة)' })
  async getTrialBalance() {
    return this.reportsService.getTrialBalance();
  }

  @Get('balance-sheet')
  @Permissions('reports.view')
  @ApiOperation({ summary: 'Get Balance Sheet (الميزانية العمومية)' })
  async getBalanceSheet() {
    return this.reportsService.getBalanceSheet();
  }

  @Get('financial-analytics')
  @Permissions('reports.view')
  @ApiOperation({ summary: 'Get Enterprise Financial Analytics Dashboard Data' })
  async getFinancialAnalytics() {
    return this.reportsService.getFinancialAnalytics();
  }
}
