import { Redirect } from 'expo-router';

import { useAuth } from '../viewmodels/AuthViewModel';

/** Стартовый экран по роли: заказчик — «Мои заявки», водитель — «Поиск грузов». */
export default function Index() {
  const { currentUser } = useAuth();
  return <Redirect href={currentUser?.role === 'Driver' ? '/feed' : '/orders'} />;
}
