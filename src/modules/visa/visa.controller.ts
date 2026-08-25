import { Controller, Get, Post, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { VisaService } from './visa.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { GetUser } from '../../common/decorators/get-user.decorator';

@ApiTags('Travel - Visa Services')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('visas')
export class VisaController {
  constructor(private readonly visaService: VisaService) {}

  @Get()
  @ApiOperation({ summary: 'Get all visa applications' })
  async findAll() {
    return this.visaService.findAll();
  }

  @Post()
  @ApiOperation({ summary: 'Process visa application & post financial entry' })
  async create(@Body() body: any, @GetUser('id') userId: string) {
    return this.visaService.create(body, userId);
  }
}
