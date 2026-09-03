import type { UserDetailsDto, UserListItemDto, UserRole } from '../../../api/identity/model';

export type AppUserRole = UserRole;
export type AppUserListItem = UserListItemDto;
export type AppUserDetails = UserDetailsDto;
export type AppUserStatus = 'Active' | 'Blocked' | string;
