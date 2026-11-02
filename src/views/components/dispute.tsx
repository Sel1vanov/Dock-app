/** Спор по заказу (UC-20, UC-21): карточка спора, кнопка «Открыть спор», решение администратора. */
import { StyleSheet, Text, View } from 'react-native';

import { ROLE_LABELS, TRIP_STAGE_LABELS, disputeStatusInfo } from '../../models/catalog';
import type { DisputeDTO } from '../../models/dto';
import { colors, family, font, formatPrice, formatRelative, radius, spacing } from '../theme';
import { PromptModal } from './order';
import { Badge, Button, Card, Icon } from './ui';

/** Действия со спором из ViewModel карточки заказа (useOrderBase().dispute). */
export interface DisputeActions {
  canOpen: boolean;
  formOpen: boolean;
  showForm: () => void;
  hideForm: () => void;
  open: (reason: string) => void;
  canResolve: boolean;
  resolveFor: 'client' | 'driver' | null;
  askResolve: (side: 'client' | 'driver') => void;
  cancelResolve: () => void;
  resolve: (comment: string) => void;
}

/** Карточка спора: кто, когда и почему открыл, на каком этапе; решение администратора. */
export function DisputeCard({
  dispute,
  price,
  actions,
}: {
  dispute: DisputeDTO;
  price: number;
  actions: DisputeActions;
}) {
  const status = disputeStatusInfo(dispute.status);
  const isOpen = dispute.status === 'Open';
  return (
    <Card style={isOpen ? styles.openCard : undefined}>
      <View style={styles.header}>
        <Icon name="scale-balance" size={22} color={isOpen ? colors.danger : colors.textSecondary} />
        <Text style={[font.h3, { flex: 1 }]}>Спор по заказу</Text>
        <Badge label={status.label} tone={status.tone} icon={status.icon} />
      </View>
      <Text style={styles.reason}>«{dispute.reason}»</Text>
      <Text style={styles.meta}>
        {ROLE_LABELS[dispute.openedBy.role]} {dispute.openedBy.fullName} · {formatRelative(dispute.createdAt)} · этап:{' '}
        {TRIP_STAGE_LABELS[dispute.orderStatusAtOpen]}
      </Text>

      {isOpen && !actions.canResolve ? (
        <Text style={styles.hint}>
          Рейс приостановлен, {formatPrice(price)} остаются замороженными. Администратор изучит фото груза, свяжется со
          сторонами и примет решение.
        </Text>
      ) : null}

      {dispute.resolutionComment ? (
        <View style={styles.resolution}>
          <Text style={styles.resolutionTitle}>
            Решение администратора
            {dispute.resolvedAt ? ` · ${formatRelative(dispute.resolvedAt)}` : ''}
          </Text>
          <Text style={font.body}>{dispute.resolutionComment}</Text>
        </View>
      ) : null}

      {actions.canResolve ? (
        <View style={{ gap: spacing.sm }}>
          <Text style={styles.hint}>
            Изучите фото и свяжитесь со сторонами. Решение окончательное: деньги будут возвращены заказчику или
            переведены водителю.
          </Text>
          <Button
            title={`Вернуть ${formatPrice(price)} заказчику`}
            icon="cash-refund"
            variant="secondary"
            onPress={() => actions.askResolve('client')}
          />
          <Button
            title={`Выплатить ${formatPrice(price)} водителю`}
            icon="cash-check"
            variant="secondary"
            onPress={() => actions.askResolve('driver')}
          />
        </View>
      ) : null}
    </Card>
  );
}

/** Кнопка «Открыть спор» и окна ввода причины спора и комментария к решению. */
export function DisputeControls({ actions }: { actions: DisputeActions }) {
  return (
    <>
      {actions.canOpen ? (
        <Button title="Открыть спор" variant="ghost" icon="scale-balance" onPress={actions.showForm} />
      ) : null}
      <PromptModal
        visible={actions.formOpen}
        title="Открыть спор?"
        message="Рейс будет приостановлен, деньги останутся замороженными до решения администратора. Опишите проблему: администратор увидит её вместе с фото груза."
        placeholder="Что случилось?"
        confirmText="Открыть спор"
        onCancel={actions.hideForm}
        onConfirm={actions.open}
      />
      <PromptModal
        visible={actions.resolveFor !== null}
        title={actions.resolveFor === 'client' ? 'Решить в пользу заказчика?' : 'Решить в пользу водителя?'}
        message={
          actions.resolveFor === 'client'
            ? 'Заказ будет отменён, замороженные деньги вернутся заказчику. Стороны получат уведомление с вашим комментарием.'
            : 'Заказ будет завершён, замороженные деньги перейдут водителю. Стороны получат уведомление с вашим комментарием.'
        }
        placeholder="Комментарий к решению"
        confirmText="Принять решение"
        confirmVariant="primary"
        onCancel={actions.cancelResolve}
        onConfirm={actions.resolve}
      />
    </>
  );
}

const styles = StyleSheet.create({
  openCard: { borderWidth: 2, borderColor: colors.danger },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap' },
  reason: { fontFamily: family.medium, fontSize: 16, lineHeight: 22, color: colors.text },
  meta: { ...font.small, color: colors.textSecondary },
  hint: { ...font.small, color: colors.textSecondary },
  resolution: { backgroundColor: colors.surfaceAlt, borderRadius: radius.md, padding: spacing.md, gap: 4 },
  resolutionTitle: { ...font.small, fontFamily: family.bold, color: colors.text },
});
