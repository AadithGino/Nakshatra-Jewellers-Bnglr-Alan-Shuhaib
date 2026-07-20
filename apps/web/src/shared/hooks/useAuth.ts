import { useContext } from 'react';
import { AuthContext } from '../../store/auth.store';

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error('SessionProvider missing');
  return value;
}
