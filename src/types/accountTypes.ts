export interface Account {
  id?: number;
  name: string;
  email: string;
  uid: string;
  image?: string;
  default_profile_id?: number;
}

export interface DatabaseAccount {
  account_id: number;
  account_name: string;
  email: string;
  image: string | null;
  default_profile_id: number | null;
  uid: string;
  created_at: Date;
}

export interface CombinedUser {
  uid: string;
  email: string | null;
  emailVerified: boolean;
  displayName: string | null;
  photoURL: string | null;
  disabled: boolean;
  metadata: {
    creationTime: string;
    lastSignInTime: string;
    lastRefreshTime: string | null;
  };
  account_id: number;
  account_name: string;
  default_profile_id: number | null;
  database_image: string | null;
  database_created_at: Date;
}
