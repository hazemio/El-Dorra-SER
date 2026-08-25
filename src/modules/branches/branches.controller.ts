import { Controller, Get, Post, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { BranchesService } from './branches.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { Permissions } from '../../common/decorators/permissions.decorator';

@ApiTags('Branches')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('branches')
export class BranchesController {
  constructor(private readonly branchesService: BranchesService) {}

  @Get()
  @Permissions('branches.read')
  @ApiOperation({ summary: 'Get all branches' })
  async findAll() {
    return this.branchesService.findAll();
  }

  @Post()
  @Permissions('branches.create')
  @ApiOperation({ summary: 'Create a new branch' })
  async create(@Body() body: any) {
    return this.branchesService.create(body);
  }
}
