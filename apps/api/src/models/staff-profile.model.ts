import { createSchema, objectIdField, registerModel } from './model-helpers.js';

const staffProfileSchema = createSchema({
  userId: { ...objectIdField('User'), unique: true },
  employeeCode: { type: String, required: true, unique: true },
  permissions: [{ type: String }],
  notes: String,
  cashVersion: { type: Number, default: 0 },
  createdBy: objectIdField('User', false),
  updatedBy: objectIdField('User', false),
});

export const StaffProfile = registerModel('StaffProfile', staffProfileSchema);
