import { Controller, Get, Post, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ExpensesService } from './expenses.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { GetUser } from '../../common/decorators/get-user.decorator';

@ApiTags('Financial - Expenses')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('expenses')
export class ExpensesController {
  constructor(private readonly expensesService: ExpensesService) {}

  @Get()
  @Permissions('expenses.read')
  @ApiOperation({ summary: 'Get all recorded expenses' })
  async findAll() {
    return this.expensesService.findAll();
  }

  @Post()
  @Permissions('expenses.create')
  @ApiOperation({ summary: 'Record a new expense & post accounting entry' })
  async create(@Body() body: any, @GetUser('id') userId: string) {
    return this.expensesService.create(body, userId);
  }
}
