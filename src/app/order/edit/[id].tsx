import { useLocalSearchParams } from 'expo-router';

import { OrderFormScreen } from '../../../views/screens/OrderFormScreen';

export default function EditOrderRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <OrderFormScreen orderId={id} />;
}
