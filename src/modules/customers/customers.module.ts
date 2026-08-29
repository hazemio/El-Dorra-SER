import { Module } from '@nestjs/common';
import { CustomersService } from './customers.service';
import { CustomersController } from './customers.controller';
import { CustomerArchiveCronService } from './customer-archive-cron.service';

@Module({
  controllers: [CustomersController],
  providers: [CustomersService, CustomerArchiveCronService],
  exports: [CustomersService],
})
export class CustomersModule {}
