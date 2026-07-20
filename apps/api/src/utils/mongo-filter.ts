import mongoose from 'mongoose';

export const claimableOutboxFilter = (at: Date) => ({
  status: 'PENDING' as const,
  availableAt: mongoose.trusted({ $lte: at }),
});
