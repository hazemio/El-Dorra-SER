import { Controller, Get, Post, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { RefundsService } from './refunds.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { GetUser } from '../../common/decorators/get-user.decorator';

@ApiTags('Travel - Refunds')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('refunds')
export class RefundsController {
  constructor(private readonly refundsService: RefundsService) {}

  @Get()
  @Permissions('refunds.read')
  @ApiOperation({ summary: 'Get all ticket refunds' })
  async findAll() {
    return this.refundsService.findAll();
  }

  @Post()
  @Permissions('refunds.create')
  @ApiOperation({ summary: 'Process ticket refund & reversal' })
  async create(@Body() body: any, @GetUser('id') userId: string) {
    return this.refundsService.create(body, userId);
  }
}
