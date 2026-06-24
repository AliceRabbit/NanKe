import {
  CharacterRepository,
  ConversationRepository,
  ImportReportRepository,
  ProfileRepository,
  ToolboxRepository,
  UserPersonaRepository,
  WorldBookRepository
} from '$lib/storage/repositories';

export function createRequestContext() {
  return {
    characters: new CharacterRepository(),
    conversations: new ConversationRepository(),
    worldBooks: new WorldBookRepository(),
    profiles: new ProfileRepository(),
    toolbox: new ToolboxRepository(),
    personas: new UserPersonaRepository(),
    importReports: new ImportReportRepository()
  };
}
