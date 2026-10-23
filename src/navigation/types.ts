import { NavigatorScreenParams } from '@react-navigation/native';

export type AuthStackParamList = {
  Welcome: undefined;
  Login: undefined;
  Signup: undefined;
  ForgotPassword: undefined;
};

export type MainTabParamList = {
  Discover: undefined;
  Search: { openFilters?: boolean; savedSearchId?: string } | undefined;
  Interests: undefined;
  Chats: undefined;
  MyProfile: undefined;
};

export type RootStackParamList = {
  Auth: NavigatorScreenParams<AuthStackParamList>;
  ProfileSetup: undefined;
  Main: NavigatorScreenParams<MainTabParamList>;
  ProfileDetail: { profileId: string };
  EditProfile: undefined;
  Chat: {
    chatId: string;
    otherProfileId: string;
    fallbackName?: string;
    fallbackPhoto?: string;
  };
  Membership: undefined;
  Compare: { profileId1?: string; profileId2?: string } | undefined;
  Visitors: undefined;
  Verification: undefined;
  Settings: undefined;
  Blocked: undefined;
  Notifications: undefined;
};

declare global {
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {}
  }
}
