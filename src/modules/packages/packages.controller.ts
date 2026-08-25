import { Controller, Get, Post, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { PackagesService } from './packages.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@ApiTags('Travel - Umrah & Hajj Packages')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('packages')
export class PackagesController {
  constructor(private readonly packagesService: PackagesService) {}

  @Get()
  @ApiOperation({ summary: 'Get all Umrah, Hajj & Tourism packages' })
  async findAll() {
    return this.packagesService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get package details with enrolled travelers' })
  async findOne(@Param('id') id: string) {
    return this.packagesService.findOne(id);
  }

  @Post()
  @ApiOperation({ summary: 'Create new Umrah / Hajj package' })
  async create(@Body() body: any) {
    return this.packagesService.create(body);
  }

  @Post(':id/travelers')
  @ApiOperation({ summary: 'Add traveler to package' })
  async addTraveler(@Param('id') packageId: string, @Body('customerId') customerId: string) {
    return this.packagesService.addTraveler(packageId, customerId);
  }

  @Get(':id/travelers')
  @ApiOperation({ summary: 'Get all travelers registered in a package' })
  async getTravelers(@Param('id') packageId: string) {
    return this.packagesService.getTravelers(packageId);
  }

  @Delete(':packageId/travelers/:customerId')
  @ApiOperation({ summary: 'Remove traveler from package' })
  async removeTraveler(
    @Param('packageId') packageId: string,
    @Param('customerId') customerId: string
  ) {
    return this.packagesService.removeTraveler(packageId, customerId);
  }
}
