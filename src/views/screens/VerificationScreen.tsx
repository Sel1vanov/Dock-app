import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { useVerificationViewModel } from '../../viewmodels/ProfileViewModels';
import { Banner, Button, Card, Icon, LoadingView, ScreenScroll } from '../components/ui';
import { colors, font, radius, spacing } from '../theme';

/** UC-01 «Пройти верификацию документов». */
export function VerificationScreen() {
  const vm = useVerificationViewModel();
  if (vm.isLoading) return <LoadingView />;

  return (
    <ScreenScroll>
      <Banner
        tone={vm.status === 'pending' ? 'info' : 'warning'}
        icon={vm.status === 'pending' ? 'clock-outline' : 'shield-alert'}
        title={vm.status === 'pending' ? 'Документы на проверке' : 'Проверка документов'}
        text="Фото документов видит только администратор платформы. После проверки откроется доступ к откликам на заявки."
      />

      {vm.docs.map((doc) => (
        <Card key={doc.key} onPress={vm.uploadingKey ? undefined : () => vm.uploadDoc(doc.key)}>
          <View style={styles.row}>
            <View style={[styles.icon, doc.isUploaded && { backgroundColor: colors.successSoft }]}>
              <Icon
                name={doc.isUploaded ? 'check-circle' : doc.icon}
                size={26}
                color={doc.isUploaded ? colors.success : colors.navy700}
              />
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={font.h3}>{doc.label}</Text>
              <Text style={styles.meta}>{doc.isUploaded ? 'Загружено · нажмите, чтобы заменить' : doc.hint}</Text>
            </View>
            {vm.uploadingKey === doc.key ? (
              <ActivityIndicator color={colors.accent} />
            ) : (
              <Pressable onPress={() => vm.uploadDoc(doc.key)} style={styles.add}>
                <Icon name={doc.isUploaded ? 'pencil' : 'camera'} size={20} color={colors.accent} />
              </Pressable>
            )}
          </View>
        </Card>
      ))}

      {vm.error ? <Banner tone="danger" icon="alert-circle" title="Ошибка" text={vm.error} /> : null}

      <Button
        title={vm.status === 'pending' ? 'Отправить повторно' : 'Отправить на проверку'}
        icon="shield-check"
        onPress={vm.submit}
        disabled={!vm.allUploaded}
        loading={vm.isSubmitting}
      />
    </ScreenScroll>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  icon: {
    width: 52,
    height: 52,
    borderRadius: radius.md,
    backgroundColor: colors.infoSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  meta: { ...font.small, color: colors.textSecondary },
  add: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
