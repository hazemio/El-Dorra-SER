import { PrismaClient, RoleName, AccountType, AccountSubtype, CurrencyCode } from '@prisma/client';
import * as argon2 from 'argon2';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding Al Dorra Travel ERP Database...');

  // 1. Create Main Branch
  const mainBranch = await prisma.branch.upsert({
    where: { code: 'HQ-01' },
    update: {},
    create: {
      code: 'HQ-01',
      nameAr: 'الفرع الرئيسي - القاهرة',
      nameEn: 'Main Headquarter - Cairo',
      address: 'Nasr City, Cairo, Egypt',
      phone: '+20 2 23456789',
    },
  });
  console.log('✅ Branch Created:', mainBranch.nameEn);

  // 2. Create System Roles
  const rolesMap = new Map<string, string>();
  for (const roleName of [RoleName.ADMIN, RoleName.MANAGER, RoleName.ACCOUNTANT, RoleName.EMPLOYEE]) {
    const role = await prisma.role.upsert({
      where: { name: roleName },
      update: {},
      create: {
        name: roleName,
        description: `System ${roleName} Role`,
        isSystem: true,
      },
    });
    rolesMap.set(roleName, role.id);
  }
  console.log('✅ System Roles Created: ADMIN, MANAGER, ACCOUNTANT, EMPLOYEE');

  // 3. Create System Permissions
  const permissionsList = [
    { name: 'users.read', category: 'Users' },
    { name: 'users.create', category: 'Users' },
    { name: 'users.update', category: 'Users' },
    { name: 'users.delete', category: 'Users' },
    { name: 'roles.read', category: 'Roles' },
    { name: 'roles.create', category: 'Roles' },
    { name: 'roles.update', category: 'Roles' },
    { name: 'branches.read', category: 'Branches' },
    { name: 'branches.create', category: 'Branches' },
    { name: 'suppliers.read', category: 'Suppliers' },
    { name: 'suppliers.create', category: 'Suppliers' },
    { name: 'customers.read', category: 'Customers' },
    { name: 'customers.create', category: 'Customers' },
    { name: 'tickets.read', category: 'Tickets' },
    { name: 'tickets.create', category: 'Tickets' },
    { name: 'tickets.update', category: 'Tickets' },
    { name: 'tickets.delete', category: 'Tickets' },
    { name: 'flights.read', category: 'Flights' },
    { name: 'flights.create', category: 'Flights' },
    { name: 'refunds.read', category: 'Refunds' },
    { name: 'refunds.create', category: 'Refunds' },
    { name: 'expenses.read', category: 'Expenses' },
    { name: 'expenses.create', category: 'Expenses' },
    { name: 'accounts.read', category: 'Accounting' },
    { name: 'accounts.create', category: 'Accounting' },
    { name: 'journal.read', category: 'Accounting' },
    { name: 'journal.post', category: 'Accounting' },
    { name: 'journal.reverse', category: 'Accounting' },
    { name: 'ledger.read', category: 'Accounting' },
    { name: 'reports.view', category: 'Reports' },
    { name: 'settings.manage', category: 'Settings' },
  ];

  const adminRoleId = rolesMap.get(RoleName.ADMIN)!;

  for (const p of permissionsList) {
    const perm = await prisma.permission.upsert({
      where: { name: p.name },
      update: {},
      create: { name: p.name, category: p.category, description: `${p.name} permission` },
    });

    await prisma.rolePermission.upsert({
      where: { roleId_permissionId: { roleId: adminRoleId, permissionId: perm.id } },
      update: {},
      create: { roleId: adminRoleId, permissionId: perm.id },
    });
  }
  console.log('✅ Permissions Assigned to ADMIN role');

  // 4. Create Default Admin User
  const adminPasswordHash = await argon2.hash('Admin@123');
  const adminUser = await prisma.user.upsert({
    where: { email: 'admin@aldorra.com' },
    update: { passwordHash: adminPasswordHash, branchId: mainBranch.id },
    create: {
      email: 'admin@aldorra.com',
      passwordHash: adminPasswordHash,
      fullName: 'مدير النظام (Admin)',
      phone: '+20 1000000000',
      branchId: mainBranch.id,
      isActive: true,
    },
  });

  await prisma.userRole.upsert({
    where: { userId_roleId: { userId: adminUser.id, roleId: adminRoleId } },
    update: {},
    create: { userId: adminUser.id, roleId: adminRoleId },
  });
  console.log('✅ Admin User Created: admin@aldorra.com / Admin@123');

  // 5. Create Currencies
  const currenciesData = [
    { code: CurrencyCode.EGP, nameAr: 'جنيه مصري', nameEn: 'Egyptian Pound', symbol: 'EGP', rate: 1.0, isBase: true },
    { code: CurrencyCode.USD, nameAr: 'دولار أمريكي', nameEn: 'US Dollar', symbol: '$', rate: 49.5, isBase: false },
    { code: CurrencyCode.EUR, nameAr: 'يورو أوروبي', nameEn: 'Euro', symbol: '€', rate: 52.0, isBase: false },
    { code: CurrencyCode.SAR, nameAr: 'ريال سعودي', nameEn: 'Saudi Riyal', symbol: 'SAR', rate: 13.2, isBase: false },
    { code: CurrencyCode.AED, nameAr: 'درهم إماراتي', nameEn: 'UAE Dirham', symbol: 'AED', rate: 13.5, isBase: false },
  ];

  for (const c of currenciesData) {
    await prisma.currency.upsert({
      where: { code: c.code },
      update: { exchangeRateToBase: c.rate },
      create: {
        code: c.code,
        nameAr: c.nameAr,
        nameEn: c.nameEn,
        symbol: c.symbol,
        exchangeRateToBase: c.rate,
        isBase: c.isBase,
        isActive: true,
      },
    });
  }
  console.log('✅ Currencies Initialized: EGP, USD, EUR, SAR, AED');

  // 6. Chart of Accounts Setup
  const accountsData = [
    { code: '1000', nameAr: 'الأصول', nameEn: 'Assets', type: AccountType.ASSET, subtype: AccountSubtype.GENERAL, isHeader: true },
    { code: '1010', nameAr: 'الصندوق الرئيسي (كاش)', nameEn: 'Main Cash Box', type: AccountType.ASSET, subtype: AccountSubtype.CASH, parentCode: '1000' },
    { code: '1020', nameAr: 'الحساب البنكي الرئيسي', nameEn: 'Main Bank Account', type: AccountType.ASSET, subtype: AccountSubtype.BANK, parentCode: '1000' },
    { code: '1030', nameAr: 'العملاء (ذمم مدينة)', nameEn: 'Accounts Receivable', type: AccountType.ASSET, subtype: AccountSubtype.ACCOUNTS_RECEIVABLE, parentCode: '1000' },
    { code: '2000', nameAr: 'الالتزامات', nameEn: 'Liabilities', type: AccountType.LIABILITY, subtype: AccountSubtype.GENERAL, isHeader: true },
    { code: '2010', nameAr: 'الموردون (مستحقات شركات الطيران)', nameEn: 'Accounts Payable', type: AccountType.LIABILITY, subtype: AccountSubtype.ACCOUNTS_PAYABLE, parentCode: '2000' },
    { code: '3000', nameAr: 'حقوق الملكية', nameEn: 'Equity', type: AccountType.EQUITY, subtype: AccountSubtype.GENERAL, isHeader: true },
    { code: '3010', nameAr: 'رأس المال', nameEn: 'Capital', type: AccountType.EQUITY, subtype: AccountSubtype.GENERAL, parentCode: '3000' },
    { code: '4000', nameAr: 'الإيرادات', nameEn: 'Revenue', type: AccountType.REVENUE, subtype: AccountSubtype.GENERAL, isHeader: true },
    { code: '4010', nameAr: 'مبيعات التذاكر', nameEn: 'Ticket Sales Revenue', type: AccountType.REVENUE, subtype: AccountSubtype.TICKET_REVENUE, parentCode: '4000' },
    { code: '4020', nameAr: 'عمولات ورسوم الخدمات', nameEn: 'Service Commissions', type: AccountType.REVENUE, subtype: AccountSubtype.SERVICE_FEE, parentCode: '4000' },
    { code: '5000', nameAr: 'المصروفات', nameEn: 'Expenses', type: AccountType.EXPENSE, subtype: AccountSubtype.GENERAL, isHeader: true },
    { code: '5010', nameAr: 'تكلفة مبيعات التذاكر', nameEn: 'Cost of Tickets Sold', type: AccountType.EXPENSE, subtype: AccountSubtype.OPERATING_EXPENSE, parentCode: '5000' },
    { code: '5020', nameAr: 'المصروفات العمومية والإدارية', nameEn: 'General & Admin Expenses', type: AccountType.EXPENSE, subtype: AccountSubtype.OPERATING_EXPENSE, parentCode: '5000' },
  ];

  const createdAccountMap = new Map<string, string>();
  for (const acc of accountsData) {
    const parentId = acc.parentCode ? createdAccountMap.get(acc.parentCode) : undefined;
    const createdAcc = await prisma.account.upsert({
      where: { code: acc.code },
      update: {},
      create: {
        code: acc.code,
        nameAr: acc.nameAr,
        nameEn: acc.nameEn,
        type: acc.type,
        subtype: acc.subtype,
        isHeader: acc.isHeader || false,
        parentId: parentId || null,
        balance: 100000.0, // Seed initial operational balance for cash & bank
      },
    });
    createdAccountMap.set(acc.code, createdAcc.id);
  }
  console.log('✅ Chart of Accounts Initialized (14 Core Accounts)');

  // 7. Initial Umrah & Hajj Packages
  const umrahPkg = await prisma.package.upsert({
    where: { packageCode: 'PKG-UMR-01' },
    update: {},
    create: {
      packageCode: 'PKG-UMR-01',
      packageNameAr: 'برنامج العمرة الممتاز - 10 أيام (فنادق 5 نجوم)',
      packageNameEn: 'Premium Umrah Package - 10 Days (5-Star Hotels)',
      packageType: 'UMRAH',
      durationDays: 10,
      pricePerPerson: 38000.0,
      costPrice: 30000.0,
    },
  });
  console.log('✅ Umrah & Hajj Packages Initialized:', umrahPkg.packageNameAr);

  console.log('✨ Database Seeding Complete!');
}

main()
  .catch((e) => {
    console.error('❌ Seeding error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
