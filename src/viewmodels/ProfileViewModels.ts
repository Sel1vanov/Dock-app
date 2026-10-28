import { router } from 'expo-router';
import { useState } from 'react';

import { ApiError, errorMessage } from '../core/errors';
import { chooseImageSource, confirmAction, notify, pickImage } from '../core/platform';
import { showToast } from '../core/toast';
import { DEFAULT_CARGO_BY_VEHICLE } from '../models/catalog';
import type { CargoType, DocumentType, VehicleType } from '../models/dto';
import {
  type FieldErrors,
  type ProfileForm,
  type VehicleForm,
  profileSchema,
  validate,
  vehicleSchema,
} from '../models/schemas';
import { ProfileService, VERIFICATION_DOCS } from '../services/ProfileService';
import { VehicleService } from '../services/VehicleService';
import { useAuth, useCurrentUser } from './AuthViewModel';
import { useAction, useQuery } from './useAsync';

export function useProfileViewModel() {
  const { signOut, refreshUser } = useAuth();
  const user = useCurrentUser();
  const isDriver = user.role === 'Driver';
  const vehicles = useQuery(isDriver ? () => VehicleService.getMyVehicles() : null, [user.id, isDriver]);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const removeVehicle = async (id: string) => {
    if (!(await confirmAction('Удалить ТС?', 'Лента заказов перестанет учитывать этот транспорт', 'Удалить'))) return;
    try {
      await VehicleService.removeVehicle(id);
      showToast('Транспорт удалён');
      await vehicles.reload();
    } catch (e) {
      notify('Не получилось', errorMessage(e));
    }
  };

  return {
    user,
    isDriver,
    isAdmin: user.role === 'Admin',
    rating: user.rating,
    vehicles: vehicles.data ?? [],
    vehiclesError: vehicles.error,
    isLoading: vehicles.isLoading,
    isRefreshing: isRefreshing || vehicles.isRefreshing,
    refresh: async () => {
      setIsRefreshing(true);
      await Promise.all([refreshUser(), vehicles.refresh()]);
      setIsRefreshing(false);
    },
    removeVehicle,
    addVehicle: () => router.push('/vehicle/new'),
    editVehicle: (id: string) => router.push(`/vehicle/${id}`),
    editProfile: () => router.push('/profile-edit'),
    openVerification: () => router.push('/verification'),
    /** Выход: токен удаляется с устройства, открывается экран входа. */
    signOut: async () => {
      if (await confirmAction('Выйти из аккаунта?', 'Для входа понадобятся email и пароль', 'Выйти')) await signOut();
    },
  };
}

/** Редактирование имени и телефона. */
export function useProfileEditViewModel() {
  const { setCurrentUser } = useAuth();
  const user = useCurrentUser();
  const [values, setValues] = useState<ProfileForm>({ fullName: user.fullName, phone: user.phone });
  const [errors, setErrors] = useState<FieldErrors<ProfileForm>>({});
  const action = useAction(async (data: { fullName: string; phone: string }) => {
    try {
      setCurrentUser(await ProfileService.updateProfile(data));
    } catch (e) {
      if (e instanceof ApiError) setErrors(e.fieldErrors);
      throw e;
    }
    showToast('Профиль сохранён');
    router.back();
  });

  return {
    values,
    errors,
    setField: (key: keyof ProfileForm, value: string) => {
      setValues((v) => ({ ...v, [key]: value }));
      setErrors((e) => ({ ...e, [key]: undefined }));
    },
    submit: async () => {
      const checked = validate(profileSchema, values);
      if (!checked.ok) {
        setErrors(checked.errors);
        return;
      }
      await action.run(checked.data);
    },
    isSubmitting: action.isRunning,
    submitError: action.error,
  };
}

const EMPTY_VEHICLE: VehicleForm = {
  type: 'Trawl',
  model: '',
  cargoTypes: DEFAULT_CARGO_BY_VEHICLE.Trawl,
  lengthM: '',
  widthM: '',
  heightM: '',
  weightT: '',
};

const num = (n: number) => String(Number(n.toFixed(3))).replace('.', ',');

/** Добавление (vehicleId не задан) и изменение ТС с типами перевозимых грузов (N:M). */
export function useVehicleFormViewModel(vehicleId?: string) {
  const [values, setValues] = useState<VehicleForm>(EMPTY_VEHICLE);
  const [errors, setErrors] = useState<FieldErrors<VehicleForm>>({});
  const existing = useQuery(vehicleId ? () => VehicleService.getVehicle(vehicleId) : null, [vehicleId]);

  // Форма изменения заполняется данными ТС один раз, когда они загрузились.
  const [filledFrom, setFilledFrom] = useState<string | null>(null);
  const v = existing.data;
  if (v && filledFrom !== v.id) {
    setFilledFrom(v.id);
    setValues({
      type: v.type,
      model: v.model ?? '',
      cargoTypes: v.cargoTypes.map((c) => c.code),
      lengthM: num(v.lengthM),
      widthM: num(v.widthM),
      heightM: num(v.heightM),
      weightT: num(v.weightT),
    });
  }

  const action = useAction(async (data: Parameters<typeof VehicleService.addVehicle>[0]) => {
    try {
      if (vehicleId) await VehicleService.updateVehicle(vehicleId, data);
      else await VehicleService.addVehicle(data);
    } catch (e) {
      if (e instanceof ApiError) {
        const map: Record<string, keyof VehicleForm> = { maxWeightKg: 'weightT', cargoTypeCodes: 'cargoTypes' };
        setErrors(Object.fromEntries(Object.entries(e.fieldErrors).map(([k, v]) => [map[k] ?? k, v])));
      }
      throw e;
    }
    showToast(vehicleId ? 'Изменения сохранены' : 'Транспорт добавлен');
    router.back();
  });

  const setField = <K extends keyof VehicleForm>(key: K, value: VehicleForm[K]) => {
    setValues((v) => ({ ...v, [key]: value }));
    setErrors((e) => ({ ...e, [key]: undefined }));
  };

  return {
    isEdit: Boolean(vehicleId),
    isLoading: existing.isLoading,
    loadError: existing.error,
    values,
    errors,
    setField,
    /** При смене типа ТС подставляем типичные для него грузы (пока пользователь их не менял). */
    setType: (type: VehicleType) =>
      setValues((v) => ({
        ...v,
        type,
        cargoTypes: vehicleId ? v.cargoTypes : DEFAULT_CARGO_BY_VEHICLE[type],
      })),
    toggleCargoType: (code: CargoType) => {
      setValues((v) => ({
        ...v,
        cargoTypes: v.cargoTypes.includes(code) ? v.cargoTypes.filter((c) => c !== code) : [...v.cargoTypes, code],
      }));
      setErrors((e) => ({ ...e, cargoTypes: undefined }));
    },
    submit: async () => {
      const checked = validate(vehicleSchema, values);
      if (!checked.ok) {
        setErrors(checked.errors);
        return;
      }
      await action.run(checked.data);
    },
    isSubmitting: action.isRunning,
    submitError: action.error,
  };
}

/** UC-01: загрузка документов водителя и отправка на проверку. */
export function useVerificationViewModel() {
  const { setCurrentUser } = useAuth();
  const user = useCurrentUser();
  const documents = useQuery(() => ProfileService.getDocuments(), [user.id]);
  const [uploadingKey, setUploadingKey] = useState<DocumentType | null>(null);
  const uploadedKeys = (documents.data ?? []).map((d) => d.docType);
  const canEditDocs = user.verification === 'none' || user.verification === 'rejected';

  const upload = useAction(async (key: DocumentType) => {
    const source = await chooseImageSource();
    if (!source) return;
    const base64 = await pickImage(source);
    if (!base64) return;
    setUploadingKey(key);
    await ProfileService.uploadDoc(key, base64);
    showToast('Документ загружен');
    await documents.reload();
  });
  const submit = useAction(async () => {
    setCurrentUser(await ProfileService.submitForVerification(uploadedKeys));
  });

  return {
    status: user.verification,
    canEditDocs,
    docs: VERIFICATION_DOCS.map((d) => ({
      ...d,
      document: documents.data?.find((doc) => doc.docType === d.key) ?? null,
    })),
    isLoading: documents.isLoading,
    uploadingKey: upload.isRunning ? uploadingKey : null,
    uploadDoc: async (key: DocumentType) => {
      if (!canEditDocs) return;
      await upload.run(key);
      setUploadingKey(null);
    },
    allUploaded: VERIFICATION_DOCS.every((d) => uploadedKeys.includes(d.key)),
    submit: async () => {
      if (await submit.run()) {
        showToast('Документы отправлены на проверку');
        router.back();
      }
    },
    isSubmitting: submit.isRunning,
    error: upload.error ?? submit.error ?? documents.error,
  };
}
