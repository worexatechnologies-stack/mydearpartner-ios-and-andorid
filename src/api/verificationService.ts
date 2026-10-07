/** Verification status is authoritative only when returned by the server. */
import { get,upload } from './apiClient';

export interface VerificationStatus {
  idVerified: boolean;
  selfieVerified: boolean;
  incomeVerified: boolean;
}

type Document = { id: string; document_type: string; custom_document_name?: string; status: string };
const DOCUMENTS_URL = '/member-auth/me/documents/';
async function getStatus(): Promise<VerificationStatus> {
  const documents = await get<Document[]>(DOCUMENTS_URL);
  if (!Array.isArray(documents)) throw new Error('Could not load verification status. Please retry.');
  const approved = documents.filter(document => document?.status === 'APPROVED');
  return {
    idVerified: approved.some(document => ['AADHAAR', 'PAN', 'PASSPORT', 'DRIVING_LICENCE', 'VOTER_ID'].includes(document.document_type)
      || (document.document_type === 'OTHER' && document.custom_document_name === 'Government ID')),
    selfieVerified: approved.some(document => document.document_type === 'OTHER' && document.custom_document_name === 'Verification selfie'),
    incomeVerified: approved.some(document => ['INCOME_CERTIFICATE', 'SALARY_SLIP'].includes(document.document_type)),
  };
}

async function submit(type: string, uri: string, name: string, mime: string, customName?: string): Promise<VerificationStatus> {
  const data = new FormData();
  data.append('file', { uri, name, type: mime } as any);
  data.append('document_type', type);
  if (customName) data.append('custom_document_name', customName);
  const saved = await upload<Document>(DOCUMENTS_URL, data);
  if (!saved?.id) throw new Error('Your upload was not confirmed. Refresh verification before trying again.');
  return getStatus();
}

export const verificationService = {
  getStatus,

  submitSelfie: async (photoUri: string): Promise<VerificationStatus> => {
    return submit('OTHER', photoUri, 'selfie.jpg', 'image/jpeg', 'Verification selfie');
  },

  submitDocument: async (
    docType: string,
    fileUri: string,
    fileName: string,
    fileType: string,
  ): Promise<VerificationStatus> => {
    if (['ID', 'Government ID'].includes(docType)) return submit('OTHER', fileUri, fileName, fileType, 'Government ID');
    if (['INCOME', 'Income Certificate'].includes(docType)) return submit('INCOME_CERTIFICATE', fileUri, fileName, fileType);
    throw new Error('Unsupported verification document type.');
  },
};
