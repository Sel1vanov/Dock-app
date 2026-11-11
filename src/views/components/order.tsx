/** Компоненты предметной области: шапка, маршрут, габариты, карточка заказа, прогресс рейса, фото, связь. */
import type { ReactNode } from 'react';
import { Image, KeyboardAvoidingView, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useState } from 'react';

import { contactLinks, openLink } from '../../core/contacts';
import { bidStatusInfo, cargoTypeInfo, orderStatusInfo } from '../../models/catalog';
import { ORDER_TIMELINE, timelineIndex } from '../../models/domain';
import type { CargoDTO, DimensionsDTO, OrderListItemDTO, OrderStatus, PhotoDTO, ReviewDTO } from '../../models/dto';
import { cargoTints, colors, family, font, formatNumber, formatPrice, formatRelative, radius, spacing } from '../theme';
import { NotificationBell } from './NotificationBell';
import { Badge, Button, Card, Icon, TextField } from './ui';

// ------------------------------------------------------------- Header ---

/** Шапка главных экранов: знак Dock, крупный заголовок, колокольчик уведомлений. */
export function ScreenHeader({
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
    <View style={[s.header, { paddingTop: insets.top + spacing.md }]}>
      <View style={s.headerRow}>
        <BrandMark />
        <View style={{ flex: 1 }} />
        {right}
        <NotificationBell />
      </View>
      <View style={{ gap: 4 }}>
        <Text style={s.headerTitle}>{title}</Text>
        {subtitle ? <Text style={s.headerSubtitle}>{subtitle}</Text> : null}
      </View>
      {children}
    </View>
  );
}

/** Знак Dock: оранжевый квадрат с «платформой» и слово dock. */
export function BrandMark({ size = 28 }: { size?: number }) {
  return (
    <View style={s.brand} accessibilityRole="header" accessibilityLabel="Dock">
      <View style={[s.brandSquare, { width: size, height: size, borderRadius: size * 0.32 }]}>
        <View style={{ width: size * 0.43, height: size * 0.29, borderRadius: 2, backgroundColor: colors.text }} />
      </View>
      <Text style={[s.brandText, { fontSize: size * 0.72 }]}>dock</Text>
    </View>
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

export function CargoTypeIcon({ cargo, size = 52 }: { cargo: Pick<CargoDTO, 'type'>; size?: number }) {
  const tint = cargoTints[cargo.type] ?? cargoTints.Other;
  return (
    <View style={[s.cargoIcon, { width: size, height: size, borderRadius: size * 0.31, backgroundColor: tint.bg }]}>
      <Icon name={cargoTypeInfo(cargo.type).icon} size={size * 0.55} color={tint.fg} />
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
          <Text style={s.cardMeta} numberOfLines={1}>
            {type.label} · {formatNumber(cargo.weightT)} т · {formatNumber(cargo.lengthM)}×{formatNumber(cargo.widthM)}×
            {formatNumber(cargo.heightM)} м
          </Text>
        </View>
      </View>
      <View style={s.routeBox}>
        <RouteView origin={order.origin} destination={order.destination} compact />
      </View>
      <View style={s.cardBottom}>
        <View style={{ flex: 1 }}>
          <Text style={s.price}>{formatPrice(order.price)}</Text>
          <Text style={s.cardMeta}>{formatRelative(order.createdAt)}</Text>
        </View>
        <OrderStatusBadge status={order.status} isEscrowLocked={order.isEscrowLocked} />
      </View>
      {footer ? <View style={s.cardFooter}>{footer}</View> : null}
    </Card>
  );
}

export function MyBidBadge({
  status,
  price,
  counterPrice,
}: {
  status: Parameters<typeof bidStatusInfo>[0];
  price: number;
  counterPrice?: number | null;
}) {
  if (status === 'Pending' && counterPrice) {
    return <Badge label={`Заказчик предлагает ${formatPrice(counterPrice)}`} tone="warning" icon="swap-horizontal" />;
  }
  const info = bidStatusInfo(status);
  return (
    <Badge label={`Ваш отклик ${formatPrice(price)} · ${info.label.toLowerCase()}`} tone={info.tone} icon="handshake" />
  );
}

// ------------------------------------------------------------- Review ---

/** Отзыв контрагента: оценка звёздами, комментарий, автор и дата. */
export function ReviewCard({ review, roleLabel }: { review: ReviewDTO; roleLabel: string }) {
  return (
    <View style={s.review}>
      <View style={s.reviewStars} accessibilityLabel={`Оценка ${review.rating} из 5`}>
        {[1, 2, 3, 4, 5].map((n) => (
          <Icon key={n} name={n <= review.rating ? 'star' : 'star-outline'} size={18} color={colors.accentDark} />
        ))}
      </View>
      {review.comment ? <Text style={s.reviewText}>«{review.comment}»</Text> : null}
      <Text style={s.reviewMeta}>
        {review.authorName}, {roleLabel.toLowerCase()} · {formatRelative(review.createdAt)}
      </Text>
    </View>
  );
}

// ------------------------------------------------------------ Contacts ---

/** Связь с контрагентом: звонок, WhatsApp, Telegram (телефон виден только по назначенному заказу). */
export function ContactButtons({ phone }: { phone: string }) {
  const links = contactLinks(phone);
  return (
    <View style={s.contacts}>
      <Button title="Позвонить" icon="phone" compact onPress={() => openLink(links.call)} style={{ flex: 1 }} />
      <Pressable
        onPress={() => openLink(links.whatsapp)}
        accessibilityRole="button"
        accessibilityLabel="Написать в WhatsApp"
        style={({ pressed }) => [s.contactIcon, pressed && { opacity: 0.8 }]}
      >
        <Icon name="whatsapp" size={22} color={colors.text} />
      </Pressable>
      <Pressable
        onPress={() => openLink(links.telegram)}
        accessibilityRole="button"
        accessibilityLabel="Написать в Telegram"
        style={({ pressed }) => [s.contactIcon, pressed && { opacity: 0.8 }]}
      >
        <Icon name="send" size={20} color={colors.text} />
      </Pressable>
    </View>
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
                  done && { backgroundColor: colors.text, borderColor: colors.text },
                  active && { backgroundColor: colors.accent, borderColor: colors.accentSoft, borderWidth: 4 },
                ]}
              >
                {done ? <Icon name="check" size={14} color={colors.white} /> : null}
              </View>
              {!last && <View style={[s.tlLine, done && { backgroundColor: colors.text }]} />}
            </View>
            <Text
              style={[
                s.tlText,
                done && { color: colors.text },
                active && { color: colors.accentDark, fontFamily: family.bold },
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

/** Диалог с текстовым полем — причина отмены (UC-07), встречная цена, причина спора и решение по нему. */
export function PromptModal({
  visible,
  title,
  message,
  placeholder,
  confirmText,
  onCancel,
  onConfirm,
  numeric,
  confirmVariant = 'danger',
}: {
  visible: boolean;
  title: string;
  message?: string;
  placeholder: string;
  confirmText: string;
  onCancel: () => void;
  onConfirm: (text: string) => void;
  /** Поле для суммы в рублях. */
  numeric?: boolean;
  confirmVariant?: 'danger' | 'primary';
}) {
  const [text, setText] = useState('');
  // Поле очищается при закрытии окна: если ввод не прошёл проверку, текст остаётся для исправления
  const [wasVisible, setWasVisible] = useState(visible);
  if (visible !== wasVisible) {
    setWasVisible(visible);
    if (!visible) setText('');
  }
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      {/* Окно занимает весь экран, поэтому отступ на высоту клавиатуры поднимает карточку над ней. */}
      <KeyboardAvoidingView behavior="padding" style={s.modalBackdrop}>
        <View style={s.modalCard}>
          <Text style={font.h2}>{title}</Text>
          {/* На небольшом экране при открытой клавиатуре текст и поле прокручиваются, кнопки остаются на виду. */}
          <ScrollView
            style={s.modalBody}
            contentContainerStyle={{ gap: spacing.lg }}
            keyboardShouldPersistTaps="handled"
          >
            {message ? <Text style={s.cardMeta}>{message}</Text> : null}
            <TextField
              value={text}
              onChangeText={setText}
              placeholder={placeholder}
              multiline={!numeric}
              keyboardType={numeric ? 'number-pad' : 'default'}
              suffix={numeric ? '₽' : undefined}
              accessibilityLabel={title}
            />
          </ScrollView>
          <View style={{ flexDirection: 'row', gap: spacing.sm }}>
            <Button title="Назад" variant="secondary" onPress={onCancel} style={{ flex: 1 }} />
            <Button
              title={confirmText}
              variant={confirmVariant}
              onPress={() => {
                onConfirm(text);
              }}
              style={{ flex: 1 }}
            />
          </View>
        </View>
      </KeyboardAvoidingView>
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
    paddingBottom: spacing.sm,
    gap: spacing.lg,
    backgroundColor: colors.bg,
  },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  headerSubtitle: { ...font.body, color: colors.textSecondary },
  headerTitle: { ...font.h1, color: colors.text },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  brandSquare: { backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
  brandText: { fontFamily: family.extrabold, color: colors.text, letterSpacing: -0.6 },
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
  cargoIcon: { alignItems: 'center', justifyContent: 'center' },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  cardTitle: { ...font.h3, color: colors.text },
  cardMeta: { ...font.small, color: colors.textSecondary },
  routeBox: { backgroundColor: '#F7F7F5', borderRadius: radius.md, padding: spacing.md },
  price: { fontFamily: family.bold, fontSize: 22, letterSpacing: -0.5, color: colors.text },
  cardBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    flexWrap: 'wrap',
  },
  cardFooter: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  contacts: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center' },
  review: { backgroundColor: colors.accentSoft, borderRadius: radius.lg, padding: spacing.lg, gap: spacing.sm },
  reviewStars: { flexDirection: 'row', gap: 2 },
  reviewText: { fontFamily: family.medium, fontSize: 16, lineHeight: 22, color: colors.text },
  reviewMeta: { ...font.small, color: '#8A3500' },
  contactIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
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
  viewer: { flex: 1, backgroundColor: 'rgba(17,17,17,0.92)', alignItems: 'center', justifyContent: 'center' },
  viewerImage: { width: '92%', height: '80%' },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(17,17,17,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  modalCard: {
    width: '100%',
    maxWidth: 420,
    maxHeight: '100%',
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.xl,
    gap: spacing.lg,
  },
  modalBody: { flexGrow: 0, flexShrink: 1 },
});
