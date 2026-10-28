/** Компоненты предметной области: маршрут, габариты, карточка заказа, прогресс рейса, фото. */
import { LinearGradient } from 'expo-linear-gradient';
import type { ReactNode } from 'react';
import { Image, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useState } from 'react';

import { bidStatusInfo, cargoTypeInfo, orderStatusInfo } from '../../models/catalog';
import { ORDER_TIMELINE, timelineIndex } from '../../models/domain';
import type { CargoDTO, DimensionsDTO, OrderListItemDTO, OrderStatus, PhotoDTO } from '../../models/dto';
import { colors, font, formatNumber, formatPrice, formatRelative, radius, spacing } from '../theme';
import { Badge, Button, Card, Icon, TextField } from './ui';

// ------------------------------------------------------------- Header ---

export function GradientHeader({
  title,
  subtitle,
  right,
  children,
}: {
  title: string;
  subtitle?: string;
  right?: ReactNode;
  children?: ReactNode;
}) {
  const insets = useSafeAreaInsets();
  return (
    <LinearGradient
      colors={[colors.navy900, colors.navy700]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[s.header, { paddingTop: insets.top + spacing.lg }]}
    >
      <View style={s.headerRow}>
        <View style={{ flex: 1, gap: 2 }}>
          {subtitle ? <Text style={s.headerSubtitle}>{subtitle}</Text> : null}
          <Text style={s.headerTitle}>{title}</Text>
        </View>
        {right}
      </View>
      {children}
    </LinearGradient>
  );
}

// -------------------------------------------------------------- Route ---

export function RouteView({
  origin,
  destination,
  compact,
}: {
  origin: string;
  destination: string;
  compact?: boolean;
}) {
  return (
    <View style={s.route}>
      <View style={s.routeRail}>
        <View style={[s.routeDot, { backgroundColor: colors.accent }]} />
        <View style={s.routeLine} />
        <View style={[s.routeDot, { backgroundColor: colors.navy700 }]} />
      </View>
      <View style={{ flex: 1, gap: compact ? 10 : 14 }}>
        <View>
          {!compact && <Text style={s.routeLabel}>Погрузка · A</Text>}
          <Text style={s.routeAddress} numberOfLines={compact ? 1 : 3}>
            {origin}
          </Text>
        </View>
        <View>
          {!compact && <Text style={s.routeLabel}>Выгрузка · Б</Text>}
          <Text style={s.routeAddress} numberOfLines={compact ? 1 : 3}>
            {destination}
          </Text>
        </View>
      </View>
    </View>
  );
}

// --------------------------------------------------------- Dimensions ---

export function DimensionTiles({ dims, accent }: { dims: DimensionsDTO; accent?: boolean }) {
  const items = [
    { icon: 'arrow-expand-horizontal', label: 'Длина', value: `${formatNumber(dims.lengthM)} м` },
    { icon: 'arrow-expand-horizontal', label: 'Ширина', value: `${formatNumber(dims.widthM)} м` },
    { icon: 'arrow-expand-vertical', label: 'Высота', value: `${formatNumber(dims.heightM)} м` },
    { icon: 'weight', label: 'Масса', value: `${formatNumber(dims.weightT)} т` },
  ];
  return (
    <View style={s.tiles}>
      {items.map((i) => (
        <View key={i.label} style={[s.tile, accent && { backgroundColor: colors.accentSoft }]}>
          <Text style={s.tileLabel}>{i.label}</Text>
          <Text style={s.tileValue}>{i.value}</Text>
        </View>
      ))}
    </View>
  );
}

export function CargoTypeIcon({ cargo, size = 44 }: { cargo: Pick<CargoDTO, 'type'>; size?: number }) {
  return (
    <View style={[s.cargoIcon, { width: size, height: size, borderRadius: size * 0.3 }]}>
      <Icon name={cargoTypeInfo(cargo.type).icon} size={size * 0.55} color={colors.navy700} />
    </View>
  );
}

export function OrderStatusBadge({ status, isEscrowLocked }: { status: OrderStatus; isEscrowLocked: boolean }) {
  const info = orderStatusInfo(status, isEscrowLocked);
  return <Badge label={info.label} tone={info.tone} icon={info.icon} />;
}

// --------------------------------------------------------- Order card ---

export function OrderCard({
  order,
  onPress,
  footer,
}: {
  order: OrderListItemDTO;
  onPress?: () => void;
  footer?: ReactNode;
}) {
  const type = cargoTypeInfo(order.cargo.type);
  const { cargo } = order;
  return (
    <Card onPress={onPress}>
      <View style={s.cardTop}>
        <CargoTypeIcon cargo={cargo} />
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={s.cardTitle} numberOfLines={1}>
            {cargo.description || type.label}
          </Text>
          <Text style={s.cardMeta}>
            {type.label} · {formatRelative(order.createdAt)}
          </Text>
        </View>
        <Text style={s.price}>{formatPrice(order.price)}</Text>
      </View>
      <RouteView origin={order.origin} destination={order.destination} compact />
      <View style={s.specRow}>
        <Spec
          icon="ruler"
          text={`${formatNumber(cargo.lengthM)}×${formatNumber(cargo.widthM)}×${formatNumber(cargo.heightM)} м`}
        />
        <Spec icon="weight" text={`${formatNumber(cargo.weightT)} т`} />
      </View>
      <View style={s.cardBottom}>
        <OrderStatusBadge status={order.status} isEscrowLocked={order.isEscrowLocked} />
        {footer}
      </View>
    </Card>
  );
}

function Spec({ icon, text }: { icon: string; text: string }) {
  return (
    <View style={s.spec}>
      <Icon name={icon} size={15} color={colors.textSecondary} />
      <Text style={s.specText}>{text}</Text>
    </View>
  );
}

export function MyBidBadge({ status, price }: { status: Parameters<typeof bidStatusInfo>[0]; price: number }) {
  const info = bidStatusInfo(status);
  return (
    <Badge label={`Ваш отклик ${formatPrice(price)} · ${info.label.toLowerCase()}`} tone={info.tone} icon="handshake" />
  );
}

// ----------------------------------------------------------- Timeline ---

export function StatusTimeline({ status, isEscrowLocked }: { status: OrderStatus; isEscrowLocked: boolean }) {
  const current = timelineIndex({ status, isEscrowLocked });
  if (current < 0) return null;
  return (
    <View style={{ gap: 0 }}>
      {ORDER_TIMELINE.map((step, i) => {
        const done = i < current || status === 'Completed';
        const active = i === current && status !== 'Completed';
        const last = i === ORDER_TIMELINE.length - 1;
        return (
          <View key={step.key} style={s.tlRow}>
            <View style={s.tlRail}>
              <View
                style={[
                  s.tlDot,
                  done && { backgroundColor: colors.success, borderColor: colors.success },
                  active && { backgroundColor: colors.accent, borderColor: colors.accentSoft, borderWidth: 4 },
                ]}
              >
                {done ? <Icon name="check-circle" size={14} color={colors.white} /> : null}
              </View>
              {!last && <View style={[s.tlLine, done && { backgroundColor: colors.success }]} />}
            </View>
            <Text
              style={[
                s.tlText,
                done && { color: colors.text },
                active && { color: colors.accentDark, fontWeight: '800' },
              ]}
            >
              {step.label}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

// ------------------------------------------------------------- Photos ---

export function PhotoGrid({ photos, emptyText }: { photos: PhotoDTO[]; emptyText: string }) {
  const [opened, setOpened] = useState<string | null>(null);
  if (photos.length === 0) return <Text style={s.cardMeta}>{emptyText}</Text>;
  return (
    <View style={s.photos}>
      {photos.map((p) => (
        <Pressable key={p.id} onPress={() => setOpened(p.url)} accessibilityLabel="Открыть фото">
          <Image source={{ uri: p.url }} style={s.photo} />
        </Pressable>
      ))}
      <PhotoViewer url={opened} onClose={() => setOpened(null)} />
    </View>
  );
}

/** Полноэкранный просмотр фото (нажатие — закрыть). */
export function PhotoViewer({ url, onClose }: { url: string | null; onClose: () => void }) {
  return (
    <Modal visible={Boolean(url)} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={s.viewer} onPress={onClose}>
        {url ? <Image source={{ uri: url }} style={s.viewerImage} resizeMode="contain" /> : null}
      </Pressable>
    </Modal>
  );
}

// ------------------------------------------------------------- Modals ---

/** Диалог с текстовым полем — например, причина отмены заявки (UC-07). */
export function PromptModal({
  visible,
  title,
  placeholder,
  confirmText,
  onCancel,
  onConfirm,
}: {
  visible: boolean;
  title: string;
  placeholder: string;
  confirmText: string;
  onCancel: () => void;
  onConfirm: (text: string) => void;
}) {
  const [text, setText] = useState('');
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={s.modalBackdrop}>
        <View style={s.modalCard}>
          <Text style={font.h2}>{title}</Text>
          <TextField value={text} onChangeText={setText} placeholder={placeholder} multiline />
          <View style={{ flexDirection: 'row', gap: spacing.sm }}>
            <Button title="Назад" variant="secondary" onPress={onCancel} style={{ flex: 1 }} />
            <Button
              title={confirmText}
              variant="danger"
              onPress={() => {
                onConfirm(text);
                setText('');
              }}
              style={{ flex: 1 }}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}

export function StarInput({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <View style={{ flexDirection: 'row', gap: 6 }}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Pressable key={n} onPress={() => onChange(n)} hitSlop={6}>
          <Icon name="star" size={34} color={n <= value ? '#F5A524' : colors.border} />
        </Pressable>
      ))}
    </View>
  );
}

const s = StyleSheet.create({
  header: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
    gap: spacing.lg,
    borderBottomLeftRadius: radius.xl,
    borderBottomRightRadius: radius.xl,
  },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  headerSubtitle: { ...font.small, color: '#9FB0D6', fontWeight: '600' },
  headerTitle: { ...font.h1, color: colors.white },
  route: { flexDirection: 'row', gap: spacing.md },
  routeRail: { alignItems: 'center', paddingTop: 5, width: 12 },
  routeDot: { width: 11, height: 11, borderRadius: 6 },
  routeLine: { flex: 1, width: 2, backgroundColor: colors.border, marginVertical: 3, minHeight: 12 },
  routeLabel: { ...font.caption, color: colors.textMuted, marginBottom: 2 },
  routeAddress: { ...font.bodyBold, color: colors.text },
  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  tile: {
    flexGrow: 1,
    flexBasis: '22%',
    minWidth: 70,
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    alignItems: 'center',
    gap: 2,
  },
  tileLabel: { ...font.caption, color: colors.textMuted },
  tileValue: { ...font.h3, color: colors.text },
  cargoIcon: { backgroundColor: colors.infoSoft, alignItems: 'center', justifyContent: 'center' },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  cardTitle: { ...font.h3, color: colors.text },
  cardMeta: { ...font.small, color: colors.textSecondary },
  price: { ...font.h3, color: colors.navy800 },
  specRow: { flexDirection: 'row', gap: spacing.lg, flexWrap: 'wrap' },
  spec: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  specText: { ...font.small, color: colors.textSecondary, fontWeight: '600' },
  cardBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    flexWrap: 'wrap',
  },
  tlRow: { flexDirection: 'row', gap: spacing.md, minHeight: 38 },
  tlRail: { alignItems: 'center', width: 22 },
  tlDot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tlLine: { flex: 1, width: 2, backgroundColor: colors.border },
  tlText: { ...font.body, color: colors.textMuted, paddingTop: 1 },
  photos: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  photo: { width: 96, height: 96, borderRadius: radius.md, backgroundColor: colors.surfaceAlt },
  viewer: { flex: 1, backgroundColor: 'rgba(5,10,25,0.92)', alignItems: 'center', justifyContent: 'center' },
  viewerImage: { width: '92%', height: '80%' },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(5,10,25,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  modalCard: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.xl,
    gap: spacing.lg,
  },
});
