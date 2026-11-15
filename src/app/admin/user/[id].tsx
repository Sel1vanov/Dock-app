import { useLocalSearchParams } from 'expo-router';

import { AdminUserScreen } from '../../../views/screens/AdminUserScreen';

export default function AdminUserRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <AdminUserScreen userId={id} />;
}
