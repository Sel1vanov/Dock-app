import { Redirect } from 'expo-router';

import { useAuth } from '../viewmodels/AuthViewModel';

// стартовый экран по роли: заказчик - мои заявки, водитель - поиск грузов, админ - модерация
export default function Index() {
  const { currentUser } = useAuth();
  const role = currentUser?.role;
  return <Redirect href={role === 'Driver' ? '/feed' : role === 'Admin' ? '/moderation' : '/orders'} />;
}
