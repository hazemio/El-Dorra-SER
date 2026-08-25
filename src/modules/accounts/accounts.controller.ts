import { Controller, Get, Post, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AccountsService } from './accounts.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { Permissions } from '../../common/decorators/permissions.decorator';

@ApiTags('Accounting - Chart of Accounts')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('accounts')
export class AccountsController {
  constructor(private readonly accountsService: AccountsService) {}

  @Get()
  @Permissions('accounts.read')
  @ApiOperation({ summary: 'Get Chart of Accounts' })
  async findAll() {
    return this.accountsService.findAll();
  }

  @Post()
  @Permissions('accounts.create')
  @ApiOperation({ summary: 'Create new account' })
  async create(@Body() body: any) {
    return this.accountsService.create(body);
  }
}
