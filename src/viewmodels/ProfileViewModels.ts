import { router } from 'expo-router';
import { useState } from 'react';

import { errorMessage } from '../core/errors';
import { chooseImageSource, confirmAction, notify, pickImage } from '../core/platform';
import { type FieldErrors, type VehicleForm, validate, vehicleSchema } from '../models/schemas';
import type { VehicleType } from '../models/dto';
import { ProfileService, VERIFICATION_DOCS, type VerificationDocKey } from '../services/ProfileService';
import { VehicleService } from '../services/VehicleService';
import { useAuth, useCurrentUser } from './AuthViewModel';
import { useAction, useQuery } from './useAsync';

export function useProfileViewModel() {
  const { signOut } = useAuth();
  const user = useCurrentUser();
  const isDriver = user.role === 'Driver';
  const rating = useQuery(() => ProfileService.getRating(user.id), [user.id]);
  const vehicles = useQuery(isDriver ? () => VehicleService.getMyVehicles(user.id) : null, [user.id, isDriver]);
  const removeVehicle = async (id: string) => {
    if (!(await confirmAction('Удалить ТС?', 'Лента заказов перестанет учитывать этот транспорт', 'Удалить'))) return;
    try {
      await VehicleService.removeVehicle(id);
      await vehicles.reload();
    } catch (e) {
      notify('Не получилось', errorMessage(e));
    }
  };

  return {
    user,
    isDriver,
    rating: rating.data ?? null,
    vehicles: vehicles.data ?? [],
    isLoading: rating.isLoading || vehicles.isLoading,
    isRefreshing: rating.isRefreshing || vehicles.isRefreshing,
    refresh: async () => {
      await Promise.all([rating.refresh(), vehicles.refresh()]);
    },
    removeVehicle,
    addVehicle: () => router.push('/vehicle/new'),
    openVerification: () => router.push('/verification'),
    signOut: async () => {
      if (await confirmAction('Выйти из аккаунта?', '', 'Выйти')) await signOut();
    },
  };
}

const EMPTY_VEHICLE: VehicleForm = { type: 'Trawl', model: '', lengthM: '', widthM: '', heightM: '', weightT: '' };

export function useVehicleFormViewModel() {
  const user = useCurrentUser();
  const [values, setValues] = useState<VehicleForm>(EMPTY_VEHICLE);
  const [errors, setErrors] = useState<FieldErrors<VehicleForm>>({});
  const action = useAction(VehicleService.addVehicle);

  const setField = <K extends keyof VehicleForm>(key: K, value: VehicleForm[K]) => {
    setValues((v) => ({ ...v, [key]: value }));
    setErrors((e) => ({ ...e, [key]: undefined }));
  };

  const submit = async () => {
    const checked = validate(vehicleSchema, values);
    if (!checked.ok) {
      setErrors(checked.errors);
      return;
    }
    if (await action.run(user.id, checked.data)) router.back();
  };

  return {
    values,
    errors,
    setField,
    setType: (type: VehicleType) => setField('type', type),
    submit,
    isSubmitting: action.isRunning,
    submitError: action.error,
  };
}

/** UC-01: загрузка документов водителя и отправка на проверку. */
export function useVerificationViewModel() {
  const { setCurrentUser } = useAuth();
  const user = useCurrentUser();
  const uploaded = useQuery(() => ProfileService.getUploadedDocs(user.id), [user.id]);
  const [uploadingKey, setUploadingKey] = useState<VerificationDocKey | null>(null);
  const upload = useAction(async (key: VerificationDocKey) => {
    const source = await chooseImageSource();
    if (!source) return;
    const base64 = await pickImage(source);
    if (!base64) return;
    setUploadingKey(key);
    await ProfileService.uploadDoc(user.id, key, base64);
    await uploaded.reload();
  });
  const submit = useAction(async () => {
    setCurrentUser(await ProfileService.submitForVerification(user.id));
  });

  const uploadedKeys = uploaded.data ?? [];
  return {
    status: user.verification,
    docs: VERIFICATION_DOCS.map((d) => ({ ...d, isUploaded: uploadedKeys.includes(d.key) })),
    isLoading: uploaded.isLoading,
    uploadingKey: upload.isRunning ? uploadingKey : null,
    uploadDoc: async (key: VerificationDocKey) => {
      await upload.run(key);
      setUploadingKey(null);
    },
    allUploaded: VERIFICATION_DOCS.every((d) => uploadedKeys.includes(d.key)),
    submit: async () => {
      if (await submit.run()) {
        notify('Документы отправлены', 'Администратор проверит их, после чего откроется доступ к откликам');
        router.back();
      }
    },
    isSubmitting: submit.isRunning,
    error: upload.error ?? submit.error ?? uploaded.error,
  };
}
