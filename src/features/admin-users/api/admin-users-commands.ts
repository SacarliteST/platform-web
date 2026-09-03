import {
  blockUser,
  createUser,
  unblockUser,
  updateUserRoles,
} from '../../../api/identity/users/users';
import type {
  BlockUserRequest,
  CreateUserRequest,
  UserDetailsDto,
  UserRole,
} from '../../../api/identity/model';
import { AdminUsersApiError } from '../lib';

type IdentityResponse<TData, TSuccessStatus extends number> =
  | { data: TData; status: TSuccessStatus }
  | { data: ConstructorParameters<typeof AdminUsersApiError>[1]; status: number };

const ensureSuccess = <TData, TSuccessStatus extends number>(
  response: IdentityResponse<TData, TSuccessStatus>,
  successStatus: TSuccessStatus,
): TData => {
  if (response.status === successStatus) {
    return response.data as TData;
  }

  throw new AdminUsersApiError(
    response.status,
    response.data as ConstructorParameters<typeof AdminUsersApiError>[1],
  );
};

export const createAdminUser = async (data: CreateUserRequest): Promise<UserDetailsDto> => {
  const response = await createUser(data);
  return ensureSuccess(response, 201);
};

export const replaceAdminUserRoles = async (userId: string, roles: UserRole[]): Promise<void> => {
  const response = await updateUserRoles(userId, { roles });
  return ensureSuccess(response, 204);
};

export const blockAdminUser = async (
  userId: string,
  reason?: string | null,
): Promise<void> => {
  const payload: BlockUserRequest = { reason: reason?.trim() || null };
  const response = await blockUser(userId, payload);
  return ensureSuccess(response, 204);
};

export const unblockAdminUser = async (userId: string): Promise<void> => {
  const response = await unblockUser(userId);
  return ensureSuccess(response, 204);
};
