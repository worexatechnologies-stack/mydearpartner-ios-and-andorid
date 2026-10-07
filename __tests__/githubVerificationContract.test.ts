import { get, upload } from '../src/api/apiClient';
import { verificationService } from '../src/api/verificationService';
jest.mock('../src/api/apiClient', () => ({ get: jest.fn(), upload: jest.fn() }));
beforeEach(() => jest.resetAllMocks());
afterEach(() => jest.restoreAllMocks());
test('verification is derived from reviewed documents, never pending uploads', async () => {
  (get as jest.Mock).mockResolvedValue([
    { id: 'id', document_type: 'PAN', status: 'APPROVED' },
    { id: 'selfie', document_type: 'OTHER', custom_document_name: 'Verification selfie', status: 'PENDING' },
    { id: 'income', document_type: 'INCOME_CERTIFICATE', status: 'REJECTED' },
  ]);
  await expect(verificationService.getStatus()).resolves.toEqual({ idVerified: true, selfieVerified: false, incomeVerified: false });
  expect(get).toHaveBeenCalledWith('/member-auth/me/documents/');
});
test.each(['Government ID', 'Income Certificate'])('the screen upload type %s uses the existing document API', async type => {
  const append = jest.spyOn(FormData.prototype, 'append').mockImplementation(() => {});
  (upload as jest.Mock).mockResolvedValue({ id: 'saved', status: 'PENDING' });
  (get as jest.Mock).mockResolvedValue([]);
  await expect(verificationService.submitDocument(type, 'file://photo.jpg', 'photo.jpg', 'image/jpeg'))
    .resolves.toEqual({ idVerified: false, selfieVerified: false, incomeVerified: false });
  const [url] = (upload as jest.Mock).mock.calls[0];
  expect(url).toBe('/member-auth/me/documents/');
  expect(append).toHaveBeenCalledWith('file', expect.objectContaining({ uri: 'file://photo.jpg', type: 'image/jpeg' }));
  expect(append).toHaveBeenCalledWith('document_type', type === 'Government ID' ? 'OTHER' : 'INCOME_CERTIFICATE');
});
