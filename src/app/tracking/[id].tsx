import { useLocalSearchParams } from 'expo-router';

import { TrackingScreen } from '../../views/screens/TrackingScreen';

export default function TrackingRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <TrackingScreen orderId={id} />;
}
