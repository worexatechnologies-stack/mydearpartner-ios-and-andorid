import { navigate, consumePendingDeepLink, navigationRef } from '../src/navigation/navigationRef';
jest.mock('@react-navigation/native', () => ({ createNavigationContainerRef: () => ({ isReady: jest.fn(() => true), getRootState: jest.fn(), navigate: jest.fn() }) }));
test('notification link waits for an authenticated route to exist', () => {
  (navigationRef.getRootState as jest.Mock).mockReturnValue({ routeNames: ['Auth'] });
  navigate('Chat', { chatId: 'chat', otherProfileId: 'other' });
  consumePendingDeepLink();
  expect(navigationRef.navigate).not.toHaveBeenCalled();
  (navigationRef.getRootState as jest.Mock).mockReturnValue({ routeNames: ['Main', 'Chat'] });
  consumePendingDeepLink();
  expect(navigationRef.navigate).toHaveBeenCalledWith('Chat', { chatId: 'chat', otherProfileId: 'other' });
  consumePendingDeepLink();
  expect(navigationRef.navigate).toHaveBeenCalledTimes(1);
});
