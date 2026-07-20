import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { connectDatabase, disconnectDatabase } from '../src/config/database.js';
import { Customer, Payment, User } from '../src/models/index.js';
import { staffDashboard } from '../src/services/report.service.js';
import { AppError } from '../src/utils/AppError.js';
import { businessDayRange } from '../src/utils/time.js';

let app: typeof import('../src/app.js').app;

const createStaffUser = async () =>
  User.create({
    name: 'Test Staff',
    phone: `+9199${Math.floor(Math.random() * 1_000_000_000)
      .toString()
      .padStart(9, '0')}`,
    passwordHash: 'test-hash',
    role: 'STAFF',
    status: 'ACTIVE',
    sessionVersion: 0,
  });

const createCustomer = async (createdBy: mongoose.Types.ObjectId) => {
  const user = await User.create({
    name: 'Test Customer',
    phone: `+9188${Math.floor(Math.random() * 1_000_000_000)
      .toString()
      .padStart(9, '0')}`,
    passwordHash: 'test-hash',
    role: 'CUSTOMER',
    status: 'ACTIVE',
    createdBy,
  });
  return Customer.create({
    userId: user._id,
    customerCode: `NKS-C${Math.floor(Math.random() * 10_000)}`,
    status: 'ACTIVE',
    createdBy,
  });
};

const createPayment = async (options: {
  staffId: mongoose.Types.ObjectId;
  customerId: mongoose.Types.ObjectId;
  paymentDate: Date;
  amountPaise?: number;
  receiptNumber?: string;
}) => {
  const schemeId = new mongoose.Types.ObjectId();
  return Payment.create({
    customerId: options.customerId,
    schemeId,
    amountPaise: options.amountPaise ?? 10_000,
    method: 'CASH',
    status: 'SUCCESS',
    paymentDate: options.paymentDate,
    schemeMonth: 1,
    receiptNumber: options.receiptNumber ?? `RCP-${Math.random().toString(36).slice(2, 10)}`,
    collectedBy: options.staffId,
    collectorRole: 'STAFF',
    createdBy: options.staffId,
  });
};

const emptyDashboard = {
  collectionPaise: 0,
  todayCollectionPaise: 0,
  todayPaymentCount: 0,
  cashCollectedPaise: 0,
  cashSubmittedPaise: 0,
  cashWithStaffPaise: 0,
  customersServedToday: 0,
  recentPayments: [],
  recentCustomers: [],
  currentGoldRate: null,
};

describe('staff dashboard', () => {
  beforeAll(async () => {
    ({ app } = await import('../src/app.js'));
    await connectDatabase();
  });

  afterAll(async () => {
    await disconnectDatabase();
  });

  beforeEach(async () => {
    await mongoose.connection.db?.dropDatabase();
  });

  it('returns zero values when the staff member has no payments', async () => {
    const staff = await createStaffUser();
    const dashboard = await staffDashboard(String(staff._id));
    expect(dashboard).toEqual(emptyDashboard);
  });

  it('counts a payment inside today’s Asia/Kolkata range', async () => {
    const staff = await createStaffUser();
    const customer = await createCustomer(staff._id);
    const { start, end } = businessDayRange();
    const paymentDate = new Date((start.getTime() + end.getTime()) / 2);
    await createPayment({ staffId: staff._id, customerId: customer._id, paymentDate });

    const dashboard = await staffDashboard(String(staff._id));
    expect(dashboard.todayCollectionPaise).toBe(10_000);
    expect(dashboard.todayPaymentCount).toBe(1);
    expect(dashboard.customersServedToday).toBe(1);
  });

  it('excludes a payment before today', async () => {
    const staff = await createStaffUser();
    const customer = await createCustomer(staff._id);
    const { start } = businessDayRange();
    await createPayment({
      staffId: staff._id,
      customerId: customer._id,
      paymentDate: new Date(start.getTime() - 1),
    });

    const dashboard = await staffDashboard(String(staff._id));
    expect(dashboard.todayCollectionPaise).toBe(0);
    expect(dashboard.todayPaymentCount).toBe(0);
    expect(dashboard.customersServedToday).toBe(0);
    expect(dashboard.collectionPaise).toBe(10_000);
  });

  it('includes a payment exactly at the start boundary', async () => {
    const staff = await createStaffUser();
    const customer = await createCustomer(staff._id);
    const { start } = businessDayRange();
    await createPayment({ staffId: staff._id, customerId: customer._id, paymentDate: start });

    const dashboard = await staffDashboard(String(staff._id));
    expect(dashboard.todayPaymentCount).toBe(1);
    expect(dashboard.todayCollectionPaise).toBe(10_000);
  });

  it('excludes a payment exactly at the end boundary', async () => {
    const staff = await createStaffUser();
    const customer = await createCustomer(staff._id);
    const { end } = businessDayRange();
    await createPayment({ staffId: staff._id, customerId: customer._id, paymentDate: end });

    const dashboard = await staffDashboard(String(staff._id));
    expect(dashboard.todayPaymentCount).toBe(0);
    expect(dashboard.todayCollectionPaise).toBe(0);
    expect(dashboard.collectionPaise).toBe(10_000);
  });

  it('counts distinct customers once for multiple payments today', async () => {
    const staff = await createStaffUser();
    const customerA = await createCustomer(staff._id);
    const customerB = await createCustomer(staff._id);
    const { start } = businessDayRange();
    await createPayment({
      staffId: staff._id,
      customerId: customerA._id,
      paymentDate: start,
      amountPaise: 5_000,
      receiptNumber: 'RCP-A1',
    });
    await createPayment({
      staffId: staff._id,
      customerId: customerA._id,
      paymentDate: new Date(start.getTime() + 60_000),
      amountPaise: 7_000,
      receiptNumber: 'RCP-A2',
    });
    await createPayment({
      staffId: staff._id,
      customerId: customerB._id,
      paymentDate: new Date(start.getTime() + 120_000),
      amountPaise: 3_000,
      receiptNumber: 'RCP-B1',
    });

    const dashboard = await staffDashboard(String(staff._id));
    expect(dashboard.customersServedToday).toBe(2);
    expect(dashboard.todayPaymentCount).toBe(3);
    expect(dashboard.todayCollectionPaise).toBe(15_000);
  });

  it('returns null currentGoldRate when no active rate exists', async () => {
    const staff = await createStaffUser();
    const dashboard = await staffDashboard(String(staff._id));
    expect(dashboard.currentGoldRate).toBeNull();
  });

  it('returns a structured error for an invalid staff ID', async () => {
    await expect(staffDashboard('not-a-valid-id')).rejects.toMatchObject({
      code: 'INVALID_STAFF_ID',
      statusCode: 422,
      message: 'Staff identifier is invalid',
    } satisfies Partial<AppError>);
  });

  it('does not throw a CastError for paymentDate distinct queries', async () => {
    const staff = await createStaffUser();
    const customer = await createCustomer(staff._id);
    const { start } = businessDayRange();
    await createPayment({ staffId: staff._id, customerId: customer._id, paymentDate: start });

    await expect(staffDashboard(String(staff._id))).resolves.toMatchObject({
      customersServedToday: 1,
    });
  });

  it('serves GET /api/v1/staff/dashboard for an authenticated STAFF user', async () => {
    const staff = await createStaffUser();
    const accessToken = jwt.sign(
      {
        sub: String(staff._id),
        role: 'STAFF',
        permissions: [],
        sessionVersion: 0,
        type: 'access',
        jti: 'staff-dashboard-test',
      },
      process.env.JWT_ACCESS_SECRET!,
      { expiresIn: '15m' },
    );

    const response = await request(app)
      .get('/api/v1/staff/dashboard')
      .set('Cookie', [`access_token=${accessToken}`]);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data).toEqual(emptyDashboard);
  });
});
