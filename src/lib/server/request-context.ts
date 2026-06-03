import {
  CharacterRepository,
  ConversationRepository,
  ImportReportRepository,
  ProfileRepository,
  UserPersonaRepository,
  WorldBookRepository
} from '$lib/storage/repositories';

export function createRequestContext() {
  return {
    characters: new CharacterRepository(),
    conversations: new ConversationRepository(),
    worldBooks: new WorldBookRepository(),
    profiles: new ProfileRepository(),
    personas: new UserPersonaRepository(),
    importReports: new ImportReportRepository()
  };
}
