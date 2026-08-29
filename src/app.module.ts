import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { PrismaModule } from './common/prisma/prisma.module';
import { HealthModule } from './health/health.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { RolesModule } from './modules/roles/roles.module';
import { PermissionsModule } from './modules/permissions/permissions.module';
import { BranchesModule } from './modules/branches/branches.module';
import { SuppliersModule } from './modules/suppliers/suppliers.module';
import { CustomersModule } from './modules/customers/customers.module';
import { TicketsModule } from './modules/tickets/tickets.module';
import { FlightsModule } from './modules/flights/flights.module';
import { RefundsModule } from './modules/refunds/refunds.module';
import { ExpensesModule } from './modules/expenses/expenses.module';
import { CurrenciesModule } from './modules/currencies/currencies.module';
import { CashboxModule } from './modules/cashbox/cashbox.module';
import { AccountsModule } from './modules/accounts/accounts.module';
import { JournalModule } from './modules/journal/journal.module';
import { LedgerModule } from './modules/ledger/ledger.module';
import { ReportsModule } from './modules/reports/reports.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { AuditModule } from './modules/audit/audit.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { VisaModule } from './modules/visa/visa.module';
import { HotelsModule } from './modules/hotels/hotels.module';
import { PackagesModule } from './modules/packages/packages.module';
import { BookingsModule } from './modules/bookings/bookings.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    PrismaModule,
    HealthModule,
    AuthModule,
    UsersModule,
    RolesModule,
    PermissionsModule,
    BranchesModule,
    SuppliersModule,
    CustomersModule,
    TicketsModule,
    FlightsModule,
    RefundsModule,
    ExpensesModule,
    CurrenciesModule,
    CashboxModule,
    AccountsModule,
    JournalModule,
    LedgerModule,
    ReportsModule,
    DashboardModule,
    AuditModule,
    NotificationsModule,
    VisaModule,
    HotelsModule,
    PackagesModule,
    BookingsModule,
  ],
})
export class AppModule {}
