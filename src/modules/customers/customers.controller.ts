import { Controller, Get, Post, Delete, Body, Param, Query, UseGuards, ForbiddenException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { CustomersService } from './customers.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { GetUser } from '../../common/decorators/get-user.decorator';

@ApiTags('Travel - Customers')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('customers')
export class CustomersController {
  constructor(private readonly customersService: CustomersService) {}

  @Get()
  @ApiOperation({ summary: 'Get customers list with filters' })
  @ApiQuery({ name: 'status', required: false, enum: ['ACTIVE', 'ARCHIVED', 'ALL'] })
  @ApiQuery({ name: 'search', required: false, type: String })
  async findAll(@Query('status') status?: string, @Query('search') search?: string) {
    return this.customersService.findAll({ status, search });
  }

  @Get('archived')
  @ApiOperation({ summary: 'Get archived customers list' })
  async getArchived() {
    return this.customersService.findAll({ status: 'ARCHIVED' });
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

  @Post('auto-archive')
  @ApiOperation({ summary: 'Manually trigger customer auto-archive rule (Admin only)' })
  async autoArchive(@GetUser() user: any) {
    const isAdmin = user?.roles?.includes('ADMIN');
    if (!isAdmin) {
      throw new ForbiddenException('Only system Administrators can execute customer auto-archive.');
    }
    return this.customersService.autoArchiveInactivity();
  }

  @Post(':id/archive')
  @ApiOperation({ summary: 'Archive a customer (Admin only)' })
  async archiveCustomer(
    @Param('id') id: string,
    @Body('reason') reason: string,
    @GetUser() user: any
  ) {
    const isAdmin = user?.roles?.includes('ADMIN');
    if (!isAdmin) {
      throw new ForbiddenException('Only system Administrators can archive customers.');
    }
    return this.customersService.archiveCustomer(id, user?.id, reason);
  }

  @Post(':id/restore')
  @ApiOperation({ summary: 'Restore an archived customer (Admin only)' })
  async restoreCustomer(@Param('id') id: string, @GetUser() user: any) {
    const isAdmin = user?.roles?.includes('ADMIN');
    if (!isAdmin) {
      throw new ForbiddenException('Only system Administrators can restore customers.');
    }
    return this.customersService.restoreCustomer(id);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete or archive customer safely (Admin only)' })
  async deleteCustomer(
    @Param('id') id: string,
    @Body('reason') reason: string,
    @GetUser() user: any
  ) {
    const isAdmin = user?.roles?.includes('ADMIN');
    return this.customersService.deleteCustomer(id, user?.id, isAdmin, reason);
  }
}
