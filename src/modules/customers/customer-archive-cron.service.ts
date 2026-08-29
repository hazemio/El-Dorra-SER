import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { CustomersService } from './customers.service';

@Injectable()
export class CustomerArchiveCronService {
  private readonly logger = new Logger(CustomerArchiveCronService.name);

  constructor(private readonly customersService: CustomersService) {}

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async handleAutoArchiveCron() {
    this.logger.log('Starting scheduled customer auto-archive job...');
    const startTime = Date.now();
    try {
      const result = await this.customersService.autoArchiveInactivity();
      const duration = Date.now() - startTime;
      this.logger.log(
        `Auto-archive cron job completed in ${duration}ms. Scanned: ${result.scanned}, Archived: ${result.archived}, Skipped: ${result.skipped}`
      );
    } catch (error) {
      this.logger.error('Error during auto-archive cron execution:', error);
    }
  }
}
