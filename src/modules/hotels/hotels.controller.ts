import { Controller, Get, Post, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { HotelsService } from './hotels.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { GetUser } from '../../common/decorators/get-user.decorator';

@ApiTags('Travel - Hotel Reservations')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('hotels')
export class HotelsController {
  constructor(private readonly hotelsService: HotelsService) {}

  @Get()
  @ApiOperation({ summary: 'Get all hotel reservations' })
  async findAll() {
    return this.hotelsService.findAll();
  }

  @Post()
  @ApiOperation({ summary: 'Book hotel reservation & post financial entry' })
  async create(@Body() body: any, @GetUser('id') userId: string) {
    return this.hotelsService.create(body, userId);
  }
}
