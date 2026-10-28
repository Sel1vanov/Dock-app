/** Поиск, фильтры, сортировка и постраничная загрузка списков. */
import { type ReactNode, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  type ListRenderItem,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { CARGO_TYPES, ORDER_SORT_OPTIONS } from '../../models/catalog';
import type { CargoType, OrderSort } from '../../models/dto';
import { colors, font, radius, spacing } from '../theme';
import { Chip, Icon } from './ui';

// --------------------------------------------------------------- Search ---

export function SearchBar({
  value,
  onChange,
  placeholder,
  dark,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  dark?: boolean;
}) {
  return (
    <View style={[s.search, dark && s.searchDark]}>
      <Icon name="magnify" size={20} color={dark ? '#9FB0D6' : colors.textMuted} />
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={dark ? '#9FB0D6' : colors.textMuted}
        style={[s.searchInput, dark && { color: colors.white }]}
        returnKeyType="search"
        autoCorrect={false}
        maxLength={100}
      />
      {value ? (
        <Pressable onPress={() => onChange('')} hitSlop={10} accessibilityLabel="Очистить поиск">
          <Icon name="close-circle" size={18} color={dark ? '#9FB0D6' : colors.textMuted} />
        </Pressable>
      ) : null}
    </View>
  );
}

// -------------------------------------------------- Фильтр и сортировка ---

/** Фильтр по типу груза и сортировка — параметры уходят на сервер. */
export function OrderFilterBar({
  cargoType,
  onCargoType,
  sort,
  onSort,
}: {
  cargoType: CargoType | null;
  onCargoType: (v: CargoType | null) => void;
  sort: OrderSort;
  onSort: (v: OrderSort) => void;
}) {
  const [sortOpen, setSortOpen] = useState(false);
  const current = ORDER_SORT_OPTIONS.find((o) => o.value === sort) ?? ORDER_SORT_OPTIONS[0];
  return (
    <>
      {/* Обёртка фиксирует высоту: горизонтальный ScrollView иначе растягивается по вертикали. */}
      <View style={s.filterWrap}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={s.filterRow}
          keyboardShouldPersistTaps="handled"
        >
          <Chip icon={current.icon} label={current.label} onPress={() => setSortOpen(true)} />
          <View style={s.divider} />
          <Chip label="Все грузы" selected={cargoType === null} onPress={() => onCargoType(null)} />
          {CARGO_TYPES.map((t) => (
            <Chip
              key={t.value}
              icon={t.icon}
              label={t.label}
              selected={cargoType === t.value}
              onPress={() => onCargoType(cargoType === t.value ? null : t.value)}
            />
          ))}
        </ScrollView>
      </View>
      <OptionsModal
        visible={sortOpen}
        title="Сортировка"
        options={ORDER_SORT_OPTIONS}
        value={sort}
        onSelect={(v) => {
          onSort(v);
          setSortOpen(false);
        }}
        onClose={() => setSortOpen(false)}
      />
    </>
  );
}

export function OptionsModal<T extends string>({
  visible,
  title,
  options,
  value,
  onSelect,
  onClose,
}: {
  visible: boolean;
  title: string;
  options: { value: T; label: string; icon?: string }[];
  value: T;
  onSelect: (v: T) => void;
  onClose: () => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={s.backdrop} onPress={onClose}>
        <View style={s.sheet}>
          <Text style={[font.h3, { marginBottom: spacing.sm }]}>{title}</Text>
          {options.map((o) => {
            const active = o.value === value;
            return (
              <Pressable key={o.value} style={[s.option, active && s.optionActive]} onPress={() => onSelect(o.value)}>
                {o.icon ? <Icon name={o.icon} size={20} color={active ? colors.accent : colors.navy600} /> : null}
                <Text style={[font.body, { flex: 1 }, active && { fontWeight: '700' }]}>{o.label}</Text>
                {active ? <Icon name="check" size={20} color={colors.accent} /> : null}
              </Pressable>
            );
          })}
        </View>
      </Pressable>
    </Modal>
  );
}

// ----------------------------------------------------- Список страницами ---

/**
 * Список с подгрузкой при прокрутке (onEndReached → следующая страница с сервера),
 * pull-to-refresh, состояниями «пусто», «загрузка ещё» и «показаны все».
 */
export function PagedList<T extends { id: string }>({
  items,
  total,
  renderItem,
  header,
  empty,
  isRefreshing,
  isLoadingMore,
  hasMore,
  onRefresh,
  onEndReached,
}: {
  items: T[];
  total: number;
  renderItem: ListRenderItem<T>;
  header?: ReactNode;
  empty: ReactNode;
  isRefreshing: boolean;
  isLoadingMore: boolean;
  hasMore: boolean;
  onRefresh: () => void;
  onEndReached: () => void;
}) {
  return (
    <FlatList
      data={items}
      keyExtractor={(item) => item.id}
      renderItem={renderItem}
      style={{ flex: 1, backgroundColor: colors.bg }}
      contentContainerStyle={s.listContent}
      ItemSeparatorComponent={() => <View style={{ height: spacing.md }} />}
      ListHeaderComponent={
        header ? <View style={{ gap: spacing.md, marginBottom: spacing.md }}>{header}</View> : undefined
      }
      ListEmptyComponent={<View>{empty}</View>}
      ListFooterComponent={
        isLoadingMore ? (
          <ActivityIndicator style={{ marginTop: spacing.lg }} color={colors.accent} />
        ) : items.length > 0 && !hasMore ? (
          <Text style={s.footer}>Показаны все: {total}</Text>
        ) : undefined
      }
      onEndReached={hasMore ? onEndReached : undefined}
      onEndReachedThreshold={0.4}
      keyboardShouldPersistTaps="handled"
      refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} tintColor={colors.accent} />}
    />
  );
}

const s = StyleSheet.create({
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: 44,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  searchDark: { backgroundColor: 'rgba(255,255,255,0.10)', borderColor: 'transparent' },
  searchInput: {
    flex: 1,
    minWidth: 0,
    ...font.body,
    color: colors.text,
    paddingVertical: 10,
    outlineStyle: 'none',
  } as never,
  filterWrap: { flexGrow: 0, flexShrink: 0 },
  filterRow: { gap: spacing.sm, paddingHorizontal: spacing.lg, paddingVertical: spacing.md, alignItems: 'center' },
  divider: { width: 1, height: 24, backgroundColor: colors.border },
  backdrop: { flex: 1, backgroundColor: 'rgba(5,10,25,0.5)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    padding: spacing.xl,
    paddingBottom: spacing.xxl + spacing.lg,
    gap: 4,
    width: '100%',
    maxWidth: 560,
    alignSelf: 'center',
  },
  option: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md, borderRadius: radius.md },
  optionActive: { backgroundColor: colors.accentSoft },
  listContent: { padding: spacing.lg, paddingTop: 0, paddingBottom: 40, flexGrow: 1 },
  footer: { ...font.small, color: colors.textMuted, textAlign: 'center', marginTop: spacing.lg },
});
