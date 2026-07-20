import { SystemSetting } from '../models/index.js';
import { withMongoTransaction } from '../utils/transaction.js';
import type { UpdateSettingsInput } from '../validators/settings.validators.js';
import { audit, type AuditContext } from './audit.service.js';

export const defaultSettings = {
  businessName: 'Nakshathra Jewellers',
  supportPhone: '',
  supportEmail: '',
  businessAddress: '',
  receiptFooter: 'Thank you for saving with Nakshathra Jewellers.',
  customerPhonePeEnabled: true,
};

export async function getSettings() {
  return (await SystemSetting.findOne({ singletonKey: 'GLOBAL' }).lean()) ?? defaultSettings;
}

export async function updateSettings(
  input: UpdateSettingsInput,
  context: AuditContext & { actorId: string },
) {
  return withMongoTransaction(async (session) => {
    let settings = await SystemSetting.findOne({ singletonKey: 'GLOBAL' }).session(session);
    const before = settings?.toObject();
    if (!settings) {
      [settings] = await SystemSetting.create(
        [{ singletonKey: 'GLOBAL', ...input, updatedBy: context.actorId }],
        { session },
      );
    } else {
      Object.assign(settings, input, { updatedBy: context.actorId });
      await settings.save({ session });
    }
    await audit(
      session,
      context,
      'SYSTEM_SETTINGS_UPDATED',
      'SystemSetting',
      settings._id,
      before,
      settings.toObject(),
    );
    return settings;
  }, context.requestId);
}
