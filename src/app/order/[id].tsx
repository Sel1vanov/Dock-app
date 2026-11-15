import { useLocalSearchParams } from 'expo-router';

import { OrderDetailsScreen } from '../../views/screens/OrderDetailsScreen';

export default function OrderRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <OrderDetailsScreen orderId={id} />;
}
