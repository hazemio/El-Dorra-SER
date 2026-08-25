import { Controller, Get, Post, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { FlightsService } from './flights.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { Permissions } from '../../common/decorators/permissions.decorator';

@ApiTags('Travel - Flights')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('flights')
export class FlightsController {
  constructor(private readonly flightsService: FlightsService) {}

  @Get()
  @Permissions('flights.read')
  @ApiOperation({ summary: 'Get all flights' })
  async findAll() {
    return this.flightsService.findAll();
  }

  @Post()
  @Permissions('flights.create')
  @ApiOperation({ summary: 'Create new flight schedule' })
  async create(@Body() body: any) {
    return this.flightsService.create(body);
  }
}
