import mongoose from 'mongoose';
import { Customer, Payment, SchemeEnrollment, User } from '../models/index.js';
import { AppError } from '../utils/AppError.js';
import { getPaymentRules } from './scheme.service.js';
import { signAadhaarUrls } from './storage.service.js';

export async function searchCustomers(search: string) {
  const users = search
    ? await User.find({
        $or: [{ name: new RegExp(search, 'i') }, { phone: new RegExp(search, 'i') }],
        role: 'CUSTOMER',
      })
        .select('_id')
        .lean()
    : [];
  const match = search
    ? {
        $or: [
          { customerCode: new RegExp(search, 'i') },
          {
            userId: mongoose.trusted({
              $in: users.map((user: any) => user._id),
            }),
          },
        ],
      }
    : {};
  return Customer.find(match).populate('userId', 'name phone').limit(30).lean();
}

export async function getCustomerFinancialView(customerId: string) {
  const [customer, schemes, payments] = await Promise.all([
    Customer.findById(customerId).populate('userId', 'name phone').populate('nomineeId').lean(),
    SchemeEnrollment.find({ customerId }).populate('schemePlanId', 'name type').lean(),
    Payment.find({ customerId }).sort({ paymentDate: -1 }).limit(30).lean(),
  ]);
  if (!customer) throw new AppError('CUSTOMER_NOT_FOUND', 'Customer not found', 404);
  const aadhaar = await signAadhaarUrls((customer as any).aadhaar);
  const rules = await Promise.all(
    schemes
      .filter((scheme: any) => scheme.status === 'ACTIVE')
      .map(async (scheme: any) => {
        try {
          const result = await getPaymentRules(String(scheme._id), new Date(), 0);
          return {
            schemeId: scheme._id,
            schemeMonth: result.schemeMonth,
            capPaise: result.capPaise,
            paidThisMonthPaise: result.paidThisMonthPaise,
            remainingPaise: result.remainingPaise,
          };
        } catch {
          return null;
        }
      }),
  );
  return {
    customer: { ...customer, aadhaar },
    schemes,
    payments,
    paymentRules: rules.filter(Boolean),
  };
}
