import { Controller, Get, Post, Body, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { TicketsService } from './tickets.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { GetUser } from '../../common/decorators/get-user.decorator';

@ApiTags('Travel - Tickets')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('tickets')
export class TicketsController {
  constructor(private readonly ticketsService: TicketsService) {}

  @Get()
  @Permissions('tickets.read')
  @ApiOperation({ summary: 'Get all travel tickets' })
  async findAll() {
    return this.ticketsService.findAll();
  }

  @Get(':id')
  @Permissions('tickets.read')
  @ApiOperation({ summary: 'Get ticket by ID' })
  async findOne(@Param('id') id: string) {
    return this.ticketsService.findOne(id);
  }

  @Post()
  @Permissions('tickets.create')
  @ApiOperation({ summary: 'Issue a new travel ticket' })
  async create(@Body() body: any, @GetUser('id') userId: string) {
    return this.ticketsService.create(body, userId);
  }
}
