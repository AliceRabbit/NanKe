import {
  CharacterRepository,
  ConversationRepository,
  ImportReportRepository,
  ProfileRepository,
  WorldBookRepository
} from '$lib/storage/repositories';

export function createRequestContext() {
  return {
    characters: new CharacterRepository(),
    conversations: new ConversationRepository(),
    worldBooks: new WorldBookRepository(),
    profiles: new ProfileRepository(),
    importReports: new ImportReportRepository()
  };
}
