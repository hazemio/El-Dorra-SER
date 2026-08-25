import { Controller, Get, Post, Body, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { CustomersService } from './customers.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@ApiTags('Travel - Customers')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('customers')
export class CustomersController {
  constructor(private readonly customersService: CustomersService) {}

  @Get()
  @ApiOperation({ summary: 'Get all customers' })
  async findAll() {
    return this.customersService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get customer profile by ID' })
  async findOne(@Param('id') id: string) {
    return this.customersService.findOne(id);
  }

  @Get(':id/packages')
  @ApiOperation({ summary: 'Get all travel packages registered for a customer' })
  async getCustomerPackages(@Param('id') id: string) {
    return this.customersService.getCustomerPackages(id);
  }

  @Post()
  @ApiOperation({ summary: 'Create new customer' })
  async create(@Body() body: any) {
    return this.customersService.create(body);
  }
}
