import { Redirect } from 'expo-router';

import { useAuth } from '../viewmodels/AuthViewModel';

/** Стартовый экран по роли: заказчик — «Мои заявки», водитель — «Поиск грузов», админ — «Модерация». */
export default function Index() {
  const { currentUser } = useAuth();
  const role = currentUser?.role;
  return <Redirect href={role === 'Driver' ? '/feed' : role === 'Admin' ? '/moderation' : '/orders'} />;
}
