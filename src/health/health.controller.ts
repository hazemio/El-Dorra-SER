import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';

@ApiTags('Health')
@Controller('health')
export class HealthController {
  @Get()
  @ApiOperation({ summary: 'Check API server health status' })
  check() {
    return {
      success: true,
      status: 'UP',
      app: 'Al Dorra Travel ERP API',
      version: '1.0.0',
      timestamp: new Date().toISOString(),
    };
  }
}
