import { Controller, Get, Post, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { BookingsService } from './bookings.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { GetUser } from '../../common/decorators/get-user.decorator';

@ApiTags('ERP - Package Bookings')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('bookings')
export class BookingsController {
  constructor(private readonly bookingsService: BookingsService) {}

  @Get()
  @ApiOperation({ summary: 'Get all package bookings' })
  async findAll() {
    return this.bookingsService.findAll();
  }

  @Get('reports/financial')
  @ApiOperation({ summary: 'Get financial summary report for bookings' })
  async getFinancialReport() {
    return this.bookingsService.getFinancialReport();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get booking details by ID' })
  async findOne(@Param('id') id: string) {
    return this.bookingsService.findOne(id);
  }

  @Post()
  @ApiOperation({ summary: 'Create new package booking' })
  async create(@Body() body: any, @GetUser('id') userId: string) {
    return this.bookingsService.create(body, userId);
  }

  @Post(':id/travelers')
  @ApiOperation({ summary: 'Add traveler to booking' })
  async addTraveler(@Param('id') bookingId: string, @Body() body: any) {
    return this.bookingsService.addTraveler(bookingId, body);
  }

  @Delete(':bookingId/travelers/:travelerId')
  @ApiOperation({ summary: 'Remove traveler from booking' })
  async removeTraveler(
    @Param('bookingId') bookingId: string,
    @Param('travelerId') travelerId: string
  ) {
    return this.bookingsService.removeTraveler(bookingId, travelerId);
  }

  @Post(':id/payments')
  @ApiOperation({ summary: 'Record payment for booking & post automatic journal entry' })
  async addPayment(
    @Param('id') bookingId: string,
    @Body() body: any,
    @GetUser('id') userId: string
  ) {
    return this.bookingsService.addPayment(bookingId, body, userId);
  }
}
