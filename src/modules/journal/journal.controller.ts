import { Controller, Get, Post, Body, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JournalService } from './journal.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { GetUser } from '../../common/decorators/get-user.decorator';

@ApiTags('Accounting - Journal')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('journal')
export class JournalController {
  constructor(private readonly journalService: JournalService) {}

  @Get()
  @Permissions('journal.read')
  @ApiOperation({ summary: 'Get all journal entries' })
  async findAll() {
    return this.journalService.findAll();
  }

  @Get(':id')
  @Permissions('journal.read')
  @ApiOperation({ summary: 'Get journal entry by ID' })
  async findOne(@Param('id') id: string) {
    return this.journalService.findOne(id);
  }

  @Post('post')
  @Permissions('journal.post')
  @ApiOperation({ summary: 'Post a balanced double-entry transaction' })
  async postEntry(@Body() body: any, @GetUser('id') userId: string) {
    return this.journalService.postEntry({ ...body, createdById: userId });
  }

  @Post('reverse/:id')
  @Permissions('journal.reverse')
  @ApiOperation({ summary: 'Reverse a posted journal entry' })
  async reverseEntry(@Param('id') id: string, @GetUser('id') userId: string) {
    return this.journalService.reverseEntry(id, userId);
  }
}
